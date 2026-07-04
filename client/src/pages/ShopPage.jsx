import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { SlidersHorizontal, X } from 'lucide-react'
import api from '../lib/api'
import ProductGrid from '../components/shop/ProductGrid'
import Pagination from '../components/ui/Pagination'
import SEO from '../components/SEO'
import { generateSEOTitle, generateMetaDescription } from '../lib/seoUtils'
import { getPageRange } from '../lib/pagination'

const PAGE_SIZE = 20

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
    const params = { page, limit: PAGE_SIZE, sort }
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

  const shopPath = `/shop${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const pageTitle = category
    ? generateSEOTitle(`Shop ${category}`)
    : search
      ? generateSEOTitle(`Search ${search}`)
      : generateSEOTitle('Shop Vitamins & Wellness')
  const pageDescription = category
    ? generateMetaDescription(`Browse ${category} at Evolve Pharmacy. Trusted vitamins, supplements, and wellness products with expert pharmacy support.`)
    : generateMetaDescription('Shop vitamins, supplements, personal care, and wellness products at Evolve Specialty Pharmacy & Wellness.')

  const { start: rangeStart, end: rangeEnd } = getPageRange(page, PAGE_SIZE, total)

  return (
    <div>
      <SEO
        title={pageTitle}
        description={pageDescription}
        path={shopPath}
        keywords={[category, search, 'shop', 'vitamins', 'supplements', 'Evolve Pharmacy'].filter(Boolean)}
      />

      <nav className="product-breadcrumb shop-breadcrumb" aria-label="Breadcrumb">
        <ol className="product-breadcrumb-list">
          <li><Link to="/">Home</Link><span className="product-breadcrumb-sep"> / </span></li>
          <li><Link to="/shop">Shop</Link>{category && <span className="product-breadcrumb-sep"> / </span>}</li>
          {category && <li><span aria-current="page">{category}</span></li>}
        </ol>
      </nav>

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

        {showFilters && (
          <button
            type="button"
            className="shop-filters-backdrop"
            aria-label="Close filters"
            onClick={() => setShowFilters(false)}
          />
        )}

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
            {!loading && products.length > 0 && (
              <p className="shop-results-range">
                Showing {rangeStart}–{rangeEnd} of {total} product{total !== 1 ? 's' : ''}
              </p>
            )}

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

            <Pagination
              page={page}
              pages={pages}
              onPageChange={(p) => setParam('page', String(p))}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
