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

function cleanId(value) {
  return String(value || '').trim()
}

function productFieldsFromBackup(backup) {
  const { _id, __v, createdAt, updatedAt, ...rest } = backup
  return rest
}

async function findProductMatch(backup) {
  const barcode = cleanId(backup.barcode)
  if (barcode) {
    const byBarcode = await Product.findOne({ barcode })
    if (byBarcode) return byBarcode
  }
  if (backup._id) {
    const byId = await Product.findById(backup._id)
    if (byId) return byId
  }
  const sku = cleanId(backup.sku)
  if (sku) {
    const bySku = await Product.findOne({ sku })
    if (bySku) return bySku
  }
  return null
}

/**
 * @param {'prices'|'full'} mode — full restores name, description, images, tags, SEO, stock, etc.
 */
async function restoreProductsFromBson(bsonPath, options = {}) {
  const {
    dryRun = false,
    mode = 'full',
    insertMissing = true,
    unpublishExtras = true,
  } = options

  const tempDb = `estore_product_restore_${Date.now()}`
  const quotedBson = `"${bsonPath.replace(/"/g, '\\"')}"`

  if (!dryRun) {
    run(`mongorestore --db ${tempDb} --collection products ${quotedBson}`)
  }

  const client = mongoose.connection.getClient()
  if (dryRun) {
    return { dryRun: true, mode, bsonPath, tempDb }
  }

  const backupProducts = await client.db(tempDb).collection('products').find({}).toArray()
  const backupBarcodes = new Set(
    backupProducts.map((p) => cleanId(p.barcode)).filter(Boolean)
  )
  const backupIds = new Set(backupProducts.map((p) => String(p._id)))

  const report = {
    mode,
    matched: 0,
    updated: 0,
    inserted: 0,
    missing: 0,
    unpublished: 0,
    total: backupProducts.length,
    bsonPath,
  }

  for (const backup of backupProducts) {
    const existing = await findProductMatch(backup)

    if (!existing) {
      if (mode === 'full' && insertMissing) {
        try {
          await Product.create(productFieldsFromBackup(backup))
          report.inserted += 1
        } catch (err) {
          report.missing += 1
          console.warn(`Insert failed ${cleanId(backup.barcode) || backup.name}: ${err.message}`)
        }
      } else {
        report.missing += 1
      }
      continue
    }

    report.matched += 1

    if (mode === 'full') {
      await Product.updateOne(
        { _id: existing._id },
        { $set: productFieldsFromBackup(backup) }
      )
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

  if (mode === 'full' && unpublishExtras) {
    const extras = await Product.find({
      isPublished: true,
      $or: [
        { barcode: { $nin: [...backupBarcodes, ''] } },
        { barcode: null },
      ],
    }).select('_id barcode')

    for (const product of extras) {
      const barcode = cleanId(product.barcode)
      if (barcode && backupBarcodes.has(barcode)) continue
      if (backupIds.has(String(product._id))) continue
      await Product.updateOne({ _id: product._id }, { $set: { isPublished: false } })
      report.unpublished += 1
    }
  }

  await client.db(tempDb).dropDatabase()
  return report
}

/** @deprecated use restoreProductsFromBson */
async function restorePricesFromBson(bsonPath, options = {}) {
  return restoreProductsFromBson(bsonPath, {
    ...options,
    mode: options.full ? 'full' : 'prices',
  })
}

module.exports = {
  DEFAULT_BACKUP_ROOTS,
  findProductsBson,
  findAllProductBackups,
  pickBackupNearTime,
  restoreProductsFromBson,
  restorePricesFromBson,
}
