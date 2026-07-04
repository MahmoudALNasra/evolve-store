require('dotenv').config()
const { syncMasterSheetToProductsTab } = require('../services/masterSheetSyncService')

async function main() {
  const result = await syncMasterSheetToProductsTab()
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
