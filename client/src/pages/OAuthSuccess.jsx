import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '../store/useAuthStore'
import useCartStore from '../store/useCartStore'
import Spinner from '../components/ui/Spinner'

export default function OAuthSuccess() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { init } = useAuthStore()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      localStorage.setItem('token', token)
      init().then(() => {
        // Restore and merge guest cart after OAuth login
        const backupCart = localStorage.getItem('guest-cart-backup')
        console.log('📦 Backup cart after OAuth login:', backupCart)
        
        if (backupCart) {
          const items = JSON.parse(backupCart)
          console.log('🔄 Merging cart items (OAuth):', items)
          if (items.length > 0) {
            useCartStore.getState().mergeGuestCart(items)
            localStorage.removeItem('guest-cart-backup')
            console.log('✅ Cart merged successfully (OAuth)')
          }
        }
        
        // Check if there's a redirect parameter
        const redirect = searchParams.get('redirect') || '/'
        console.log('🔀 Redirecting to:', redirect)
        navigate(redirect)
      })
    } else {
      navigate('/login')
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
