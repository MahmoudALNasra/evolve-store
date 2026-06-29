import FieldHint from './FieldHint'

export default function AdminFieldLabel({ children, hint, htmlFor, required = false }) {
  return (
    <label htmlFor={htmlFor} className="admin-field-label">
      <span>
        {children}
        {required ? ' *' : ''}
      </span>
      {hint ? <FieldHint text={hint} /> : null}
    </label>
  )
}
