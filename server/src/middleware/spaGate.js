const path = require('path')
const fs = require('fs')

/**
 * Only mount SPA + prerender stack when dist exists or SERVE_SPA=true.
 */
function shouldServeSpa() {
  if (process.env.SERVE_SPA === 'true') return true
  if (process.env.SERVE_SPA === 'false') return false
  if (process.env.NODE_ENV === 'production') return true
  const distIndex = path.join(__dirname, '../../../client/dist/index.html')
  return fs.existsSync(distIndex)
}

function getClientDistPath() {
  return path.resolve(
    process.env.CLIENT_DIST_PATH ||
      path.join(__dirname, '../../../client/dist')
  )
}

module.exports = { shouldServeSpa, getClientDistPath }
