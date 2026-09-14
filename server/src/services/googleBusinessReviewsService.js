const axios = require('axios')

function getMapsApiKey() {
  return String(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || '').trim()
}

function getPlaceId() {
  return String(process.env.GOOGLE_PLACE_ID || '').trim()
}

function getMapsShareUrl() {
  return String(
    process.env.GOOGLE_MAPS_SHARE_URL
      || process.env.GOOGLE_BUSINESS_URL
      || 'https://share.google/RLz2KuwpRoi58Qmr2'
  ).trim()
}

async function resolvePlaceId(key) {
  const configured = getPlaceId()
  if (configured) return configured

  const query = process.env.GOOGLE_PLACE_QUERY
    || 'Evolve Specialty Pharmacy & Wellness 19239 Stone Oak Pkwy San Antonio TX 78258'

  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/findplacefromtext/json', {
    params: {
      input: query,
      inputtype: 'textquery',
      fields: 'place_id,name,formatted_address',
      key,
    },
    timeout: 10000,
  })

  const placeId = data.candidates?.[0]?.place_id
  if (!placeId) {
    const err = new Error(data.error_message || `Could not resolve Google Place ID (${data.status})`)
    err.code = data.status
    throw err
  }
  return placeId
}

/**
 * Fetch Google Business Profile reviews via Places Details API.
 * Share link used for CTA: https://share.google/RLz2KuwpRoi58Qmr2
 */
async function getBusinessReviews({ maxReviews = 6 } = {}) {
  const key = getMapsApiKey()
  const mapsUrl = getMapsShareUrl()

  if (!key) {
    return {
      configured: false,
      mapsUrl,
      rating: null,
      userRatingsTotal: null,
      name: 'Evolve Specialty Pharmacy & Wellness',
      reviews: [],
      message: 'Set GOOGLE_MAPS_API_KEY (and optionally GOOGLE_PLACE_ID) to load live Google reviews',
    }
  }

  const placeId = await resolvePlaceId(key)

  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
    params: {
      place_id: placeId,
      fields: 'name,rating,user_ratings_total,url,reviews',
      reviews_sort: 'most_relevant',
      key,
    },
    timeout: 10000,
  })

  if (data.status !== 'OK' || !data.result) {
    const err = new Error(data.error_message || `Places details failed: ${data.status}`)
    err.code = data.status
    throw err
  }

  const result = data.result
  const reviews = (result.reviews || [])
    .slice(0, maxReviews)
    .map((r) => ({
      authorName: r.author_name,
      authorUrl: r.author_url || '',
      profilePhotoUrl: r.profile_photo_url || '',
      rating: r.rating,
      relativeTime: r.relative_time_description,
      text: r.text || '',
      time: r.time,
    }))

  return {
    configured: true,
    placeId,
    mapsUrl: result.url || mapsUrl,
    rating: result.rating ?? null,
    userRatingsTotal: result.user_ratings_total ?? null,
    name: result.name || 'Evolve Specialty Pharmacy & Wellness',
    reviews,
  }
}

module.exports = {
  getBusinessReviews,
  getMapsShareUrl,
  getPlaceId,
  resolvePlaceId,
}
