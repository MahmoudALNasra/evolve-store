import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { getArticlePath } from '@/lib/blogSeo'
import FadeContent from '@/components/ui/FadeContent'

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function CategoryPill({ category }) {
  return (
    <span className="blog-card-pill">{category.replace(/-/g, ' ')}</span>
  )
}

export default function BlogCard({ article, index = 0, featured = false }) {
  const path = getArticlePath(article)
  const imageSrc = article.image_url || 'https://placehold.co/800x450/1a1814/C9A84C?text=Evolve+Blog'

  if (featured) {
    return (
      <FadeContent delay={0} className="blog-card-featured-wrap">
        <article className="blog-card blog-card--featured">
          <Link to={path} className="blog-card-featured-media">
            <img src={imageSrc} alt={article.title} loading="lazy" />
            <div className="blog-card-featured-overlay" aria-hidden="true" />
            <div className="blog-card-featured-content">
              <CategoryPill category={article.category} />
              <h2 className="blog-card-featured-title">{article.title}</h2>
              <div className="blog-card-featured-footer">
                <span className="blog-card-featured-date">{formatDate(article.published_at)}</span>
                <span className="blog-card-featured-cta ev-btn ev-btn-outline">
                  Read Article <ArrowRight size={14} aria-hidden="true" />
                </span>
              </div>
            </div>
          </Link>
        </article>
      </FadeContent>
    )
  }

  return (
    <FadeContent delay={index * 0.06}>
      <article className="blog-card blog-card--dark">
        <Link to={path} className="blog-card-image-wrap">
          <img src={imageSrc} alt={article.title} loading="lazy" />
        </Link>
        <div className="blog-card-body">
          <div className="blog-card-meta">
            <CategoryPill category={article.category} />
            <span>{formatDate(article.published_at)}</span>
          </div>
          <h2 className="blog-card-title">
            <Link to={path}>{article.title}</Link>
          </h2>
          <p className="blog-card-excerpt">{article.meta_description}</p>
          <Link to={path} className="blog-card-link">
            Read article →
          </Link>
        </div>
      </article>
    </FadeContent>
  )
}
