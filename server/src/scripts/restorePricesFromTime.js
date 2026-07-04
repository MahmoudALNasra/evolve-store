/**
 * Restore prices from the mongodump closest to N hours ago.
 *
 *   npm run inventory:restore-prices-time -- --hours 2
 *   npm run inventory:restore-prices-time -- --hours 2 --dry-run
 *   npm run inventory:restore-prices-time -- --list
 */
require('dotenv').config()
const connectDB = require('../config/db')
const {
  DEFAULT_BACKUP_ROOTS,
  findAllProductBackups,
  pickBackupNearTime,
  restorePricesFromBson,
} = require('../utils/restorePricesFromBackup')

function parseArgs(argv) {
  const hoursIdx = argv.indexOf('--hours')
  return {
    hours: hoursIdx >= 0 ? Number(argv[hoursIdx + 1] || 2) : 2,
    dryRun: argv.includes('--dry-run'),
    full: argv.includes('--full'),
    list: argv.includes('--list'),
    allowClosest: argv.includes('--allow-closest'),
    maxDiffHours: Number(process.env.RESTORE_MAX_BACKUP_AGE_HOURS || 48),
  }
}

function formatDiff(ms) {
  const hours = Math.abs(ms) / 3600000
  if (hours < 1) return `${Math.round(Math.abs(ms) / 60000)} minutes`
  return `${hours.toFixed(1)} hours`
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const backups = findAllProductBackups(DEFAULT_BACKUP_ROOTS)

  if (args.list || !backups.length) {
    console.log(JSON.stringify({
      backupRoots: DEFAULT_BACKUP_ROOTS,
      found: backups.map((b) => ({ mtime: b.mtime, dumpPath: b.dumpPath })),
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

  if (diffMs > maxDiffMs && !args.allowClosest) {
    console.error(`\nClosest backup is ${formatDiff(diffMs)} away — older than ${args.maxDiffHours}h limit.`)
    console.error('Try --allow-closest to use the nearest backup anyway, or check DigitalOcean snapshots.')
    console.error('List backups: npm run inventory:restore-prices-time -- --list')
    process.exit(1)
  }

  if (diffMs > maxDiffMs && args.allowClosest) {
    console.warn(`\nWarning: using backup ${formatDiff(diffMs)} from target (best available).`)
  }

  if (!args.dryRun) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const { execSync } = require('child_process')
    const safetyPath = `/root/mongo-backups/pre-restore-${stamp}`
    console.log(`Saving current DB snapshot → ${safetyPath}`)
    execSync(`mkdir -p /root/mongo-backups && mongodump --db estore --collection products --out ${safetyPath}`, { stdio: 'inherit' })
  }

  await connectDB()
  const result = await restorePricesFromBson(backup.bsonPath, {
    dryRun: args.dryRun,
    full: args.full,
  })

  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
