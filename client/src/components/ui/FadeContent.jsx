import { motion, useReducedMotion } from 'framer-motion'
import useInView from '@/hooks/useInView'
import { MOTION_DURATION, MOTION_EASE } from '@/lib/animation'

const OFFSETS = {
  up: { y: 20, x: 0 },
  down: { y: -20, x: 0 },
  left: { x: 16, y: 0 },
  right: { x: -16, y: 0 },
  none: { x: 0, y: 0 },
}

export default function FadeContent({
  children,
  direction = 'up',
  delay = 0,
  duration = MOTION_DURATION,
  className = '',
  threshold = 0.01,
}) {
  const reduced = useReducedMotion()
  // Generous rootMargin so mobile cards animate as they approach the viewport
  // (negative bottom margin previously left phone cards stuck at opacity 0).
  const [ref, inView] = useInView({
    threshold,
    once: true,
    rootMargin: '140px 0px 100px 0px',
  })
  const offset = OFFSETS[direction] || OFFSETS.up
  const safeDelay = Math.min(Number(delay) || 0, 0.2)

  return (
    <motion.div
      ref={ref}
      className={`fade-content${className ? ` ${className}` : ''}`}
      initial={
        reduced
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, x: offset.x, y: offset.y }
      }
      animate={
        inView || reduced
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, x: offset.x, y: offset.y }
      }
      transition={{
        duration: reduced ? 0 : Math.min(duration, 0.5),
        delay: reduced ? 0 : safeDelay,
        ease: MOTION_EASE,
      }}
    >
      {children}
    </motion.div>
  )
}
