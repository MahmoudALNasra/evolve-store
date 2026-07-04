const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const mongoose = require('mongoose')
const Product = require('../models/Product')

const DEFAULT_BACKUP_ROOTS = [
  '/root/mongo-backups',
  '/root',
  '/var/backups',
]

function findProductsBson(dumpPath) {
  const direct = path.join(dumpPath, 'estore', 'products.bson')
  if (fs.existsSync(direct)) return direct

  const alt = path.join(dumpPath, 'products.bson')
  if (fs.existsSync(alt)) return alt

  throw new Error(`products.bson not found under ${dumpPath}`)
}

function dumpRootFromBson(bsonPath) {
  const parent = path.dirname(bsonPath)
  if (path.basename(parent) === 'estore') return path.dirname(parent)
  return parent
}

function findAllProductBackups(roots = DEFAULT_BACKUP_ROOTS) {
  const found = []

  function scanDir(dir, depth = 0) {
    if (!dir || !fs.existsSync(dir) || depth > 6) return

    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath, depth + 1)
        continue
      }
      if (entry.name !== 'products.bson') continue

      const stat = fs.statSync(fullPath)
      found.push({
        bsonPath: fullPath,
        dumpPath: dumpRootFromBson(fullPath),
        mtimeMs: stat.mtimeMs,
        mtime: stat.mtime.toISOString(),
      })
    }
  }

  for (const root of roots) scanDir(root)
  return found.sort((a, b) => a.mtimeMs - b.mtimeMs)
}

function pickBackupNearTime(backups, targetMs) {
  if (!backups.length) return null

  let best = backups[0]
  let bestDiff = Math.abs(best.mtimeMs - targetMs)

  for (const backup of backups.slice(1)) {
    const diff = Math.abs(backup.mtimeMs - targetMs)
    if (diff < bestDiff) {
      best = backup
      bestDiff = diff
    }
  }

  return { backup: best, diffMs: bestDiff }
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

async function restorePricesFromBson(bsonPath, options = {}) {
  const { dryRun = false, full = false } = options
  const tempDb = `estore_price_restore_${Date.now()}`
  const quotedBson = `"${bsonPath.replace(/"/g, '\\"')}"`

  if (!dryRun) {
    run(`mongorestore --db ${tempDb} --collection products ${quotedBson}`)
  }

  const client = mongoose.connection.getClient()
  if (dryRun) {
    return { dryRun: true, bsonPath, tempDb }
  }

  const backupProducts = await client.db(tempDb).collection('products').find({}).project({
    _id: 1, barcode: 1, sku: 1, name: 1, price: 1, comparePrice: 1,
    description: 1, stock: 1, isPublished: 1, category: 1, slug: 1,
  }).toArray()

  const report = { matched: 0, updated: 0, missing: 0, total: backupProducts.length, bsonPath }

  for (const backup of backupProducts) {
    const barcode = String(backup.barcode || '').trim()
    let existing = null

    if (barcode) existing = await Product.findOne({ barcode })
    if (!existing && backup._id) existing = await Product.findById(backup._id)
    if (!existing && backup.sku) existing = await Product.findOne({ sku: String(backup.sku).trim() })

    if (!existing) {
      report.missing += 1
      continue
    }

    report.matched += 1

    if (full) {
      const { _id, __v, createdAt, updatedAt, ...rest } = backup
      await Product.updateOne({ _id: existing._id }, { $set: rest })
      report.updated += 1
      continue
    }

    const priceChanged =
      Number(existing.price) !== Number(backup.price) ||
      Number(existing.comparePrice || 0) !== Number(backup.comparePrice || 0)

    if (!priceChanged) continue

    await Product.updateOne(
      { _id: existing._id },
      { $set: { price: backup.price, comparePrice: backup.comparePrice || 0 } }
    )
    report.updated += 1
  }

  await client.db(tempDb).dropDatabase()
  return report
}

module.exports = {
  DEFAULT_BACKUP_ROOTS,
  findProductsBson,
  findAllProductBackups,
  pickBackupNearTime,
  restorePricesFromBson,
}
