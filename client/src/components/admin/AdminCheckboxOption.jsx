import FieldHint from './FieldHint'

export default function AdminCheckboxOption({ checked, onChange, label, hint }) {
  return (
    <label className="admin-checkbox-option">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="admin-checkbox-option__input"
      />
      <span className="admin-checkbox-option__label">{label}</span>
      {hint ? <FieldHint text={hint} /> : null}
    </label>
  )
}
