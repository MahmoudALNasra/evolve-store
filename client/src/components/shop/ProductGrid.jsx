import ProductCard from './ProductCard'
import FadeContent from '@/components/ui/FadeContent'

export default function ProductGrid({ products = [] }) {
  if (!products.length) return null

  return (
    <div className="products-grid">
      {products.map((product, i) => (
        <FadeContent key={product._id} delay={Math.min(i * 0.04, 0.32)}>
          <ProductCard product={product} />
        </FadeContent>
      ))}
    </div>
  )
}
