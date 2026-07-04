import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buildPaginationItems } from '../../lib/pagination'

export default function Pagination({
  page,
  pages,
  onPageChange,
  className = '',
  ariaLabel = 'Pagination',
  showSummary = true,
}) {
  if (pages <= 1) return null

  const items = buildPaginationItems(page, pages)
  const canPrev = page > 1
  const canNext = page < pages

  return (
    <nav className={`pagination-nav ${className}`.trim()} aria-label={ariaLabel}>
      {showSummary && (
        <p className="pagination-summary">
          Page <strong>{page}</strong> of <strong>{pages}</strong>
        </p>
      )}

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn pagination-btn--nav"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} aria-hidden="true" />
          <span className="pagination-btn-label">Prev</span>
        </button>

        <div className="pagination-pages" role="list">
          {items.map((item, index) => {
            if (item === 'ellipsis') {
              return (
                <span key={`ellipsis-${index}`} className="pagination-ellipsis" aria-hidden="true">
                  …
                </span>
              )
            }

            const isActive = item === page
            return (
              <button
                key={item}
                type="button"
                role="listitem"
                onClick={() => onPageChange(item)}
                className={`pagination-btn${isActive ? ' active' : ''}`}
                aria-label={`Page ${item}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="pagination-btn pagination-btn--nav"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Next page"
        >
          <span className="pagination-btn-label">Next</span>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
