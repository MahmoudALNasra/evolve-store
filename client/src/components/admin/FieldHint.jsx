export default function FieldHint({ text }) {
  if (!text) return null

  return (
    <span className="field-hint" tabIndex={0} aria-label={text}>
      <span className="field-hint__icon" aria-hidden="true">?</span>
      <span className="field-hint__tooltip" role="tooltip">
        {text}
      </span>
    </span>
  )
}
