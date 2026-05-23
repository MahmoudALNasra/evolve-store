import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import useCartStore from '../store/useCartStore'
import api from '../lib/api'

export default function OrderSuccessPage() {
  const [searchParams] = useSearchParams()
  const clearCart = useCartStore((s) => s.clearCart)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    // Don't clear cart immediately - verify order exists first
    const sessionId = searchParams.get('session_id')
    
    if (!cleared && sessionId) {
      console.log('✅ Order success page loaded, session:', sessionId)

      const timer = setTimeout(async () => {
        // Clear first so a failed verification cannot leave paid items in cart.
        clearCart()
        setCleared(true)

        // Verifies Stripe session and fulfills order/email if local webhook was missed.
        for (let attempt = 1; attempt <= 6; attempt += 1) {
          try {
            const { data } = await api.get(`/checkout/session/${sessionId}`, { skipAuthRedirect: true })
            if (data?.isPaid) break
          } catch (err) {
            console.warn(`Order verification attempt ${attempt} failed:`, err.response?.data?.message || err.message)
          }

          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
        console.log('🗑️ Cart cleared after order success')
      }, 2000) // 2 second delay to allow webhook to process

      return () => clearTimeout(timer)
    } else if (!cleared && !sessionId) {
      // No session ID, still clear cart (user navigated here directly)
      clearCart()
      setCleared(true)
    }
  }, [clearCart, cleared, searchParams])

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '24px',
      background: '#f9fafb'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        padding: '48px 40px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: 'linear-gradient(135deg, #d1f4e0 0%, #a7e9c5 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px'
        }}>
          <CheckCircle size={40} style={{ color: '#2d7a3a', strokeWidth: 2.5 }} />
        </div>
        
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1a1a1a',
          marginBottom: '12px',
          letterSpacing: '-0.02em'
        }}>
          Order Confirmed!
        </h1>
        
        <p style={{
          color: '#6b7280',
          fontSize: '15px',
          lineHeight: '1.6',
          marginBottom: '32px'
        }}>
          Thank you for your purchase. You'll receive a confirmation email shortly.
        </p>
        
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '12px',
          marginTop: '32px'
        }}>
          <Link to="/orders" className="btn-primary" style={{ justifyContent: 'center' }}>
            View My Orders
          </Link>
          <Link 
            to="/shop"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 24px',
              fontSize: '15px',
              fontWeight: '600',
              color: '#4b5563',
              background: 'transparent',
              border: '1.5px solid #d1d5db',
              borderRadius: '10px',
              textDecoration: 'none',
              transition: 'all 0.18s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#f9fafb'
              e.target.style.borderColor = '#9ca3af'
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'transparent'
              e.target.style.borderColor = '#d1d5db'
            }}
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
