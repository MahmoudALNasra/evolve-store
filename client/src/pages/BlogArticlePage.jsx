import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Calendar, Clock, ExternalLink } from 'lucide-react'
import api from '../lib/api'
import BlogSEO from '../components/BlogSEO'
import BlogTldrCard from '../components/BlogTldrCard'
import ShareButtons from '../components/ShareButtons'
import PostContent from '../components/blog/PostContent'
import Spinner from '../components/ui/Spinner'
import {
  getArticleUrl,
  getArticlePath,
  getBlogBasePath,
  getReadingTimeMinutes,
  getSectionAnchors,
  slugifyCategory,
} from '../lib/blogSeo'

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogArticlePage() {
  const { category, slug } = useParams()
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [previewMode, setPreviewMode] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isPreview = params.get('preview') === '1'
    setPreviewMode(isPreview)

    setLoading(true)
    const request = isPreview
      ? api.get(`/admin/blog/preview/${category}/${slug}`)
      : api.get(`/blog/${category}/${slug}`)

    request
      .then(({ data }) => setArticle(data))
      .catch(() => setArticle(null))
      .finally(() => setLoading(false))
  }, [category, slug])

  if (loading) {
    return <div className="spinner-wrap"><Spinner /></div>
  }

  if (!article) {
    return (
      <div className="blog-empty-page">
        <h1>Article not found</h1>
        <Link to={getBlogBasePath()}>Back to blog</Link>
      </div>
    )
  }

  const shareUrl = getArticleUrl(article)
  const anchors = getSectionAnchors(article.content)
  const readingTime = getReadingTimeMinutes(article.content)
  const product = article.product

  return (
    <div className="blog-article-page">
      <BlogSEO
        article={article}
        product={product}
        robots={previewMode && article.status === 'draft' ? 'noindex, nofollow' : undefined}
      />

      {previewMode && article.status === 'draft' && (
        <div className="blog-preview-banner">
          Draft preview — this article is not published yet.
        </div>
      )}

      <article className="blog-article-shell">
        <div className="blog-article-breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to={getBlogBasePath()}>Blog</Link>
          <span>/</span>
          <Link to={`${getBlogBasePath()}/${slugifyCategory(article.category)}`}>
            {article.category.replace(/-/g, ' ')}
          </Link>
        </div>

        <header className="blog-article-header">
          <p className="blog-article-kicker">{article.category.replace(/-/g, ' ')}</p>
          <h1>{article.title}</h1>
          <div className="blog-article-meta">
            <span><Calendar size={15} /> {formatDate(article.published_at || article.createdAt)}</span>
            <span><Clock size={15} /> {readingTime} min read</span>
            {article.source_name && <span>Source: {article.source_name}</span>}
          </div>
          <ShareButtons url={shareUrl} title={article.title} />
        </header>

        {article.image_url && (
          <div className="blog-article-hero">
            <img src={article.image_url} alt={article.title} />
          </div>
        )}

        <BlogTldrCard article={article} shareUrl={shareUrl} />

        {anchors.length > 0 && (
          <nav className="blog-in-this-briefing" aria-label="In this briefing">
            <h2>In this briefing</h2>
            <ul>
              {anchors.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <PostContent content={article.content} />

        {product && (
          <section className="blog-related-product">
            <h2>Related product</h2>
            <div className="blog-related-product-card">
              <img
                src={product.images?.[0]?.url || 'https://placehold.co/120x120?text=Product'}
                alt={product.name}
              />
              <div>
                <h3>{product.name}</h3>
                <p>{product.category}</p>
                <Link to={`/product/${product.slug}`} className="blog-related-product-link">
                  View product
                </Link>
              </div>
            </div>
          </section>
        )}

        {(article.source_name || article.source_url) && (
          <footer className="blog-article-source">
            <p>
              Source:{' '}
              {article.source_url ? (
                <a href={article.source_url} target="_blank" rel="noopener noreferrer">
                  {article.source_name || article.source_url}
                  <ExternalLink size={14} />
                </a>
              ) : (
                article.source_name
              )}
            </p>
            <p className="blog-disclaimer">
              This article is for educational purposes only and is not medical advice.
              Consult your pharmacist or healthcare provider for guidance specific to your health needs.
            </p>
          </footer>
        )}
      </article>
    </div>
  )
}
