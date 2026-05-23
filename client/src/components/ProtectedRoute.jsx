import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'

export function ProtectedRoute({ children }) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const initialized = useAuthStore((s) => s.initialized)
  if (token && !initialized) {
    return <div className="spinner-wrap" style={{ minHeight: '60vh' }}><div className="spinner spinner-lg" /></div>
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const initialized = useAuthStore((s) => s.initialized)
  if (token && !initialized) {
    return <div className="spinner-wrap" style={{ minHeight: '60vh' }}><div className="spinner spinner-lg" /></div>
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return children
}
