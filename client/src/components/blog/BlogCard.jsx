import { Link } from 'react-router-dom'
import { getArticlePath } from '@/lib/blogSeo'

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function BlogCard({ article, featured = false }) {
  const path = getArticlePath(article)
  const imageSrc = article.image_url || 'https://placehold.co/800x450/e8eee4/1a2118?text=Evolve+Blog'
  const excerpt = article.meta_description || ''

  return (
    <article className={`blog-card${featured ? ' blog-card--featured' : ''}`}>
      <Link to={path} className="blog-card-image-wrap" aria-label={article.title}>
        <img src={imageSrc} alt="" loading="lazy" referrerPolicy="no-referrer" />
      </Link>
      <div className="blog-card-body">
        <div className="blog-card-meta">
          <span className="blog-card-pill">{String(article.category || '').replace(/-/g, ' ')}</span>
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
  )
}
