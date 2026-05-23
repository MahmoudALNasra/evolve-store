import { useEffect, useRef, useState } from 'react'

/**
 * Fires once when the element enters the viewport (with optional rootMargin prefetch).
 */
export default function useInView(options = {}) {
  const { rootMargin = '200px 0px', threshold = 0, once = true } = options
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || (once && inView)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.disconnect()
        } else if (!once) {
          setInView(false)
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rootMargin, threshold, once, inView])

  return [ref, inView]
}
