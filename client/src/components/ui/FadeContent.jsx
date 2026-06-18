import { motion, useReducedMotion } from 'framer-motion'
import useInView from '@/hooks/useInView'
import { MOTION_DURATION, MOTION_EASE } from '@/lib/animation'

const OFFSETS = {
  up: { y: 28, x: 0 },
  down: { y: -28, x: 0 },
  left: { x: 28, y: 0 },
  right: { x: -28, y: 0 },
  none: { x: 0, y: 0 },
}

export default function FadeContent({
  children,
  direction = 'up',
  delay = 0,
  duration = MOTION_DURATION,
  className = '',
  threshold = 0.12,
}) {
  const reduced = useReducedMotion()
  const [ref, inView] = useInView({ threshold, once: true, rootMargin: '0px 0px -40px 0px' })
  const offset = OFFSETS[direction] || OFFSETS.up

  return (
    <motion.div
      ref={ref}
      className={className}
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
        duration: reduced ? 0 : duration,
        delay: reduced ? 0 : delay,
        ease: MOTION_EASE,
      }}
    >
      {children}
    </motion.div>
  )
}
