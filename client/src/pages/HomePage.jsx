import { useEffect, useState } from 'react'
import api from '../lib/api'
import SEO from '../components/SEO'
import HeroSection from '../components/home/HeroSection'
import BestSellers from '../components/home/BestSellers'
import CategoryGrid from '../components/home/CategoryGrid'
import TrustSection from '../components/home/TrustSection'

export default function HomePage() {
  const [featured, setFeatured] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/products?featured=true&limit=8'),
      api.get('/products/categories'),
    ])
      .then(([p, c]) => {
        setFeatured(p.data.products)
        setCategories(c.data.slice(0, 6))
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="home-page">
      <SEO
        title="Evolve Specialty Pharmacy & Wellness"
        description="Shop Evolve Specialty Pharmacy & Wellness for trusted vitamins, supplements, personal care, medical supplies, prescription refills, and wellness products with expert pharmacy support."
        path="/"
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
