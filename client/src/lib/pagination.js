/**
 * Build page numbers with ellipsis for compact pagination UI.
 * @returns {(number|string)[]} page numbers and 'ellipsis' markers
 */
export function buildPaginationItems(currentPage, totalPages, { siblingCount = 1, boundaryCount = 1 } = {}) {
  if (totalPages <= 1) return []

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const items = []
  const start = Math.max(boundaryCount + 1, currentPage - siblingCount)
  const end = Math.min(totalPages - boundaryCount, currentPage + siblingCount)

  for (let p = 1; p <= Math.min(boundaryCount, totalPages); p += 1) {
    items.push(p)
  }

  if (start > boundaryCount + 1) {
    items.push('ellipsis')
  } else {
    for (let p = boundaryCount + 1; p < start; p += 1) {
      items.push(p)
    }
  }

  for (let p = start; p <= end; p += 1) {
    if (p > boundaryCount && p < totalPages - boundaryCount + 1) {
      items.push(p)
    }
  }

  if (end < totalPages - boundaryCount) {
    items.push('ellipsis')
  } else {
    for (let p = end + 1; p < totalPages - boundaryCount + 1; p += 1) {
      items.push(p)
    }
  }

  for (let p = Math.max(totalPages - boundaryCount + 1, boundaryCount + 1); p <= totalPages; p += 1) {
    if (!items.includes(p)) items.push(p)
  }

  return items
}

export function getPageRange(currentPage, pageSize, total) {
  if (total <= 0) return { start: 0, end: 0 }
  const start = (currentPage - 1) * pageSize + 1
  const end = Math.min(currentPage * pageSize, total)
  return { start, end }
}
