/**
 * In-process job runner for long-running admin operations (sheet sync, image
 * enrichment, audits). One job at a time; status is kept in memory so the
 * admin UI can poll progress and read the last result of each job.
 */

const JOBS = {
  'sync-sheet': {
    label: 'Push catalog to Google Sheet',
    description: 'Backup the Products tab, then replace it with the full website catalog (prices, stock, images, descriptions).',
    supportsDryRun: true,
    run: async (params = {}) => {
      const { replaceWebsiteCatalogOnMasterSheet } = require('./websiteToMasterSheetSyncService')
      return replaceWebsiteCatalogOnMasterSheet({
        dryRun: params.dryRun === true,
        includeUnpublished: params.includeUnpublished !== false,
      })
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

function getJobDefinitions() {
  return Object.entries(JOBS).map(([job, def]) => ({
    job,
    label: def.label,
    description: def.description || '',
    supportsDryRun: def.supportsDryRun === true,
  }))
}

function getOpsStatus() {
  return {
    running: state.running,
    lastRuns: state.lastRuns,
    jobs: getJobDefinitions(),
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
        error: err.message,
      }
    })
    .finally(() => {
      state.running = null
    })

  return { ok: true, job, label: def.label, startedAt }
}

module.exports = { startOpsJob, getOpsStatus, getJobDefinitions }
