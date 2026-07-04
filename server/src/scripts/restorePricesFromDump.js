/**
 * Restore product prices (and optionally full product docs) from a mongodump folder.
 *
 *   npm run inventory:restore-prices -- --dump /root/mongo-backups/estore-2026-06-10
 *   npm run inventory:restore-prices -- --dump /path/to/dump --dry-run
 *   npm run inventory:restore-prices -- --dump /path/to/dump --full
 *
 * Finds estore/products.bson under the dump path. Uses a temporary DB, then drops it.
 */
require('dotenv').config()
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const connectDB = require('../config/db')
const Product = require('../models/Product')

function parseArgs(argv) {
  const dumpIdx = argv.indexOf('--dump')
  return {
    dumpPath: dumpIdx >= 0 ? path.resolve(argv[dumpIdx + 1] || '') : '',
    dryRun: argv.includes('--dry-run'),
    full: argv.includes('--full'),
  }
}

function findProductsBson(dumpPath) {
  const direct = path.join(dumpPath, 'estore', 'products.bson')
  if (fs.existsSync(direct)) return direct

  const alt = path.join(dumpPath, 'products.bson')
  if (fs.existsSync(alt)) return alt

  throw new Error(`products.bson not found under ${dumpPath} (expected estore/products.bson)`)
}

function run(cmd) {
  execSync(cmd, { stdio: 'inherit' })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dumpPath) {
    console.error('Usage: npm run inventory:restore-prices -- --dump /path/to/mongodump [--dry-run] [--full]')
    process.exit(1)
  }

  const bsonPath = findProductsBson(args.dumpPath)
  const tempDb = `estore_price_restore_${Date.now()}`
  const quotedBson = `"${bsonPath.replace(/"/g, '\\"')}"`

  console.log(`Loading backup from ${bsonPath}`)
  if (!args.dryRun) {
    run(`mongorestore --db ${tempDb} --collection products ${quotedBson}`)
  }

  await connectDB()
  const client = mongoose.connection.getClient()
  const backupCol = client.db(tempDb).collection('products')
  const backupProducts = args.dryRun
    ? []
    : await backupCol.find({}).project({
      _id: 1, barcode: 1, sku: 1, name: 1, price: 1, comparePrice: 1,
      description: 1, stock: 1, isPublished: 1, category: 1, slug: 1,
    }).toArray()

  if (args.dryRun) {
    console.log(`[dry-run] Would restore from ${bsonPath} (${tempDb})`)
    process.exit(0)
  }

  const report = { matched: 0, updated: 0, missing: 0, total: backupProducts.length }

  for (const backup of backupProducts) {
    const barcode = String(backup.barcode || '').trim()
    let existing = null

    if (barcode) {
      existing = await Product.findOne({ barcode })
    }
    if (!existing && backup._id) {
      existing = await Product.findById(backup._id)
    }
    if (!existing && backup.sku) {
      existing = await Product.findOne({ sku: String(backup.sku).trim() })
    }

    if (!existing) {
      report.missing += 1
      continue
    }

    report.matched += 1

    if (args.full) {
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

  console.log(JSON.stringify(report, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
