/**
 * Markdown helpers for blog articles: FAQ extraction, anchor links, section parsing.
 */

function slugifyHeading(text) {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function extractFaqFromMarkdown(content) {
  if (!content) return []

  const faqMatch = content.match(/##\s*FAQ[\s\S]*?(?=\n##\s|\n---|\nSource:|$)/i)
  if (!faqMatch) return []

  const section = faqMatch[0]
  const items = []
  const qaRegex = /###\s*(.+?)\n([\s\S]*?)(?=\n###\s|\n##\s|$)/g
  let match

  while ((match = qaRegex.exec(section)) !== null) {
    const question = match[1].trim().replace(/\?$/, '') + '?'
    const answer = match[2].trim().replace(/\n+/g, ' ')
    if (question && answer) {
      items.push({ question, answer })
    }
  }

  if (items.length) return items

  const bulletRegex = /^[-*]\s*\*\*(.+?)\*\*\s*[-–—]?\s*(.+)$/gm
  while ((match = bulletRegex.exec(section)) !== null) {
    items.push({
      question: match[1].trim().replace(/\?$/, '') + '?',
      answer: match[2].trim(),
    })
  }

  return items.slice(0, 6)
}

function hasFaqSection(content) {
  return /##\s*FAQ/i.test(content || '')
}

function getSectionAnchors(content) {
  const anchors = []
  const headingRegex = /^##\s+(.+)$/gm
  let match

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

  while ((match = headingRegex.exec(content)) !== null) {
    const label = match[1].trim()
    const key = label.toLowerCase()
    const id = anchorMap[key] || slugifyHeading(label)
    anchors.push({ label, id })
  }

  return anchors
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getReadingTimeMinutes(content) {
  const words = stripMarkdown(content).split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

module.exports = {
  slugifyHeading,
  extractFaqFromMarkdown,
  hasFaqSection,
  getSectionAnchors,
  stripMarkdown,
  getReadingTimeMinutes,
}
