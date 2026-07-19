/**
 * Create audit_events in Supabase (requires direct Postgres URL).
 *
 * Run: npm run setup:audit
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')

const SQL_PATH = path.join(__dirname, '../../sql/audit_events.sql')
const SQL_EDITOR =
  'https://supabase.com/dashboard/project/fetvvzvhvxaozneurfpz/sql/new'

async function run() {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.log('SUPABASE_DB_URL is not set in server/.env\n')
    console.log('Option A — SQL Editor (fastest):')
    console.log(`  1. Open ${SQL_EDITOR}`)
    console.log(`  2. Paste the contents of server/sql/audit_events.sql`)
    console.log('  3. Click Run\n')
    console.log('Option B — this script:')
    console.log('  Add SUPABASE_DB_URL from Supabase → Settings → Database → URI')
    console.log('  Then run: npm run setup:audit')
    process.exit(1)
  }

  let pg
  try {
    pg = require('pg')
  } catch {
    console.error('Install pg first: npm install pg')
    process.exit(1)
  }

  const sql = fs.readFileSync(SQL_PATH, 'utf8')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })

  try {
    await client.connect()
    await client.query(sql)
    console.log('audit_events table is ready.')
  } catch (err) {
    console.error('Setup failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
