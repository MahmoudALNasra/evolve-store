const Product = require('../models/Product')
const Review = require('../models/Review')

async function syncProductRating(productId) {
  const stats = await Review.aggregate([
    { $match: { product: productId } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ])

  const avgRating = stats[0]?.avgRating || 0
  const count = stats[0]?.count || 0

  await Product.findByIdAndUpdate(productId, {
    rating: count ? Math.round(avgRating * 10) / 10 : 0,
    numReviews: count,
  })

  return { rating: avgRating, numReviews: count }
}

module.exports = { syncProductRating }
