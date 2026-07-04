/**
 * Full product restore from the mongodump closest to N hours ago.
 * Restores price, name, description, images, tags, SEO, stock, and all other fields.
 *
 *   npm run inventory:restore-products-time -- --hours 2
 *   npm run inventory:restore-products-time -- --hours 2 --dry-run
 *   npm run inventory:restore-products-time -- --list
 *   npm run inventory:restore-products-time -- --hours 2 --allow-closest
 */
require('dotenv').config()
const connectDB = require('../config/db')
const {
  DEFAULT_BACKUP_ROOTS,
  findAllProductBackups,
  pickBackupNearTime,
  restoreProductsFromBson,
} = require('../utils/restorePricesFromBackup')

function parseArgs(argv) {
  const hoursIdx = argv.indexOf('--hours')
  return {
    hours: hoursIdx >= 0 ? Number(argv[hoursIdx + 1] || 2) : 2,
    dryRun: argv.includes('--dry-run'),
    pricesOnly: argv.includes('--prices-only'),
    list: argv.includes('--list'),
    allowClosest: argv.includes('--allow-closest'),
    includeSafetySnapshots: argv.includes('--include-safety-snapshots'),
    noUnpublish: argv.includes('--keep-extras'),
    maxDiffHours: Number(process.env.RESTORE_MAX_BACKUP_AGE_HOURS || 720),
  }
}

function formatDiff(ms) {
  const hours = Math.abs(ms) / 3600000
  if (hours < 1) return `${Math.round(Math.abs(ms) / 60000)} minutes`
  return `${hours.toFixed(1)} hours`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const backups = findAllProductBackups(DEFAULT_BACKUP_ROOTS, {
    includeSafetySnapshots: args.includeSafetySnapshots,
  })

  if (args.list || !backups.length) {
    console.log(JSON.stringify({
      backupRoots: DEFAULT_BACKUP_ROOTS,
      note: 'pre-restore-* folders are safety snapshots (excluded by default). Use --include-safety-snapshots to include them.',
      found: backups.map((b) => ({
        mtime: b.mtime,
        dumpPath: b.dumpPath,
        safetySnapshot: b.isSafetySnapshot,
      })),
    }, null, 2))
    if (!backups.length) {
      console.error('\nNo products.bson backups found. Create one with: mongodump --db estore --out /root/mongo-backups/estore-$(date +%F-%H%M)')
      process.exit(1)
    }
    if (args.list) process.exit(0)
  }

  const targetMs = Date.now() - args.hours * 3600000
  const { backup, diffMs } = pickBackupNearTime(backups, targetMs)
  const maxDiffMs = args.maxDiffHours * 3600000

  console.log(`Target time: ${new Date(targetMs).toISOString()} (${args.hours}h ago)`)
  console.log(`Using backup: ${backup.dumpPath}`)
  console.log(`Backup time:  ${backup.mtime} (${formatDiff(backup.mtimeMs - targetMs)} from target)`)
  console.log(`Mode: ${args.pricesOnly ? 'prices only' : 'full product restore (images, desc, all fields)'}`)

  if (diffMs > maxDiffMs && !args.allowClosest) {
    console.error(`\nClosest backup is ${formatDiff(diffMs)} away — older than ${args.maxDiffHours}h limit.`)
    console.error('Try --allow-closest to use the nearest backup anyway, or check DigitalOcean snapshots.')
    console.error('List backups: npm run inventory:restore-products-time -- --list')
    process.exit(1)
  }

  if (diffMs > maxDiffMs && args.allowClosest) {
    console.warn(`\nWarning: using backup ${formatDiff(diffMs)} from target (best available).`)
  }

  if (!args.dryRun) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const { execSync } = require('child_process')
    const safetyPath = `/root/mongo-backups/pre-restore-${stamp}`
    console.log(`Saving current products snapshot → ${safetyPath}`)
    execSync(`mkdir -p /root/mongo-backups && mongodump --db estore --collection products --out ${safetyPath}`, { stdio: 'inherit' })
  }

  await connectDB()
  const result = await restoreProductsFromBson(backup.bsonPath, {
    dryRun: args.dryRun,
    mode: args.pricesOnly ? 'prices' : 'full',
    insertMissing: true,
    unpublishExtras: !args.noUnpublish,
  })

  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
