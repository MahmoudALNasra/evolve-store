const { getWebsiteCategory } = require('./inventoryMapper')

/** Rule categories that are not in the Category collection — map to closest store category. */
const RULE_FALLBACKS = {
  'Pain Relief': 'Medicine & Drugs',
  'Baby & Child Care': 'Personal Care',
  'Diabetes Care': 'Medical Supplies',
}

/** Generic import/review categories → store category names. */
const LEGACY_IMPORT_MAP = {
  Wellness: 'Health & Wellness',
  'Over-the-Counter': 'Over-the-Counter',
  'Medical Supplies': 'Medical Supplies',
  'Personal Care': 'Personal Care',
  'Vitamins & Supplements': 'Vitamins & Supplements',
  Uncategorized: null,
}

/** Extra patterns for barcode-imported products (checked before sheet mapper). */
const EXTRA_CATEGORY_RULES = [
  { category: 'Skin Care', pattern: /\b(lip balm|lip care|moisturiz(?:ing|er)|hydrocortisone|eczema|acne|collagen cream|skin cream|derma|sunscreen|sunblock|propolis.*lip)\b/i },
  { category: 'Oral Care', pattern: /\b(toothpaste|sensodyne|mouthwash|denture|dental floss|efferdent|oral care)\b/i },
  { category: 'First Aid', pattern: /\b(alcohol prep|bandage|gauze|antiseptic|hand sanitizer|germ-x|curad|first aid|wound care)\b/i },
  { category: 'Respiratory Care', pattern: /\b(nebulizer|inhaler|respiratory|pulse oximeter|oxygen)\b/i },
  { category: 'Incontinence Aids', pattern: /\b(incontinence|adult diaper|protective underwear)\b/i },
  { category: 'Digestive Health', pattern: /\b(laxative|stool softener|enema|antacid|probiotic|digestive|senna|docusate)\b/i },
  { category: 'Eye & Ear Care', pattern: /\b(eye drop|ear drop|contact lens solution|vision care)\b/i },
  { category: 'Medicine & Drugs', pattern: /\b(otc|over-the-counter|hydrocortisone|test strip|urinary tract|pain relief|ibuprofen|acetaminophen)\b/i },
  { category: 'Health & Beauty', pattern: /\b(shampoo|conditioner|hair care|body wash|deodorant|cosmetic|beauty cream)\b/i },
  { category: 'Medical Supplies', pattern: /\b(pill organizer|pill planner|blood pressure|thermometer|grab bar|toilet seat cushion|bath stool|walker|crutch|compression)\b/i },
]

function buildHaystack(product) {
  return [
    product.name,
    product.brand,
    product.description,
    product.category,
    ...(product.tags || []),
  ].filter(Boolean).join(' ')
}

function pickAllowedCategory(name, allowedSet) {
  const mapped = RULE_FALLBACKS[name] || LEGACY_IMPORT_MAP[name] || name
  if (mapped && allowedSet.has(mapped)) return mapped
  return null
}

function resolveProductStoreCategory(product, allowedNames) {
  const allowedSet = new Set(allowedNames)
  const haystack = buildHaystack(product)

  for (const rule of EXTRA_CATEGORY_RULES) {
    if (rule.pattern.test(haystack)) {
      const picked = pickAllowedCategory(rule.category, allowedSet)
      if (picked) return { category: picked, source: 'extra-rule' }
    }
  }

  const fromSheetRules = getWebsiteCategory({
    Name: product.name,
    Brand: product.brand || '',
    'Desc.': product.description || '',
    'Google Category': product.category || '',
    'Website Category': '',
  })

  const fromRules = pickAllowedCategory(fromSheetRules, allowedSet)
  if (fromRules) return { category: fromRules, source: 'inventory-rules' }

  const fromLegacy = pickAllowedCategory(product.category, allowedSet)
  if (fromLegacy && product.category !== 'Uncategorized') {
    return { category: fromLegacy, source: 'legacy' }
  }

  return { category: null, source: 'unresolved' }
}

module.exports = {
  resolveProductStoreCategory,
  EXTRA_CATEGORY_RULES,
  RULE_FALLBACKS,
  LEGACY_IMPORT_MAP,
}
