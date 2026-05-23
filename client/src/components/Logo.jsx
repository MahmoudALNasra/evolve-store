import { Link } from 'react-router-dom'

/**
 * Brand logo — gold emblem on transparent (use on light or dark backgrounds).
 */
export default function Logo({ size = 44, showText = true, className = '', to = '/' }) {
  const img = (
    <img
      src="/logo.png"
      alt="Evolve Specialty Pharmacy & Wellness"
      width={size}
      height={size}
      className={`brand-logo-img${className ? ` ${className}` : ''}`}
    />
  )

  if (!showText) {
    return to ? <Link to={to} className="brand-logo brand-logo-icon-only">{img}</Link> : img
  }

  return (
    <Link to={to} className={`brand-logo${className ? ` ${className}` : ''}`}>
      {img}
      <div className="brand-logo-text">
        <div className="brand-logo-title">Evolve Specialty<span>Pharmacy &amp; Wellness</span></div>
      </div>
    </Link>
  )
}
