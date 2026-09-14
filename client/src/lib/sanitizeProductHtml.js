/** Detect HTML-ish product copy (supplier feeds often send <p>/<ul>/<b>). */
export function looksLikeHtml(text) {
  return /<\/?[a-z][^>]*>/i.test(String(text || ''))
}

/**
 * Allowlist-sanitize product description HTML for safe rendering.
 * Admin/supplier content only — strips scripts, handlers, and unknown tags.
 */
export function sanitizeProductHtml(html) {
  const allowed = new Set([
    'P', 'BR', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U',
    'H2', 'H3', 'H4', 'H5', 'SPAN', 'A', 'DIV',
    'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
  ])

  const doc = new DOMParser().parseFromString(
    `<div id="root">${String(html || '')}</div>`,
    'text/html'
  )
  const root = doc.getElementById('root')
  if (!root) return ''

  const walk = (node) => {
    const children = [...node.childNodes]
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) continue
      if (child.nodeType !== Node.ELEMENT_NODE) {
        child.remove()
        continue
      }

      const tag = child.tagName
      if (!allowed.has(tag)) {
        // Keep text content of disallowed wrappers
        while (child.firstChild) node.insertBefore(child.firstChild, child)
        child.remove()
        continue
      }

      // Strip all attributes except safe href on anchors
      ;[...child.attributes].forEach((attr) => {
        const name = attr.name.toLowerCase()
        if (tag === 'A' && name === 'href') {
          const href = String(attr.value || '').trim()
          if (!/^(https?:|mailto:|\/|#)/i.test(href) || /^javascript:/i.test(href)) {
            child.removeAttribute(attr.name)
          } else {
            child.setAttribute('rel', 'noopener noreferrer')
            if (/^https?:/i.test(href)) child.setAttribute('target', '_blank')
          }
          return
        }
        child.removeAttribute(attr.name)
      })

      walk(child)
    }
  }

  walk(root)
  return root.innerHTML
}
