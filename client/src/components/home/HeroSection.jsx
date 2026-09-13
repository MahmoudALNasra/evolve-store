import { useEffect, useRef } from 'react'
import { ArrowRight, CheckCircle, ChevronDown } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import Aurora from '@/components/ui/Aurora'
import BlurIn from '@/components/ui/BlurIn'
import Button from '@/components/ui/Button'
import Logo from '@/components/Logo'
import ShipToBar from '@/components/ShipToBar'

const TRUST_ITEMS = [
  'Free shipping over $100',
  'Lab-tested quality',
  '30-day returns',
]

const HERO_COLOR_STOPS = ['#0a0a0a', '#C9A84C', '#1c1a14']

export default function HeroSection() {
  const reduced = useReducedMotion()
  const scrollHintRef = useRef(null)

  // Avoid setState on scroll — that re-rendered Hero and remounted Aurora (white flash).
  useEffect(() => {
    const onScroll = () => {
      const el = scrollHintRef.current
      if (!el) return
      el.style.opacity = window.scrollY < 100 ? '1' : '0'
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <section className="hero-section hero-section--aurora">
      <div className="hero-aurora-wrap">
        <Aurora
          colorStops={HERO_COLOR_STOPS}
          amplitude={1.15}
          blend={0.52}
          speed={0.85}
          className="hero-aurora"
        />
      </div>
      <div className="hero-bottom-fade" aria-hidden="true" />

      <div className="hero-inner">
        <BlurIn delay={0.02}>
          <ShipToBar />
        </BlurIn>

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
          <div ref={scrollHintRef} className="hero-scroll-hint" aria-hidden="true">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{
                y: { repeat: Infinity, duration: 1.8, ease: 'easeInOut' },
              }}
            >
              <ChevronDown size={24} />
            </motion.div>
          </div>
        )}
      </div>
    </section>
  )
}
