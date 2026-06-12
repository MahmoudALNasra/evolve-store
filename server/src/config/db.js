const mongoose = require('mongoose')
const Product = require('../models/Product')
const BlogArticle = require('../models/BlogArticle')

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing from server/.env')
    process.exit(1)
  }
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI)
    console.log(`MongoDB connected: ${conn.connection.host}`)
    await Product.syncIndexes()
    await BlogArticle.syncIndexes()
  } catch (err) {
    console.error('MongoDB connection failed:', err.message)
    if (err.message?.includes('slug_1') || err.message?.includes('dup key')) {
      console.error('Fix: from server/ run  npm run migrate:slugs  then restart the server.')
    }
    console.error('Check MONGO_URI in server/.env and ensure MongoDB is running (or Atlas is reachable).')
    process.exit(1)
  }
}

module.exports = connectDB
