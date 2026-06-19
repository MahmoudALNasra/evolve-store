import { useEffect, useState } from 'react'
import api from '../lib/api'
import SEO from '../components/SEO'
import HeroSection from '../components/home/HeroSection'
import BestSellers from '../components/home/BestSellers'
import CategoryGrid from '../components/home/CategoryGrid'
import TrustSection from '../components/home/TrustSection'

async function fetchBestSellers() {
  const featuredRes = await api.get('/products', {
    params: { featured: true, limit: 8 },
  })
  if (featuredRes.data.products?.length > 0) {
    return featuredRes.data.products
  }
  const recentRes = await api.get('/products', {
    params: { limit: 8, sort: '-createdAt' },
  })
  return recentRes.data.products || []
}

export default function HomePage() {
  const [featured, setFeatured] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      fetchBestSellers(),
      api.get('/products/categories'),
    ])
      .then(([products, categoriesRes]) => {
        if (cancelled) return
        setFeatured(products)
        setCategories(categoriesRes.data.slice(0, 6))
      })
      .catch(() => {
        if (!cancelled) {
          setFeatured([])
          setCategories([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="home-page">
      <SEO
        title="Evolve Specialty Pharmacy & Wellness"
        description="Shop Evolve Specialty Pharmacy & Wellness for trusted vitamins, supplements, personal care, medical supplies, prescription refills, and wellness products with expert pharmacy support."
        path="/"
        includeWebSiteSchema
        keywords={[
          'specialty pharmacy',
          'wellness pharmacy',
          'vitamins and supplements',
          'prescription refills',
          'pharmacy delivery',
          'health and wellness products',
          'medical supplies',
          'Evolve Specialty Pharmacy',
        ]}
      />
      <HeroSection />
      <BestSellers products={featured} loading={loading} />
      <CategoryGrid categories={categories} loading={loading} />
      <TrustSection />
    </div>
  )
}
