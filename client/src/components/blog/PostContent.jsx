import MarkdownContent from '@/components/MarkdownContent'

/**
 * Styled article body wrapper for blog posts (dark theme prose).
 */
export default function PostContent({ content, className = '' }) {
  return (
    <div className={`blog-post-content ${className}`.trim()}>
      <MarkdownContent content={content} />
    </div>
  )
}
