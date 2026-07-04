require('dotenv').config()

// Restore overwrites website from sheet only — skip GMC Sheet1 link writes (quota + not needed for restore)
process.env.INVENTORY_SYNC_SHEET1_LINKS = 'false'
// Never overwrite website prices during sheet restore (prices live on website/admin)
process.env.INVENTORY_SYNC_SHEET_PRICES = 'false'

const connectDB = require('../config/db')
const { syncInventoryFromSheet } = require('../services/inventorySyncService')

async function main() {
  await connectDB()
  console.log('Restoring website products from master Products tab (full overwrite)...')
  const result = await syncInventoryFromSheet({ force: true, fromMaster: true })
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
