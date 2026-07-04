import { useState } from 'react'

const TABS = [
  { id: 'description', label: 'Description' },
  { id: 'ingredients', label: 'Ingredients' },
  { id: 'suggestedUse', label: 'Suggested Use' },
  { id: 'moreInfo', label: 'More Info' },
]

function TabPanel({ id, active, children }) {
  if (id !== active) return null
  return (
    <div
      id={`product-tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={`product-tab-${id}`}
      className="product-tabs-panel"
    >
      {children}
    </div>
  )
}

function renderContent(text) {
  if (!text?.trim()) {
    return <p className="product-tabs-empty">Information not available for this product.</p>
  }

  return text.split(/\n{2,}/).map((block) => {
    const trimmed = block.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('- ') || trimmed.includes('\n- ')) {
      const items = trimmed.split('\n').map((line) => line.replace(/^-\s*/, '').trim()).filter(Boolean)
      return (
        <ul key={trimmed.slice(0, 24)} className="product-tabs-list">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      )
    }
    return <p key={trimmed.slice(0, 24)}>{trimmed}</p>
  })
}

export default function ProductDetailTabs({ product }) {
  const panels = {
    description: product.description,
    ingredients: product.ingredients,
    suggestedUse: product.suggestedUse,
    moreInfo: product.moreInfo,
  }

  const availableTabs = TABS.filter(({ id }) => panels[id]?.trim())
  const [active, setActive] = useState(availableTabs[0]?.id || 'description')

  if (!availableTabs.length) return null

  return (
    <section className="product-tabs" aria-label="Product details">
      <div className="product-tabs-nav" role="tablist">
        {availableTabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`product-tab-${id}`}
            aria-selected={active === id}
            aria-controls={`product-tabpanel-${id}`}
            className={`product-tabs-btn${active === id ? ' is-active' : ''}`}
            onClick={() => setActive(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {availableTabs.map(({ id }) => (
        <TabPanel key={id} id={id} active={active}>
          <div className="product-tabs-body">{renderContent(panels[id])}</div>
        </TabPanel>
      ))}

      {product.seoFaqs?.length > 0 && (
        <div className="product-tabs-faq">
          <h3 className="product-section-heading">Common Questions</h3>
          <div className="product-faq-list">
            {product.seoFaqs.map((faq) => (
              <article key={faq.question} className="product-faq-item">
                <h4>{faq.question}</h4>
                <p>{faq.answer}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
