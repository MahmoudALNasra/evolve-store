/**
 * Google Shopping product-data rules that affect click potential:
 * https://support.google.com/merchants/answer/6324415 (title)
 * https://support.google.com/merchants/answer/6324468 (description)
 * https://support.google.com/merchants/answer/6324436 (product category)
 *
 * Title: brand first, then product and variant (size/count), max 150,
 * no promotional text, no leading internal SKU, not ALL CAPS.
 * Description: plain text, no HTML, max 5000.
 */

const TITLE_MAX = 150
const DESC_MAX = 5000
const HIGHLIGHT_MAX = 150

const TAXONOMY = [
  { pattern: /\b(skin|cream|serum|lotion|moistur|wrinkle|retinol|hyaluronic|eye serum)\b/i, category: 'Health & Beauty > Personal Care > Cosmetics > Skin Care' },
  { pattern: /\b(tooth|dental|mouthwash|floss|oral)\b/i, category: 'Health & Beauty > Personal Care > Oral Care' },
  { pattern: /\b(bandage|gauze|first aid|antiseptic|stockings?|compression)\b/i, category: 'Health & Beauty > Health Care > First Aid' },
  { pattern: /\b(shampoo|soap|deodorant|body wash|hand mask|gloves?)\b/i, category: 'Health & Beauty > Personal Care' },
  { pattern: /\b(vitamin|supplement|mineral|probiotic|turmeric|zinc|magnesium|melatonin|omega|fish oil|biotin|quercetin|herbal)\b/i, category: 'Health & Beauty > Health Care > Fitness & Nutrition > Vitamins & Supplements' },
  { pattern: /\b(pain|ibuprofen|acetaminophen|aspirin|naproxen|advil|arthritis)\b/i, category: 'Health & Beauty > Health Care' },
  { pattern: /\b(cough|cold|flu|congestion|throat|decongestant)\b/i, category: 'Health & Beauty > Health Care' },
  { pattern: /\b(allergy|sinus|antihistamine|loratadine|cetirizine|nasal)\b/i, category: 'Health & Beauty > Health Care' },
  { pattern: /\b(laxative|digest|stomach|heartburn|antacid|constipation)\b/i, category: 'Health & Beauty > Health Care' },
  { pattern: /\b(nicotine|transdermal)\b/i, category: 'Health & Beauty > Health Care' },
]

function collapseSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function stripHtml(value) {
  return collapseSpace(
    String(value || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/p>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
  )
}

function stripPromo(value) {
  let text = stripHtml(value)
  let previous
  do {
    previous = text
    text = text.replace(/^\((?:new|sale|hot|clearance|best\s*seller)\)\s*/i, '')
    text = text.replace(/^(?:brand\s+new|new!|sale|hot deal|free shipping)\s*[-:]*\s*/i, '')
  } while (text !== previous)
  text = text.replace(/\b(free shipping|best seller|on sale|limited time|buy now|shop now|order now|click here)\b/gi, ' ')
  text = collapseSpace(text)
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\b(for|with|and|or)\b\s*[.!,]?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,|\-–—]+\s*/, '')
    .replace(/[.!,;:\s]+$/, '')
  return collapseSpace(text)
}

function softenAllCaps(text) {
  const letters = text.replace(/[^A-Za-z]/g, '')
  if (letters.length < 8) return text
  const upper = letters.replace(/[^A-Z]/g, '').length
  if (upper / letters.length < 0.7) return text
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase())
    .replace(/\bMg\b/g, 'mg')
    .replace(/\bMcg\b/g, 'mcg')
    .replace(/\bMl\b/g, 'mL')
    .replace(/\bOz\b/g, 'oz')
    .replace(/\bIu\b/g, 'IU')
}

function stripLeadingSku(title) {
  return title.replace(/^\d{5,}\s+(?=[A-Za-z])/, '')
}

function ensureBrandFirst(title, brand) {
  const name = collapseSpace(brand)
  if (!name || name.length < 2) return title
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (new RegExp(`^${escaped}\\b`, 'i').test(title)) return title
  if (new RegExp(escaped, 'i').test(title)) {
    const rest = collapseSpace(title.replace(new RegExp(escaped, 'i'), ''))
      .replace(/^[\s,|\-–—]+/, '')
    return collapseSpace(`${name} ${rest}`)
  }
  return collapseSpace(`${name} ${title}`)
}

function trimAtWord(text, max) {
  const clean = collapseSpace(text)
  if (clean.length <= max) return clean
  const slice = clean.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  const cut = (lastSpace > Math.floor(max * 0.6) ? slice.slice(0, lastSpace) : slice).trim()
  return cut.replace(/[,:|\-–—]+$/, '').trim()
}

function buildShoppingTitle({ title, brand }) {
  const cleaned = softenAllCaps(stripLeadingSku(stripPromo(title)))
  return trimAtWord(ensureBrandFirst(cleaned, brand), TITLE_MAX)
}

function buildShoppingDescription({ description, title, brand }) {
  let text = stripPromo(description)
  const lead = collapseSpace(title || brand)
  if (text.length < 40) {
    const extra = text && !lead.toLowerCase().includes(text.toLowerCase()) ? text : ''
    text = collapseSpace(`${lead}. ${extra}`)
  }
  return trimAtWord(text, DESC_MAX)
}

function buildProductHighlight(title) {
  const match = collapseSpace(title).match(
    /\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|oz|fl oz|iu|ct|count|capsules?|tablets?|patches|softgels?|caplets?)\b/i
  )
  if (!match) return ''
  const phrase = match[0].replace(/\b([A-Z]{3,})\b/g, (word) => word.toLowerCase())
  return trimAtWord(phrase, HIGHLIGHT_MAX)
}

function matchTaxonomy(text) {
  const match = TAXONOMY.find((rule) => rule.pattern.test(String(text || '')))
  return match ? match.category : ''
}

function googleProductCategory(parts) {
  const [title, brand, description, category] = parts
  return (
    matchTaxonomy(`${title || ''} ${brand || ''} ${category || ''}`)
    || matchTaxonomy(description)
    || 'Health & Beauty > Health Care'
  )
}

function toShoppingListing(row) {
  const title = buildShoppingTitle(row)
  const description = buildShoppingDescription({
    description: row.description,
    title,
    brand: row.brand,
  })
  return {
    title,
    description,
    productHighlight: buildProductHighlight(title),
    googleProductCategory: googleProductCategory([title, row.brand, description, row.category]),
  }
}

module.exports = {
  TITLE_MAX,
  DESC_MAX,
  buildShoppingTitle,
  buildShoppingDescription,
  buildProductHighlight,
  googleProductCategory,
  toShoppingListing,
  stripHtml,
}
