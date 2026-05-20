import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import useAuthStore from './store/useAuthStore'

// Layout
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { ProtectedRoute, AdminRoute } from './components/ProtectedRoute'
import ScrollToTop from './components/ScrollToTop'
import AdminLayout from './components/admin/AdminLayout'

// Storefront pages
import HomePage from './pages/HomePage'
import ShopPage from './pages/ShopPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OrdersPage from './pages/OrdersPage'
import OrderDetailsPage from './pages/OrderDetailsPage'
import AccountPage from './pages/AccountPage'
import OAuthSuccess from './pages/OAuthSuccess'
import OrderSuccessPage from './pages/OrderSuccessPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import RefillPrescriptionPage from './pages/RefillPrescriptionPage'
import TransferPrescriptionPage from './pages/TransferPrescriptionPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminProducts from './pages/admin/AdminProducts'
import AdminOrders from './pages/admin/AdminOrders'
import AdminUsers from './pages/admin/AdminUsers'
import AdminSettings from './pages/admin/AdminSettings'
import AdminPrescriptions from './pages/admin/AdminPrescriptions'

function StorefrontLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}

export default function App() {
  const init = useAuthStore((s) => s.init)

  useEffect(() => { init() }, [])

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Routes>
        {/* Auth pages (no layout) */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/oauth-success" element={<OAuthSuccess />} />
        <Route path="/order-success" element={<OrderSuccessPage />} />

        {/* Admin panel */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="prescriptions" element={<AdminPrescriptions />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Storefront */}
        <Route path="/" element={<StorefrontLayout><HomePage /></StorefrontLayout>} />
        <Route path="/shop" element={<StorefrontLayout><ShopPage /></StorefrontLayout>} />
        <Route path="/product/:id" element={<StorefrontLayout><ProductPage /></StorefrontLayout>} />
        <Route path="/cart" element={<StorefrontLayout><CartPage /></StorefrontLayout>} />
        <Route path="/checkout" element={<StorefrontLayout><ProtectedRoute><CheckoutPage /></ProtectedRoute></StorefrontLayout>} />
        <Route path="/orders" element={<StorefrontLayout><ProtectedRoute><OrdersPage /></ProtectedRoute></StorefrontLayout>} />
        <Route path="/orders/:id" element={<StorefrontLayout><ProtectedRoute><OrderDetailsPage /></ProtectedRoute></StorefrontLayout>} />
        <Route path="/account" element={<StorefrontLayout><ProtectedRoute><AccountPage /></ProtectedRoute></StorefrontLayout>} />
        <Route path="/privacy-policy" element={<StorefrontLayout><PrivacyPolicyPage /></StorefrontLayout>} />
        <Route path="/refill-prescription" element={<StorefrontLayout><RefillPrescriptionPage /></StorefrontLayout>} />
        <Route path="/transfer-prescription" element={<StorefrontLayout><TransferPrescriptionPage /></StorefrontLayout>} />

        {/* 404 */}
        <Route path="*" element={
          <StorefrontLayout>
            <div className="flex flex-col items-center justify-center py-32 text-gray-400">
              <p className="text-6xl font-extrabold text-gray-200 mb-4">404</p>
              <p className="text-lg font-medium text-gray-500">Page not found</p>
              <a href="/" className="mt-4 text-indigo-600 hover:underline text-sm">Back to Home</a>
            </div>
          </StorefrontLayout>
        } />
      </Routes>
    </BrowserRouter>
  )
}
