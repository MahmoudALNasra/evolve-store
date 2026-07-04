import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp, ExternalLink, Save, Settings2 } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

function productToForm(product) {
  return {
    name: product.name || '',
    description: product.description || '',
    price: product.price ?? '',
    comparePrice: product.comparePrice || '',
    stock: product.stock ?? '',
    category: product.category || '',
    isPublished: Boolean(product.isPublished),
    isFeatured: Boolean(product.isFeatured),
    isTaxable: Boolean(product.isTaxable),
  }
}

export default function AdminProductQuickEdit({ product, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(() => productToForm(product))

  useEffect(() => {
    setForm(productToForm(product))
  }, [product])

  useEffect(() => {
    api.get('/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => {})
  }, [])

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        price: Number(form.price),
        comparePrice: Number(form.comparePrice) || 0,
        stock: Number(form.stock) || 0,
        category: form.category || 'Uncategorized',
        isPublished: form.isPublished,
        isFeatured: form.isFeatured,
        isTaxable: form.isTaxable,
      }
      const { data } = await api.put(`/products/${product._id}`, payload)
      toast.success('Product updated')
      onUpdated?.(data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="admin-quick-edit" aria-label="Admin product quick edit">
      <button
        type="button"
        className="admin-quick-edit-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Settings2 size={16} aria-hidden="true" />
        <span>Admin quick edit</span>
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>

      {open && (
        <div className="admin-quick-edit-panel">
          <div className="admin-quick-edit-grid">
            <label className="admin-quick-edit-field admin-quick-edit-field--full">
              <span>Name</span>
              <input
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
              />
            </label>

            <label className="admin-quick-edit-field admin-quick-edit-field--full">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                rows={3}
              />
            </label>

            <label className="admin-quick-edit-field">
              <span>Price ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setField('price', e.target.value)}
              />
            </label>

            <label className="admin-quick-edit-field">
              <span>Compare at ($)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.comparePrice}
                onChange={(e) => setField('comparePrice', e.target.value)}
              />
            </label>

            <label className="admin-quick-edit-field">
              <span>Stock</span>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stock}
                onChange={(e) => setField('stock', e.target.value)}
              />
            </label>

            <label className="admin-quick-edit-field">
              <span>Category</span>
              <select
                value={form.category}
                onChange={(e) => setField('category', e.target.value)}
              >
                <option value="">Uncategorized</option>
                {form.category && !categories.some((c) => (c.name || c) === form.category) && (
                  <option value={form.category}>{form.category}</option>
                )}
                {categories.map((cat) => (
                  <option key={cat._id || cat.name || cat} value={cat.name || cat}>
                    {cat.name || cat}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-quick-edit-flags">
            <label className="admin-quick-edit-check">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setField('isPublished', e.target.checked)}
              />
              Published
            </label>
            <label className="admin-quick-edit-check">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setField('isFeatured', e.target.checked)}
              />
              Featured
            </label>
            <label className="admin-quick-edit-check">
              <input
                type="checkbox"
                checked={form.isTaxable}
                onChange={(e) => setField('isTaxable', e.target.checked)}
              />
              Taxable
            </label>
          </div>

          <div className="admin-quick-edit-actions">
            <button
              type="button"
              className="admin-quick-edit-save"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={15} aria-hidden="true" />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <Link to="/admin/products" className="admin-quick-edit-link">
              Full admin editor <ExternalLink size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
