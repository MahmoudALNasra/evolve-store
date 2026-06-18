import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import api from '../lib/api'
import ProductGrid from '../components/shop/ProductGrid'
import Spinner from '../components/ui/Spinner'

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)

  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''
  const minPrice = searchParams.get('minPrice') || ''
  const maxPrice = searchParams.get('maxPrice') || ''
  const featured = searchParams.get('featured') || ''
  const page = Number(searchParams.get('page') || 1)
  const sort = searchParams.get('sort') || '-createdAt'

  const fetchProducts = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 20, sort }
    if (search) params.search = search
    if (category) params.category = category
    if (minPrice) params.minPrice = minPrice
    if (maxPrice) params.maxPrice = maxPrice
    if (featured) params.featured = featured
    api.get('/products', { params })
      .then(({ data }) => { setProducts(data.products); setTotal(data.total); setPages(data.pages) })
      .finally(() => setLoading(false))
  }, [search, category, minPrice, maxPrice, featured, page, sort])

  useEffect(() => { fetchProducts() }, [fetchProducts])
  useEffect(() => { api.get('/products/categories').then(({ data }) => setCategories(data)) }, [])

  // Scroll to top whenever page changes so users see the new products
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [page])

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    // Reset to page 1 only when filters/sort change, not when the user paginates
    if (key !== 'page') next.delete('page')
    setSearchParams(next)
  }

  const clearFilters = () => setSearchParams({})

  const hasFilters = search || category || minPrice || maxPrice || featured

  return (
    <div>
      <div className="shop-header">
        <div className="shop-header-inner">
          <div className="shop-header-title">
            {search ? `Results for "${search}"` : category || 'All Products'}
          </div>
          <div className="shop-header-count">{total} product{total !== 1 ? 's' : ''} found</div>
        </div>
      </div>

      <div className="shop-body">
        <div className="shop-topbar">
          <div className="shop-topbar-left">
            {hasFilters && (
              <button className="btn-clear-filters" onClick={clearFilters}>
                <X size={12} /> Clear filters
              </button>
            )}
            <button className="btn-mobile-filters" onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal size={15} /> Filters
            </button>
          </div>
          <div className="shop-sort">
            <select value={sort} onChange={(e) => setParam('sort', e.target.value)}>
              <option value="-createdAt">Newest First</option>
              <option value="price">Price: Low to High</option>
              <option value="-price">Price: High to Low</option>
              <option value="-rating">Top Rated</option>
            </select>
          </div>
        </div>

        <div className="shop-layout">
          <aside className={`shop-sidebar${showFilters ? ' open' : ''}`}>
            <div className="shop-sidebar-section">
              <h3>Category</h3>
              <button
                className={`sidebar-cat-btn${!category ? ' active' : ''}`}
                onClick={() => setParam('category', '')}
              >
                All Products
                {!category && <span className="sidebar-cat-dot" />}
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`sidebar-cat-btn${category === cat ? ' active' : ''}`}
                  onClick={() => setParam('category', cat)}
                >
                  {cat}
                  {category === cat && <span className="sidebar-cat-dot" />}
                </button>
              ))}
            </div>

            <hr className="sidebar-divider" />

            <div className="shop-sidebar-section">
              <h3>Price Range</h3>
              <div className="sidebar-price-row">
                <input type="number" placeholder="Min" value={minPrice} onChange={(e) => setParam('minPrice', e.target.value)} />
                <span className="sidebar-price-sep">—</span>
                <input type="number" placeholder="Max" value={maxPrice} onChange={(e) => setParam('maxPrice', e.target.value)} />
              </div>
            </div>

            <hr className="sidebar-divider" />

            <label className="sidebar-checkbox-label">
              <div className={`sidebar-checkbox-box${featured === 'true' ? ' checked' : ''}`}>
                {featured === 'true' && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <input type="checkbox" checked={featured === 'true'} onChange={(e) => setParam('featured', e.target.checked ? 'true' : '')} />
              <span>Best Sellers Only</span>
            </label>
          </aside>

          <div className="shop-main">
            {loading ? (
              <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
            ) : products.length === 0 ? (
              <div className="shop-empty">
                <div className="shop-empty-icon"><SlidersHorizontal size={24} /></div>
                <h3>No products found</h3>
                <p>Try adjusting your filters</p>
                {hasFilters && <button onClick={clearFilters}>Clear all filters</button>}
              </div>
            ) : (
              <ProductGrid products={products} />
            )}

            {pages > 1 && (
              <div className="pagination">
                {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setParam('page', String(p))}
                    className={`pagination-btn${page === p ? ' active' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
