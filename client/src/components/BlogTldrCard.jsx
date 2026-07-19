import ShareButtons from './ShareButtons'

export default function BlogTldrCard({ article, shareUrl }) {
  const takeaways = Array.isArray(article?.key_takeaways) ? article.key_takeaways : []

  if (!takeaways.length) return null

  return (
    <section className="blog-tldr-card">
      <div className="blog-tldr-header">
        <div>
          <p className="blog-tldr-label">Quick read</p>
          <h2 className="blog-tldr-title">What to know first</h2>
        </div>
        <ShareButtons url={shareUrl} title={article.title} compact />
      </div>
      <ul className="blog-tldr-list">
        {takeaways.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
