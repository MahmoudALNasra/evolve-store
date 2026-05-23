/**
 * Create analytics_events in Supabase (requires direct Postgres URL).
 *
 * Dashboard → Project Settings → Database → Connection string (URI)
 * Add to server/.env: SUPABASE_DB_URL=postgresql://postgres.[ref]:[PASSWORD]@...
 *
 * Run: npm run setup:analytics
 */
require('dotenv').config()
const fs = require('fs')
const path = require('path')

const SQL_PATH = path.join(__dirname, '../../sql/analytics_events.sql')
const SQL_EDITOR =
  'https://supabase.com/dashboard/project/fetvvzvhvxaozneurfpz/sql/new'

async function run() {
  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.log('SUPABASE_DB_URL is not set in server/.env\n')
    console.log('Option A — SQL Editor (fastest):')
    console.log(`  1. Open ${SQL_EDITOR}`)
    console.log(`  2. Paste the contents of server/sql/analytics_events.sql`)
    console.log('  3. Click Run\n')
    console.log('Option B — this script:')
    console.log('  Add SUPABASE_DB_URL from Supabase → Settings → Database → URI')
    console.log('  Then run: npm run setup:analytics')
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
    console.log('analytics_events table is ready.')
  } catch (err) {
    console.error('Setup failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
