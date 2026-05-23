import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { formatPrice } from '../lib/utils'
import ProductImage from './ProductImage'
import { getProductPath } from '../lib/productSeo'

const DEBOUNCE_MS = 300
const MIN_QUERY_LENGTH = 2

export default function SearchBar({ className = '', inputProps = {}, onNavigate }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const requestIdRef = useRef(0)

  const closeDropdown = useCallback(() => {
    setOpen(false)
    setActiveIndex(-1)
  }, [])

  const goToShop = useCallback((term) => {
    const q = term.trim()
    if (!q) return
    navigate(`/shop?search=${encodeURIComponent(q)}`)
    setQuery('')
    setSuggestions([])
    closeDropdown()
    onNavigate?.()
  }, [navigate, closeDropdown, onNavigate])

  useEffect(() => {
    const term = query.trim()
    if (term.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setLoading(false)
      closeDropdown()
      return undefined
    }

    const id = ++requestIdRef.current
    setLoading(true)

    const timer = setTimeout(() => {
      api
        .get('/products/search', { params: { q: term, limit: 8 } })
        .then(({ data }) => {
          if (id !== requestIdRef.current) return
          setSuggestions(data.suggestions || [])
          setOpen(true)
          setActiveIndex(-1)
        })
        .catch(() => {
          if (id !== requestIdRef.current) return
          setSuggestions([])
        })
        .finally(() => {
          if (id === requestIdRef.current) setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query, closeDropdown])

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) closeDropdown()
    }
    const onKey = (e) => { if (e.key === 'Escape') closeDropdown() }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [closeDropdown])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      navigate(getProductPath(suggestions[activeIndex]))
      setQuery('')
      setSuggestions([])
      closeDropdown()
      onNavigate?.()
      return
    }
    goToShop(query)
  }

  const handleKeyDown = (e) => {
    if (!open || !suggestions.length) {
      if (e.key === 'Enter') handleSubmit(e)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      navigate(getProductPath(suggestions[activeIndex]))
      setQuery('')
      setSuggestions([])
      closeDropdown()
      onNavigate?.()
    } else if (e.key === 'Escape') {
      closeDropdown()
    }
  }

  const showDropdown = open && query.trim().length >= MIN_QUERY_LENGTH

  return (
    <div className={`navbar-search search-bar${className ? ` ${className}` : ''}`} ref={rootRef}>
      <form onSubmit={handleSubmit} className="search-bar-form" role="search">
        <span className="navbar-search-icon" aria-hidden>
          {loading ? <Loader2 size={15} className="search-bar-spinner" /> : <Search size={15} />}
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search vitamins, supplements…"
          autoComplete="off"
          aria-label="Search products"
          aria-expanded={showDropdown}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          {...inputProps}
        />
      </form>

      {showDropdown && (
        <ul id="search-suggestions" className="search-dropdown" role="listbox">
          {suggestions.length === 0 && !loading ? (
            <li className="search-dropdown-empty" role="option">No products found</li>
          ) : (
            suggestions.map((item, index) => (
              <li key={item.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  className={`search-dropdown-item${index === activeIndex ? ' active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    navigate(getProductPath(item))
                    setQuery('')
                    setSuggestions([])
                    closeDropdown()
                    onNavigate?.()
                  }}
                >
                  {item.image ? (
                    <ProductImage
                      src={item.image}
                      alt={item.name}
                      variant="thumb"
                      className="search-dropdown-thumb"
                      width={48}
                      height={48}
                    />
                  ) : (
                    <span className="search-dropdown-thumb search-dropdown-thumb--empty" />
                  )}
                  <span className="search-dropdown-text">
                    <span className="search-dropdown-name">{item.name}</span>
                    {item.category && <span className="search-dropdown-category">{item.category}</span>}
                  </span>
                  <span className="search-dropdown-price">{formatPrice(item.price)}</span>
                </button>
              </li>
            ))
          )}
          {query.trim().length >= MIN_QUERY_LENGTH && (
            <li className="search-dropdown-footer">
              <button type="button" className="search-dropdown-view-all" onClick={() => goToShop(query)}>
                View all results for &ldquo;{query.trim()}&rdquo;
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
