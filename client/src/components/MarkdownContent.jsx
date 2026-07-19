import { useMemo } from 'react'
import { marked } from 'marked'

marked.setOptions({
  gfm: true,
  breaks: true,
})

function slugifyHeading(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

const anchorMap = {
  'quick answer': 'quick-answer',
  'practical implications': 'practical-implications',
  'what to watch next': 'what-to-watch-next',
  faq: 'faq',
  'key takeaways': 'key-takeaways',
  'common mistakes': 'common-mistakes',
  checklist: 'checklist',
  'step-by-step workflow': 'step-by-step',
}

function addHeadingIds(html) {
  return html.replace(/<h2>([^<]+)<\/h2>/g, (_, heading) => {
    const label = heading.trim()
    const id = anchorMap[label.toLowerCase()] || slugifyHeading(label)
    return `<h2 id="${id}">${label}</h2>`
  })
}

export default function MarkdownContent({ content }) {
  const html = useMemo(() => {
    if (!content) return ''
    const rendered = marked.parse(content)
    return addHeadingIds(rendered)
  }, [content])

  return (
    <div
      className="blog-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
