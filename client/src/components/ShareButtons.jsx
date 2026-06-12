import { useState } from 'react'
import { Share2, Link2, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

function buildShareLinks(url, title) {
  const encodedUrl = encodeURIComponent(url)
  const encodedTitle = encodeURIComponent(title)
  return {
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedUrl}`,
  }
}

export default function ShareButtons({ url, title, compact = false }) {
  const [copied, setCopied] = useState(false)
  const links = buildShareLinks(url, title)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch {
        // user cancelled
      }
      return
    }
    copyLink()
  }

  return (
    <div className={`blog-share-buttons${compact ? ' compact' : ''}`}>
      <button type="button" onClick={nativeShare} className="blog-share-btn" title="Share">
        <Share2 size={16} />
        {!compact && <span>Share</span>}
      </button>
      <button type="button" onClick={copyLink} className="blog-share-btn" title="Copy link">
        <Link2 size={16} />
        {!compact && <span>{copied ? 'Copied' : 'Copy link'}</span>}
      </button>
      <a href={links.x} target="_blank" rel="noopener noreferrer" className="blog-share-btn" title="Share on X">
        <span className="blog-share-icon-text">X</span>
      </a>
      <a href={links.linkedin} target="_blank" rel="noopener noreferrer" className="blog-share-btn" title="Share on LinkedIn">
        <span className="blog-share-icon-text">in</span>
      </a>
      <a href={links.reddit} target="_blank" rel="noopener noreferrer" className="blog-share-btn" title="Share on Reddit">
        <span className="blog-share-icon-text">R</span>
      </a>
      <a href={links.email} className="blog-share-btn" title="Share by email">
        <Mail size={16} />
      </a>
    </div>
  )
}
