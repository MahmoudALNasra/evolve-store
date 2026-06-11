import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle, Leaf, FlaskConical, Heart, Dumbbell, Brain, Apple } from 'lucide-react'
import api from '../lib/api'
import ProductCard from '../components/ProductCard'
import Spinner from '../components/ui/Spinner'
import Logo from '../components/Logo'
import SEO from '../components/SEO'

const CATEGORY_ICONS = {
  Vitamins: <Apple size={20} />,
  Supplements: <FlaskConical size={20} />,
  Fitness: <Dumbbell size={20} />,
  Wellness: <Heart size={20} />,
  Nutrition: <Leaf size={20} />,
  'Mental Health': <Brain size={20} />,
}

export default function HomePage() {
  const [featured, setFeatured] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/products?featured=true&limit=8'),
      api.get('/products/categories'),
    ]).then(([p, c]) => {
      setFeatured(p.data.products)
      setCategories(c.data.slice(0, 6))
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div>
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
      {/* Hero */}
      <section className="hero-section">
        <div className="hero-inner">
          <Logo size={120} showText={false} to="/" className="hero-logo" />
          <div className="hero-badge"><Leaf size={13} /> 100% Natural &amp; Lab Tested</div>
          <h1 className="hero-title">
            Fuel Your Best<br /><span>Self Every Day</span>
          </h1>
          <p className="hero-subtitle">
            Premium vitamins, supplements &amp; wellness products — crafted to support your health goals naturally.
          </p>
          <div className="hero-cta-row">
            <Link to="/shop" className="btn-primary">Shop All Products <ArrowRight size={16} /></Link>
            <Link to="/shop?featured=true" className="btn-outline">Best Sellers</Link>
          </div>
          <div className="hero-trust">
            {['Free shipping over $100', 'Lab-tested quality', '30-day returns'].map((t) => (
              <span key={t} className="hero-trust-item"><CheckCircle size={14} /> {t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section style={{ padding: '64px 0' }}>
          <div className="container">
            <div className="section-header">
              <div>
                <div className="section-title">Shop by Category</div>
                <div className="section-subtitle">Find exactly what your body needs</div>
              </div>
              <Link to="/shop" className="section-link">View all <ArrowRight size={14} /></Link>
            </div>
            <div className="category-grid">
              {categories.map((cat) => (
                <Link key={cat} to={`/shop?category=${encodeURIComponent(cat)}`} className="category-card">
                  <div className="category-card-icon">{CATEGORY_ICONS[cat] ?? <Leaf size={20} />}</div>
                  <span className="category-card-name">{cat}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section style={{ paddingBottom: '72px' }}>
        <div className="container">
          <div className="section-header">
            <div>
              <div className="section-title">Best Sellers</div>
              <div className="section-subtitle">Top-rated by our community</div>
            </div>
            <Link to="/shop?featured=true" className="section-link">View all <ArrowRight size={14} /></Link>
          </div>
          {loading ? (
            <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
          ) : featured.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#aaa', padding: '80px 0' }}>No featured products yet.</p>
          ) : (
            <div className="products-grid">
              {featured.map((p) => <ProductCard key={p._id} product={p} />)}
            </div>
          )}
        </div>
      </section>

      {/* Why Us */}
      <section className="why-section">
        <div className="why-inner">
          <div style={{ textAlign: 'center' }}>
            <div className="section-title">Why Choose Evolve Specialty Pharmacy & Wellness?</div>
            <div className="section-subtitle" style={{ marginTop: 6 }}>We take your health seriously</div>
          </div>
          <div className="why-grid">
            {[
              { icon: <FlaskConical size={24} />, title: 'Lab Tested', desc: 'Every product is independently tested for purity and potency.' },
              { icon: <Leaf size={24} />, title: 'Natural Ingredients', desc: 'No artificial fillers — clean formulas you can trust.' },
              { icon: <CheckCircle size={24} />, title: 'GMP Certified', desc: 'Manufactured in certified facilities for the highest standards.' },
              { icon: <Heart size={24} />, title: 'Expert Formulas', desc: 'Developed with nutritionists and health professionals.' },
            ].map((f) => (
              <div key={f.title} className="why-item">
                <div className="why-icon">{f.icon}</div>
                <div className="why-title">{f.title}</div>
                <div className="why-desc">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
