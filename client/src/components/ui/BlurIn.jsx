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

  return (
    <Component
      className={className}
      initial={reduced ? { opacity: 1, filter: 'blur(0px)' } : { opacity: 0, filter: 'blur(14px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: reduced ? 0 : duration, delay: reduced ? 0 : delay, ease: MOTION_EASE }}
    >
      {children}
    </Component>
  )
}
