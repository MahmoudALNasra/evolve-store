import { getProductBrand } from './seoUtils'

/** Major brands → official site (authorized retailer backlinks). */
const BRAND_LINKS = [
  { pattern: /ortho\s*molecular/i, name: 'Ortho Molecular', url: 'https://www.orthomolecularproducts.com/' },
  { pattern: /designs\s*for\s*health/i, name: 'Designs for Health', url: 'https://www.designsforhealth.com/' },
  { pattern: /pure\s*encapsulations/i, name: 'Pure Encapsulations', url: 'https://www.pureencapsulations.com/' },
  { pattern: /metagenics/i, name: 'Metagenics', url: 'https://www.metagenics.com/' },
  { pattern: /thorne/i, name: 'Thorne', url: 'https://www.thorne.com/' },
  { pattern: /mason\s*natural/i, name: 'Mason Natural', url: 'https://www.masonnatural.com/' },
  { pattern: /nature'?s?\s*bounty/i, name: "Nature's Bounty", url: 'https://www.naturesbounty.com/' },
  { pattern: /nature\s*made/i, name: 'Nature Made', url: 'https://www.naturemade.com/' },
  { pattern: /garden\s*of\s*life/i, name: 'Garden of Life', url: 'https://www.gardenoflife.com/' },
  { pattern: /now\s*(foods|supplements)?/i, name: 'NOW Foods', url: 'https://www.nowfoods.com/' },
  { pattern: /life\s*extension/i, name: 'Life Extension', url: 'https://www.lifeextension.com/' },
  { pattern: /jarrow/i, name: 'Jarrow Formulas', url: 'https://jarrow.com/' },
  { pattern: /solgar/i, name: 'Solgar', url: 'https://www.solgar.com/' },
  { pattern: /country\s*life/i, name: 'Country Life', url: 'https://www.countrylifevitamins.com/' },
  { pattern: /bluebonnet/i, name: 'Bluebonnet Nutrition', url: 'https://www.bluebonnetnutrition.com/' },
  { pattern: /carlson/i, name: 'Carlson', url: 'https://www.carlsonlabs.com/' },
  { pattern: /nordic\s*natural/i, name: 'Nordic Naturals', url: 'https://www.nordic.com/' },
  { pattern: /gerber|gericare|geri-?care/i, name: 'Geri-Care', url: 'https://www.gericarepharma.com/' },
  { pattern: /major\s*(pharma|pharmaceuticals)?/i, name: 'Major Pharmaceuticals', url: 'https://www.majorpharmaceuticals.com/' },
  { pattern: /perrigo/i, name: 'Perrigo', url: 'https://www.perrigo.com/' },
  { pattern: /klaire\s*labs/i, name: 'Klaire Labs', url: 'https://klaire.com/' },
  { pattern: /allergy\s*research/i, name: 'Allergy Research Group', url: 'https://www.allergyresearchgroup.com/' },
  { pattern: /douglas\s*labor/i, name: 'Douglas Laboratories', url: 'https://www.douglaslabs.com/' },
  { pattern: /seeking\s*health/i, name: 'Seeking Health', url: 'https://www.seekinghealth.com/' },
  { pattern: /xymogen/i, name: 'Xymogen', url: 'https://www.xymogen.com/' },
]

export const STORE_NAME = 'Evolve Specialty Pharmacy & Wellness'

export function resolveBrandLink(product) {
  const brand = getProductBrand(product) || product?.brand || ''
  if (!brand) return null

  const match = BRAND_LINKS.find(({ pattern }) => pattern.test(brand))
  if (match) return match

  const fromName = BRAND_LINKS.find(({ pattern }) => pattern.test(product?.name || ''))
  return fromName || null
}

export function hasBrandBacklink(product) {
  return Boolean(resolveBrandLink(product))
}
