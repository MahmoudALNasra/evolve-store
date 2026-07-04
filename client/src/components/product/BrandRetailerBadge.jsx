import { ShieldCheck } from 'lucide-react'
import { resolveBrandLink, STORE_NAME } from '../../lib/brandLinks'

export default function BrandRetailerBadge({ product }) {
  const brandLink = resolveBrandLink(product)
  if (!brandLink) return null

  return (
    <div className="product-retailer-badge" role="note">
      <div className="product-retailer-badge-seal" aria-hidden="true">
        <ShieldCheck size={22} strokeWidth={2.2} />
        <span className="product-retailer-badge-seal-ring">Authorized Retailer</span>
      </div>
      <p className="product-retailer-badge-text">
        {STORE_NAME} is an authorized retailer of{' '}
        <a
          href={brandLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="product-retailer-brand-link"
        >
          {brandLink.name}
        </a>{' '}
        products.
      </p>
    </div>
  )
}
