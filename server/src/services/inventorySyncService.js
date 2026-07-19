const crypto = require('crypto')
const Product = require('../models/Product')
const InventorySyncProduct = require('../models/InventorySyncProduct')
const {
  fetchInventoryRows,
  fetchMasterInventoryRows,
  updateStockCell,
  updateMerchantFeedLinkCell,
} = require('./googleSheetsInventoryService')
const { upsertWebsiteProduct, updateWebsiteStockByProductId } = require('./websiteProductSyncService')
const { upsertMerchantProduct, updateMerchantStock } = require('./googleMerchantSyncService')
const { mapSheetRowToWebsiteProduct, isValidSheetProductName } = require('../utils/inventoryMapper')
const { dedupeSheetEntries } = require('../utils/inventoryProductIdentity')
const { syncMasterSheetToProductsTab } = require('./masterSheetSyncService')

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function hash(value) {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex')
}

function hashComparablePayload(payload) {
  const comparable = { ...payload }
  delete comparable.productUrl
  delete comparable.productLinkPath
  return hash(comparable)
}

function withProductUrl(payload, product) {
  const baseUrl = (process.env.SITE_URL || process.env.CLIENT_URL || '').replace(/\/$/, '')
  if (!baseUrl) return payload

  const productLinkPath = payload.productLinkPath || (product?.slug ? `/product/${product.slug}` : '')
  if (!productLinkPath) return payload

  return {
    ...payload,
    productLinkPath,
    productUrl: `${baseUrl}${productLinkPath.startsWith('/') ? '' : '/'}${productLinkPath}`,
  }
}

function shouldSkipInventoryRow(existing, sourceHash, payloadHash) {
  if (!existing) return false
  if (existing.sourceHash !== sourceHash || existing.payloadHash !== payloadHash) return false

  const merchantFeedConfigured = Boolean(process.env.GOOGLE_MERCHANT_FEED_SHEET_ID)
  const baseUrl = (process.env.SITE_URL || process.env.CLIENT_URL || '').replace(/\/$/, '')
  if (baseUrl && existing.websitePayload?.productUrl && !existing.websitePayload.productUrl.startsWith(baseUrl)) {
    return false
  }

  if (merchantFeedConfigured && existing.websitePayload?.productUrl !== existing.merchantFeedLink) {
    return false
  }

  return true
}

function getOtherCategoryName() {
  return process.env.INVENTORY_OTHER_CATEGORY_NAME || 'Other Categories'
}

function getMinimumCategoryProductCount() {
  const value = Number(process.env.INVENTORY_MIN_CATEGORY_PRODUCT_COUNT || 2)
  return Number.isFinite(value) && value > 1 ? value : 2
}

function isFallbackCategory(category) {
  return !category || /^uncategorized$/i.test(category) || /^other categories$/i.test(category)
}

function collapseLowVolumeCategories(entries) {
  const minCount = getMinimumCategoryProductCount()
  const otherCategory = getOtherCategoryName()
  const counts = new Map()

  entries.forEach(({ websitePayload }) => {
    const category = websitePayload.category || ''
    counts.set(category, (counts.get(category) || 0) + 1)
  })

  return entries.map((entry) => {
    const category = entry.websitePayload.category || ''
    const shouldCollapse =
      isFallbackCategory(category) ||
      (counts.get(category) || 0) < minCount

    if (!shouldCollapse) return entry

    return {
      ...entry,
      websitePayload: {
        ...entry.websitePayload,
        category: otherCategory,
        tags: [
          otherCategory,
          entry.websitePayload.tags,
        ].filter(Boolean).join(', '),
      },
    }
  })
}

async function syncInventoryFromSheet(options = {}) {
  const force = options.force === true || process.env.INVENTORY_SYNC_FORCE === 'true'
  const fromMaster = options.fromMaster === true || process.env.INVENTORY_SYNC_FROM_MASTER === 'true'

  if (process.env.INVENTORY_SYNC_MASTER_FIRST === 'true') {
    try {
      const masterResult = await syncMasterSheetToProductsTab()
      console.log(`Master sheet → import tab: ${masterResult.copiedRows} rows`)
    } catch (err) {
      console.warn('Master sheet sync failed:', err.message)
    }
  }

  const fetchRows = fromMaster ? fetchMasterInventoryRows : fetchInventoryRows
  const { sheetId, sheetName, rows } = await fetchRows()
  console.log(`Fetched ${rows.length} rows from "${sheetName}" (${sheetId})${force ? ' [force restore]' : ''}`)
  const results = { scanned: rows.length, changed: 0, synced: 0, failed: 0, skipped: 0, force, fromMaster }
  const entries = []

  for (const row of rows) {
    const websitePayload = mapSheetRowToWebsiteProduct(row.sourceRow)
    if (!isValidSheetProductName(websitePayload.name, websitePayload.barcode)) {
      results.skipped += 1
      continue
    }
    if (!websitePayload.barcode && !websitePayload.sku) {
      results.skipped += 1
      continue
    }

    entries.push({ row, websitePayload })
  }

  const dedupedEntries = dedupeSheetEntries(entries)
  if (dedupedEntries.length < entries.length) {
    console.log(`Deduped sheet rows by barcode: ${entries.length} → ${dedupedEntries.length}`)
  }

  for (const { row, websitePayload } of collapseLowVolumeCategories(dedupedEntries)) {
    const sourceHash = hash(row.sourceRow)
    const payloadHash = hashComparablePayload(websitePayload)
    const existing = await InventorySyncProduct.findOne({ sheetId, rowNumber: row.rowNumber })

    if (
      !force &&
      shouldSkipInventoryRow(existing, sourceHash, payloadHash) &&
      existing?.syncStatus === 'synced'
    ) {
      continue
    }

    results.changed += 1

    try {
      const { product } = await upsertWebsiteProduct(websitePayload)
      const merchantPayload = withProductUrl(websitePayload, product)
      const merchantResult = await upsertMerchantProduct(merchantPayload)

      let merchantFeedLinkResult = { skipped: true }
      let sheetLinkError = ''
      if (process.env.INVENTORY_SYNC_SHEET1_LINKS !== 'false') {
        try {
          merchantFeedLinkResult = await updateMerchantFeedLinkCell(row.rowNumber, merchantPayload.productUrl)
        } catch (err) {
          sheetLinkError = err.message
          console.warn(`Sheet1 link update skipped row ${row.rowNumber}: ${err.message}`)
        }
      }

      await InventorySyncProduct.findOneAndUpdate(
        { sheetId, rowNumber: row.rowNumber },
        {
          $set: {
            sheetName,
            barcode: websitePayload.barcode,
            sku: websitePayload.sku,
            sourceHash,
            payloadHash,
            sourceRow: row.sourceRow,
            websitePayload: merchantPayload,
            websiteProduct: product._id,
            merchantOfferId: merchantResult.offerId || websitePayload.sku || websitePayload.barcode,
            merchantFeedLink: merchantFeedLinkResult.skipped ? '' : merchantPayload.productUrl,
            merchantFeedLinkSyncedAt: merchantFeedLinkResult.skipped ? undefined : new Date(),
            lastSyncedAt: new Date(),
            syncStatus: 'synced',
            lastError: sheetLinkError,
          },
        },
        { upsert: true, returnDocument: 'after' }
      )

      results.synced += 1
      if (results.synced % 25 === 0) {
        console.log(`Synced ${results.synced}/${results.changed} changed rows...`)
      }
    } catch (err) {
      results.failed += 1
      await InventorySyncProduct.findOneAndUpdate(
        { sheetId, rowNumber: row.rowNumber },
        {
          $set: {
            sheetName,
            barcode: websitePayload.barcode,
            sku: websitePayload.sku,
            sourceHash,
            payloadHash: hash(websitePayload),
            sourceRow: row.sourceRow,
            websitePayload,
            syncStatus: 'failed',
            lastError: err.message,
          },
        },
        { upsert: true }
      )
    }
  }

  console.log(`Done: scanned=${results.scanned} changed=${results.changed} synced=${results.synced} failed=${results.failed} skipped=${results.skipped}`)
  return results
}

async function applySaleItems(items = [], options = {}) {
  const { updateWebsiteStock = true } = options
  const results = []

  for (const item of items) {
    const quantity = Number(item.quantity || item.qty || 0)
    if (quantity <= 0) continue

    const query = item.sku
      ? { sku: String(item.sku).trim() }
      : item.barcode
        ? { barcode: String(item.barcode).trim() }
        : item.productId
          ? { websiteProduct: item.productId }
          : null

    if (!query) continue

    const syncRecord = await InventorySyncProduct.findOne(query)
    if (!syncRecord) {
      results.push({ item, status: 'not_found' })
      continue
    }

    const sheetStock = Number(syncRecord.websitePayload?.stock || 0)
    let previousStock = sheetStock
    let nextStock

    // Checkout already reduced website stock — push that level to the sheet, don't deduct twice.
    if (!updateWebsiteStock && syncRecord.websiteProduct) {
      const product = await Product.findById(syncRecord.websiteProduct).select('stock')
      nextStock = Math.max(0, Number(product?.stock ?? sheetStock))
      previousStock = sheetStock
    } else {
      nextStock = Math.max(0, sheetStock - quantity)
      previousStock = sheetStock
    }
    // Preserve publish flag from the website product (or prior payload). Stock alone
    // must never republish items the admin intentionally hid.
    let nextPublished = syncRecord.websitePayload?.isPublished
    if (syncRecord.websiteProduct) {
      const live = await Product.findById(syncRecord.websiteProduct).select('isPublished')
      if (live) nextPublished = live.isPublished
    }
    const nextPayload = {
      ...syncRecord.websitePayload,
      stock: nextStock,
      isPublished: nextPublished === true,
    }

    await InventorySyncProduct.updateOne(
      { _id: syncRecord._id },
      {
        $set: {
          websitePayload: nextPayload,
          payloadHash: hashComparablePayload(nextPayload),
          'sourceRow.Stock': nextStock,
          syncStatus: 'synced',
          lastSyncedAt: new Date(),
          lastError: '',
        },
      }
    )

    if (updateWebsiteStock && syncRecord.websiteProduct) {
      await updateWebsiteStockByProductId(syncRecord.websiteProduct, nextStock)
    }
    await updateStockCell(syncRecord.rowNumber, nextStock)
    await updateMerchantStock(nextPayload)

    results.push({
      sku: syncRecord.sku,
      barcode: syncRecord.barcode,
      previousStock,
      nextStock,
      status: 'synced',
    })
  }

  return results
}

let intervalHandle = null

function startInventorySyncScheduler() {
  if (process.env.INVENTORY_SYNC_ENABLED !== 'true') return
  if (process.env.VERCEL) {
    console.warn('Inventory interval scheduler disabled on Vercel. Use Vercel Cron to call /api/inventory/sync.')
    return
  }

  const intervalMs = Number(process.env.INVENTORY_SYNC_INTERVAL_MS || 15 * 60 * 1000)
  intervalHandle = setInterval(() => {
    syncInventoryFromSheet().catch((err) => console.error('Inventory sync failed:', err.message))
  }, intervalMs)
  intervalHandle.unref?.()
}

module.exports = {
  syncInventoryFromSheet,
  applySaleItems,
  startInventorySyncScheduler,
}
