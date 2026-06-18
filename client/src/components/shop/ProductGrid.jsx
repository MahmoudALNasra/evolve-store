import ProductCard from './ProductCard'

export default function ProductGrid({ products = [] }) {
  if (!products.length) return null

  return (
    <div className="products-grid products-grid--shop">
      {products.map((product) => (
        <div key={product._id} className="products-grid__item">
          <ProductCard product={product} />
        </div>
      ))}
    </div>
  )
}
