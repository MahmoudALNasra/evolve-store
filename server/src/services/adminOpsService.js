/**
 * Admin operations runner.
 * Destructive / sheet jobs run synchronously in the HTTP request so the UI
 * always gets a real result (works with multi-instance PM2; no lost in-memory state).
 */

const JOBS = {
  'rebuild-frontend': {
    label: 'Pull + rebuild + restart API',
    description: 'git pull --ff-only, npm run build in client/, then pm2 restart evolve-api (after a few seconds so the response can finish). Use after you push commits. Takes 1–3 minutes; the admin UI may briefly disconnect during restart.',
    supportsDryRun: false,
    run: async (params = {}) => {
      const { deployFrontend } = require('./deployFrontendService')
      const result = await deployFrontend({
        skipPull: params.skipPull === true,
        skipRestart: params.skipRestart === true,
      })
      if (!result.ok) {
        const err = new Error(result.summary || 'Frontend deploy failed')
        err.deployResult = result
        throw err
      }
      return result
    },
  },
  'sync-sheet': {
    label: 'Push catalog to Google Sheet',
    description: 'Backup the Products tab, then replace it with published website products only.',
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
    description: 'Permanently remove products that are not published (Draft). Uncheck Dry run to delete for real.',
    supportsDryRun: true,
    run: async (params = {}) => deleteUnpublishedProducts(params),
  },
  'purge-unpublished-and-sync': {
    label: 'Delete unpublished + push sheet',
    description: 'Deletes all non-published products, then replaces the Google Products tab with published products only.',
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
          ? `Dry run only: would delete ${deleted.matched} unpublished, then write ${sheet.productCount} published rows. Nothing was changed.`
          : `Deleted ${deleted.deleted} unpublished from the site, then wrote ${sheet.productCount} published products to the sheet.`,
      }
    },
  },
  'pull-inventory': {
    label: 'Pull stock from Google Sheet',
    description: 'Read stock/price from the inventory sheet and update MongoDB products.',
    supportsDryRun: false,
    run: async () => {
      const { syncInventoryFromSheet } = require('./inventorySyncService')
      return syncInventoryFromSheet()
    },
  },
  'normalize-stock': {
    label: 'Normalize stock 1 → 2',
    description: 'Set every product with stock exactly 1 to stock 2.',
    supportsDryRun: true,
    run: async (params = {}) => {
      const { normalizeStockOneToTwo } = require('./stockNormalizationService')
      return normalizeStockOneToTwo({ dryRun: params.dryRun === true })
    },
  },
  'enrich-images': {
    label: 'Enrich product images (Serper)',
    description: 'Find and download images for products under the minimum image count.',
    supportsDryRun: true,
    async: true, // long-running — fire and poll
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
    description: 'Download external hotlinked images onto the server as /media/...',
    supportsDryRun: true,
    async: true,
    run: async (params = {}) => {
      const { mirrorAllProducts } = require('./productImageEnrichmentService')
      return mirrorAllProducts({ dryRun: params.dryRun === true })
    },
  },
  'catalog-audit': {
    label: 'Audit catalog quality',
    description: 'Count products needing description/SEO work, bad titles, and unresolved categories.',
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
  running: null,
  lastRuns: {},
}

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
    async: def.async === true,
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

function recordRun({ job, label, startedAt, params, result, error }) {
  state.lastRuns[job] = {
    job,
    label,
    status: error ? 'error' : 'done',
    startedAt,
    finishedAt: new Date(),
    durationMs: Date.now() - startedAt.getTime(),
    params,
    result,
    error,
  }
}

/**
 * Run a job. Short jobs await and return the result.
 * Long jobs (async:true) start in background and return 202-style payload.
 */
async function runOpsJob(job, params = {}) {
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
  const dryRun = params.dryRun === true
  state.running = { job, label: def.label, startedAt, params }

  // Long-running: fire-and-forget
  if (def.async === true) {
    def.run(params)
      .then((result) => recordRun({ job, label: def.label, startedAt, params, result }))
      .catch((err) => {
        console.error(`Admin ops job "${job}" failed:`, err)
        recordRun({ job, label: def.label, startedAt, params, error: err.message })
      })
      .finally(() => {
        state.running = null
      })

    return {
      ok: true,
      waited: false,
      job,
      label: def.label,
      startedAt,
      dryRun,
      message: 'Job started in background. Refresh status shortly.',
    }
  }

  // Default: wait for completion and return result + fresh counts
  try {
    const result = await def.run(params)
    recordRun({ job, label: def.label, startedAt, params, result })
    const counts = await getCatalogCounts()
    return {
      ok: true,
      waited: true,
      job,
      label: def.label,
      startedAt,
      finishedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
      dryRun,
      result,
      counts,
    }
  } catch (err) {
    console.error(`Admin ops job "${job}" failed:`, err)
    const result = err.deployResult || undefined
    recordRun({ job, label: def.label, startedAt, params, result, error: err.message })
    return {
      ok: false,
      status: 500,
      waited: true,
      job,
      label: def.label,
      dryRun,
      message: err.message || 'Job failed',
      result,
    }
  } finally {
    state.running = null
  }
}

/** @deprecated use runOpsJob */
function startOpsJob(job, params = {}) {
  return runOpsJob(job, params)
}

module.exports = {
  startOpsJob,
  runOpsJob,
  getOpsStatus,
  getJobDefinitions,
  getCatalogCounts,
}
