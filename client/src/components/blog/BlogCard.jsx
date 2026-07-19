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
  const imageSrc = article.image_url || 'https://placehold.co/800x450/e8eee4/3d4638?text=Evolve+Blog'
  const excerpt = article.meta_description || ''

  if (featured) {
    return (
      <FadeContent delay={0} className="blog-card-featured-wrap">
        <article className="blog-card blog-card--featured">
          <Link to={path} className="blog-card-featured-media" aria-label={article.title}>
            <img src={imageSrc} alt="" loading="lazy" referrerPolicy="no-referrer" />
          </Link>
          <div className="blog-card-featured-content">
            <CategoryPill category={article.category} />
            <h2 className="blog-card-featured-title">
              <Link to={path}>{article.title}</Link>
            </h2>
            {excerpt ? <p className="blog-card-excerpt">{excerpt}</p> : null}
            <div className="blog-card-featured-footer">
              <span className="blog-card-featured-date">{formatDate(article.published_at)}</span>
              <Link to={path} className="blog-card-featured-cta ev-btn ev-btn-outline">
                Read article <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </article>
      </FadeContent>
    )
  }

  return (
    <FadeContent delay={index * 0.06}>
      <article className="blog-card">
        <Link to={path} className="blog-card-image-wrap" aria-label={article.title}>
          <img src={imageSrc} alt="" loading="lazy" referrerPolicy="no-referrer" />
        </Link>
        <div className="blog-card-body">
          <div className="blog-card-meta">
            <CategoryPill category={article.category} />
            <span>{formatDate(article.published_at)}</span>
          </div>
          <h2 className="blog-card-title">
            <Link to={path}>{article.title}</Link>
          </h2>
          {excerpt ? <p className="blog-card-excerpt">{excerpt}</p> : null}
          <Link to={path} className="blog-card-link">
            Continue reading →
          </Link>
        </div>
      </article>
    </FadeContent>
  )
}
