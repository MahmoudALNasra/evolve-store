import FadeContent from './FadeContent'

export default function SectionTitle({
  title,
  subtitle,
  align = 'left',
  className = '',
}) {
  return (
    <FadeContent className={`ev-section-title ev-section-title--${align} ${className}`.trim()}>
      <h2 className="ev-section-title-text">{title}</h2>
      <span className="ev-section-title-accent" aria-hidden="true" />
      {subtitle && <p className="ev-section-title-sub">{subtitle}</p>}
    </FadeContent>
  )
}
