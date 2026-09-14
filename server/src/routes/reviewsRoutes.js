const express = require('express')
const { getBusinessReviews, getMapsShareUrl } = require('../services/googleBusinessReviewsService')

const router = express.Router()

// GET /api/reviews/google — public Google Business reviews for homepage
router.get('/google', async (req, res) => {
  try {
    const data = await getBusinessReviews({ maxReviews: Number(req.query.limit) || 6 })
    res.json(data)
  } catch (err) {
    console.error('Google reviews error:', err.message)
    res.status(502).json({
      configured: false,
      mapsUrl: getMapsShareUrl(),
      rating: null,
      userRatingsTotal: null,
      name: 'Evolve Specialty Pharmacy & Wellness',
      reviews: [],
      message: err.message || 'Could not load Google reviews',
    })
  }
})

module.exports = router
