export default function Spinner({ size = 'md' }) {
  const cls = size === 'sm' ? 'spinner spinner-sm' : size === 'lg' ? 'spinner spinner-lg' : 'spinner spinner-md'
  return <div className={cls} />
}
