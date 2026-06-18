import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const variants = {
  primary: 'ev-btn ev-btn-primary',
  outline: 'ev-btn ev-btn-outline',
  ghost: 'ev-btn ev-btn-ghost',
}

export default function Button({
  children,
  variant = 'primary',
  to,
  href,
  className,
  type = 'button',
  ...props
}) {
  const classes = cn(variants[variant] || variants.primary, className)

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    )
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  )
}
