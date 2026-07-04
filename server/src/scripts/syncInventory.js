require('dotenv').config()
const connectDB = require('../config/db')
const { syncInventoryFromSheet } = require('../services/inventorySyncService')

async function main() {
  await connectDB()
  const result = await syncInventoryFromSheet()
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
