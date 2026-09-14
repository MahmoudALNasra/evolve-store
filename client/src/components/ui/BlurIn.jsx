import { motion, useReducedMotion } from 'framer-motion'
import { MOTION_DURATION, MOTION_EASE } from '@/lib/animation'

export default function BlurIn({
  children,
  delay = 0,
  duration = MOTION_DURATION,
  className = '',
  as: Tag = 'div',
}) {
  const reduced = useReducedMotion()
  const Component = motion[Tag] || motion.div
  // Soften blur — heavy filter anims often look stuck on mobile Safari
  const blurPx = 8
  const safeDelay = Math.min(Number(delay) || 0, 0.4)
  const safeDuration = Math.min(duration, 0.55)

  return (
    <Component
      className={className}
      initial={reduced ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: `blur(${blurPx}px)` }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{
        duration: reduced ? 0 : safeDuration,
        delay: reduced ? 0 : safeDelay,
        ease: MOTION_EASE,
      }}
    >
      {children}
    </Component>
  )
}
