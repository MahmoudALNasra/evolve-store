import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle, ChevronDown } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import Aurora from '@/components/ui/Aurora'
import BlurIn from '@/components/ui/BlurIn'
import Button from '@/components/ui/Button'
import Logo from '@/components/Logo'

const TRUST_ITEMS = [
  'Free shipping over $100',
  'Lab-tested quality',
  '30-day returns',
]

export default function HeroSection() {
  const reduced = useReducedMotion()
  const [showScrollHint, setShowScrollHint] = useState(true)

  useEffect(() => {
    const onScroll = () => setShowScrollHint(window.scrollY < 100)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className="hero-section hero-section--aurora">
      <div className="hero-aurora-wrap">
        <Aurora
          colorStops={['#0a0a0a', '#C9A84C', '#1c1a14']}
          amplitude={1.15}
          blend={0.52}
          speed={0.85}
          className="hero-aurora"
        />
      </div>
      <div className="hero-bottom-fade" aria-hidden="true" />

      <div className="hero-inner">
        <BlurIn delay={0.05}>
          <Logo size={120} showText={false} to="/" className="hero-logo" />
        </BlurIn>

        <BlurIn delay={0.15}>
          <div className="hero-badge">
            <span className="hero-badge-star" aria-hidden="true">✦</span>
            100% Natural &amp; Lab Tested
          </div>
        </BlurIn>

        <BlurIn delay={0.25}>
          <h1 className="hero-title">
            Fuel Your Best
            <br />
            <span>Self Every Day</span>
          </h1>
        </BlurIn>

        <BlurIn delay={0.35}>
          <p className="hero-subtitle">
            Premium vitamins, supplements &amp; wellness products — crafted to support your health goals naturally.
          </p>
        </BlurIn>

        <BlurIn delay={0.45}>
          <div className="hero-cta-row">
            <Button to="/shop" variant="primary" className="hero-cta-primary">
              Shop All Products <ArrowRight size={16} aria-hidden="true" />
            </Button>
            <Button to="/shop?featured=true" variant="outline">
              Best Sellers
            </Button>
          </div>
        </BlurIn>

        <BlurIn delay={0.55}>
          <div className="hero-trust-block">
            <div className="hero-trust">
              {TRUST_ITEMS.map((t) => (
                <span key={t} className="hero-trust-item">
                  <CheckCircle size={14} aria-hidden="true" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </BlurIn>

        {!reduced && (
          <motion.div
            className="hero-scroll-hint"
            animate={{ y: [0, 8, 0], opacity: showScrollHint ? 1 : 0 }}
            transition={{
              y: { repeat: Infinity, duration: 1.8, ease: 'easeInOut' },
              opacity: { duration: 0.25 },
            }}
            aria-hidden={!showScrollHint}
          >
            <ChevronDown size={24} />
          </motion.div>
        )}
      </div>
    </section>
  )
}
