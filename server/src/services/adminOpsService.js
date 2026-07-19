/**
 * In-process job runner for long-running admin operations (sheet sync, image
 * enrichment, audits). One job at a time; status is kept in memory so the
 * admin UI can poll progress and read the last result of each job.
 */

const JOBS = {
  'sync-sheet': {
    label: 'Push catalog to Google Sheet',
    description: 'Backup the Products tab, then replace it with published website products only (prices, stock, images, descriptions). Unpublished stay off the Merchant feed.',
    supportsDryRun: true,
    run: async (params = {}) => {
      const { replaceWebsiteCatalogOnMasterSheet } = require('./websiteToMasterSheetSyncService')
      return replaceWebsiteCatalogOnMasterSheet({
        dryRun: params.dryRun === true,
        includeUnpublished: params.includeUnpublished === true,
      })
    },
  },
  'delete-unpublished': {
    label: 'Delete unpublished products',
    description: 'Permanently remove products that are not published (Draft). Dry run only previews — uncheck Dry run to delete for real.',
    supportsDryRun: true,
    run: async (params = {}) => deleteUnpublishedProducts(params),
  },
  'purge-unpublished-and-sync': {
    label: 'Delete unpublished + push sheet',
    description: 'Deletes all non-published products from the website DB, then replaces the Google Products tab with published products only. This is the button to use.',
    supportsDryRun: true,
    run: async (params = {}) => {
      const dryRun = params.dryRun === true
      const deleted = await deleteUnpublishedProducts({ dryRun })
      const { replaceWebsiteCatalogOnMasterSheet } = require('./websiteToMasterSheetSyncService')
      const sheet = await replaceWebsiteCatalogOnMasterSheet({
        dryRun,
        includeUnpublished: false,
      })
      return {
        dryRun,
        deleted,
        sheet: {
          productCount: sheet.productCount,
          matrixRows: sheet.matrixRows,
          write: sheet.write,
          verification: sheet.verification,
          preview: sheet.preview,
        },
        summary: dryRun
          ? `Dry run only: would delete ${deleted.matched} unpublished, then write ${sheet.productCount} published rows to the sheet. Nothing was changed.`
          : `Deleted ${deleted.deleted} unpublished from the site, then wrote ${sheet.productCount} published products to the sheet.`,
      }
    },
  },
  'pull-inventory': {
    label: 'Pull stock from Google Sheet',
    description: 'Read stock/price from the inventory sheet and update MongoDB products, then push Merchant Center where configured.',
    supportsDryRun: false,
    run: async () => {
      const { syncInventoryFromSheet } = require('./inventorySyncService')
      return syncInventoryFromSheet()
    },
  },
  'normalize-stock': {
    label: 'Normalize stock 1 → 2',
    description: 'Set every product with stock exactly 1 to stock 2 in the website database.',
    supportsDryRun: true,
    run: async (params = {}) => {
      const { normalizeStockOneToTwo } = require('./stockNormalizationService')
      return normalizeStockOneToTwo({ dryRun: params.dryRun === true })
    },
  },
  'enrich-images': {
    label: 'Enrich product images (Serper)',
    description: 'Find and download images for products under the minimum image count (includes unpublished).',
    supportsDryRun: true,
    run: async (params = {}) => {
      const { enrichAllProductsUnderMin } = require('./productImageEnrichmentService')
      return enrichAllProductsUnderMin({
        dryRun: params.dryRun === true,
        onlyNoImages: params.onlyNoImages === true,
      })
    },
  },
  'mirror-images': {
    label: 'Mirror external images to local media',
    description: 'Download external hotlinked images onto the server and rewrite product URLs to /media/...',
    supportsDryRun: true,
    run: async (params = {}) => {
      const { mirrorAllProducts } = require('./productImageEnrichmentService')
      return mirrorAllProducts({ dryRun: params.dryRun === true })
    },
  },
  'catalog-audit': {
    label: 'Audit catalog quality',
    description: 'Count products needing description/SEO work, bad titles, and unresolved categories. Read-only.',
    supportsDryRun: false,
    run: async () => {
      const { auditDescriptionQuality } = require('./productDescriptionOptimizationService')
      const { auditProductCategories } = require('./barcodeCategoryFixService')
      const { shouldFixProductName } = require('../utils/productNameQuality')
      const Product = require('../models/Product')

      const [descriptions, categories, products] = await Promise.all([
        auditDescriptionQuality({ includeUnpublished: true }),
        auditProductCategories({ onlyPublished: false }),
        Product.find({}).select('name').lean(),
      ])
      const badTitles = products.filter((p) => shouldFixProductName(p.name)).length

      return {
        total: products.length,
        badTitles,
        descriptions,
        categories,
      }
    },
  },
}

const state = {
  running: null, // { job, label, startedAt, params }
  lastRuns: {}, // job -> { job, label, status, startedAt, finishedAt, durationMs, result?, error? }
}

/** Anything not explicitly published (false, null, missing). */
async function deleteUnpublishedProducts(params = {}) {
  const Product = require('../models/Product')
  const dryRun = params.dryRun === true
  const filter = { isPublished: { $ne: true } }
  const products = await Product.find(filter)
    .select('_id name barcode sku stock slug isPublished')
    .lean()
  if (!dryRun) {
    const ids = products.map((p) => p._id)
    if (ids.length) await Product.deleteMany({ _id: { $in: ids } })
  }
  return {
    dryRun,
    matched: products.length,
    deleted: dryRun ? 0 : products.length,
    samples: products.slice(0, 25).map((p) => ({
      productId: p._id,
      barcode: p.barcode,
      sku: p.sku,
      name: p.name,
      stock: p.stock,
      slug: p.slug,
      isPublished: p.isPublished,
    })),
  }
}

async function getCatalogCounts() {
  const Product = require('../models/Product')
  const [total, published, unpublished] = await Promise.all([
    Product.countDocuments({}),
    Product.countDocuments({ isPublished: true }),
    Product.countDocuments({ isPublished: { $ne: true } }),
  ])
  return { total, published, unpublished }
}

function getJobDefinitions() {
  return Object.entries(JOBS).map(([job, def]) => ({
    job,
    label: def.label,
    description: def.description || '',
    supportsDryRun: def.supportsDryRun === true,
  }))
}

async function getOpsStatus() {
  const counts = await getCatalogCounts()
  return {
    running: state.running,
    lastRuns: state.lastRuns,
    jobs: getJobDefinitions(),
    counts,
  }
}

function startOpsJob(job, params = {}) {
  const def = JOBS[job]
  if (!def) {
    return { ok: false, status: 400, message: `Unknown job "${job}"` }
  }
  if (state.running) {
    return {
      ok: false,
      status: 409,
      message: `Job "${state.running.label}" is already running. Wait for it to finish.`,
    }
  }

  const startedAt = new Date()
  state.running = { job, label: def.label, startedAt, params }

  def.run(params)
    .then((result) => {
      state.lastRuns[job] = {
        job,
        label: def.label,
        status: 'done',
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        params,
        result,
      }
    })
    .catch((err) => {
      console.error(`Admin ops job "${job}" failed:`, err)
      state.lastRuns[job] = {
        job,
        label: def.label,
        status: 'error',
        startedAt,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        params,
        error: err.message,
      }
    })
    .finally(() => {
      state.running = null
    })

  return { ok: true, job, label: def.label, startedAt, dryRun: params.dryRun === true }
}

module.exports = { startOpsJob, getOpsStatus, getJobDefinitions }
