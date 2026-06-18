import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import BlogCard from '../components/blog/BlogCard'
import api from '../lib/api'
import SEO from '../components/SEO'
import Spinner from '../components/ui/Spinner'
import { getBlogBasePath, slugifyCategory } from '../lib/blogSeo'

export default function BlogListPage() {
  const { category: routeCategory } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [articles, setArticles] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)

  const search = searchParams.get('search') || ''
  const page = Number(searchParams.get('page') || 1)
  const category = routeCategory ? slugifyCategory(routeCategory) : ''

  useEffect(() => {
    setLoading(true)
    const params = { page, limit: 12 }
    if (category) params.category = category
    if (search) params.search = search

    api.get('/blog', { params })
      .then(({ data }) => {
        setArticles(data.articles)
        setTotal(data.total)
        setPages(data.pages)
        setCategories(data.categories || [])
      })
      .finally(() => setLoading(false))
  }, [category, search, page])

  const basePath = getBlogBasePath()
  const pageTitle = category
    ? `${category.replace(/-/g, ' ')} Articles | Evolve Blog`
    : 'Pharmacy Wellness Blog | Evolve Specialty Pharmacy & Wellness'

  return (
    <div className="blog-page">
      <SEO
        title={pageTitle}
        description="Evidence-informed pharmacy and wellness articles from Evolve Specialty Pharmacy & Wellness. Product guides, supplement education, and practical health tips."
        path={category ? `${basePath}/${category}` : basePath}
        keywords={[
          'pharmacy blog',
          'wellness articles',
          'supplement education',
          'health tips',
          'Evolve Specialty Pharmacy',
        ]}
      />

      <section className="blog-hero">
        <div className="blog-hero-inner">
          <p className="blog-hero-kicker">Evolve Wellness Briefings</p>
          <h1>{category ? category.replace(/-/g, ' ') : 'Pharmacy & Wellness Blog'}</h1>
          <p className="blog-hero-copy">
            Practical, pharmacy-safe education on products, supplements, and everyday wellness decisions.
          </p>
        </div>
      </section>

      <div className="blog-layout">
        <aside className="blog-sidebar">
          <div className="blog-sidebar-card">
            <label className="blog-search-label">
              <Search size={16} />
              Search articles
            </label>
            <input
              value={search}
              onChange={(e) => setSearchParams(e.target.value ? { search: e.target.value } : {})}
              placeholder="Search topics, products, keywords..."
              className="blog-search-input"
            />
          </div>

          <div className="blog-sidebar-card">
            <h3>Categories</h3>
            <div className="blog-category-list">
              <Link to={basePath} className={!category ? 'active' : ''}>All articles</Link>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  to={`${basePath}/${slugifyCategory(cat)}`}
                  className={category === slugifyCategory(cat) ? 'active' : ''}
                >
                  {cat.replace(/-/g, ' ')}
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <section className="blog-main">
          <div className="blog-results-bar">
            <span>{total} article{total !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="spinner-wrap"><Spinner /></div>
          ) : articles.length === 0 ? (
            <div className="blog-empty">No published articles yet.</div>
          ) : (
            <div className="blog-grid">
              {articles.map((article, i) => (
                <BlogCard
                  key={article._id}
                  article={article}
                  index={i}
                  featured={i === 0 && page === 1 && !category && !search}
                />
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="blog-pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={page === p ? 'active' : ''}
                  onClick={() => setSearchParams((prev) => {
                    const next = new URLSearchParams(prev)
                    next.set('page', String(p))
                    return next
                  })}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
