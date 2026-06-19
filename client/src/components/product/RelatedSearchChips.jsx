import { Link } from 'react-router-dom'
import { buildRelatedSearchChips } from '../../lib/seoUtils'

export default function RelatedSearchChips({ product }) {
  const chips = buildRelatedSearchChips(product)
  if (!chips.length) return null

  return (
    <section className="product-related-search" aria-labelledby="product-related-search-heading">
      <h2 id="product-related-search-heading" className="product-section-heading">
        You might also search for
      </h2>
      <div className="product-related-search-chips">
        {chips.map((chip) => (
          <Link
            key={chip}
            to={`/shop?search=${encodeURIComponent(chip)}`}
            className="product-search-chip"
          >
            {chip}
          </Link>
        ))}
      </div>
    </section>
  )
}
