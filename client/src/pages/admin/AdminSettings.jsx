import { useState, useEffect } from 'react'
import { Save, Plus, Edit2, Trash2, X } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function AdminSettings() {
  const [form, setForm] = useState({
    storeName: 'Evolve Pharmacy',
    currency: 'USD',
    lowStockThreshold: 5,
    supportEmail: 'support@evolvepharmacy.com',
  })
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [categoryModal, setCategoryModal] = useState(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      const { data } = await api.get('/categories')
      setCategories(data)
    } catch (err) {
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = (e) => {
    e.preventDefault()
    toast.success('Settings saved (frontend only — connect to API as needed)')
  }

  const openAddCategory = () => {
    setCategoryForm({ name: '', description: '' })
    setEditingCategory(null)
    setCategoryModal('add')
  }

  const openEditCategory = (cat) => {
    setCategoryForm({ name: cat.name, description: cat.description || '' })
    setEditingCategory(cat)
    setCategoryModal('edit')
  }

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return toast.error('Category name is required')
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory._id}`, categoryForm)
        toast.success('Category updated')
      } else {
        await api.post('/categories', categoryForm)
        toast.success('Category created')
      }
      setCategoryModal(null)
      loadCategories()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save category')
    }
  }

  const handleDeleteCategory = async () => {
    try {
      await api.delete(`/categories/${deleteId}`)
      toast.success('Category deleted')
      setDeleteId(null)
      loadCategories()
    } catch (err) {
      toast.error('Failed to delete category')
    }
  }

  return (
    <div className="admin-page" style={{ maxWidth: 720 }}>
      <h1 className="admin-page-title">Settings</h1>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="admin-card">
          <h2 className="admin-card-title">Store Information</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="auth-field">
              <label>Store Name</label>
              <input value={form.storeName} onChange={(e) => setForm((f) => ({ ...f, storeName: e.target.value }))} />
            </div>
            <div className="auth-field">
              <label>Support Email</label>
              <input type="email" value={form.supportEmail} onChange={(e) => setForm((f) => ({ ...f, supportEmail: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="admin-card-title">Commerce</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="auth-field">
              <label>Currency</label>
              <select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="ILS">ILS — Israeli Shekel</option>
              </select>
            </div>
            <div className="auth-field">
              <label>Low Stock Threshold</label>
              <input
                type="number"
                min="0"
                value={form.lowStockThreshold}
                onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: Number(e.target.value) }))}
                onWheel={(e) => e.target.blur()}
              />
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Products at or below this stock level trigger a low-stock alert.</p>
            </div>
          </div>
        </div>

        <button type="submit" className="btn-admin btn-admin-primary">
          <Save size={16} /> Save Settings
        </button>
      </form>

      <div className="admin-card" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 className="admin-card-title" style={{ margin: 0 }}>Product Categories</h2>
          <button onClick={openAddCategory} className="btn-admin btn-admin-primary btn-admin-sm">
            <Plus size={14} /> Add Category
          </button>
        </div>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner spinner-md" /></div>
        ) : categories.length === 0 ? (
          <div className="admin-empty"><p>No categories yet</p></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat._id}>
                  <td style={{ fontWeight: 600 }}>{cat.name}</td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>{cat.description || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <button onClick={() => openEditCategory(cat)} className="btn-admin btn-admin-sm btn-admin-secondary">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(cat._id)} className="btn-admin btn-admin-sm btn-admin-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(categoryModal === 'add' || categoryModal === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c' }}>{categoryModal === 'edit' ? 'Edit Category' : 'Add Category'}</h2>
              <button onClick={() => setCategoryModal(null)} className="btn-admin btn-admin-sm btn-admin-secondary"><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="auth-field">
                <label>Category Name *</label>
                <input value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g., Vitamins & Supplements" />
              </div>
              <div className="auth-field">
                <label>Description (optional)</label>
                <textarea value={categoryForm.description} onChange={(e) => setCategoryForm((f) => ({ ...f, description: e.target.value }))} rows={3} style={{ resize: 'none' }} placeholder="Brief description of this category" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setCategoryModal(null)} className="btn-admin btn-admin-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleSaveCategory} className="btn-admin btn-admin-primary" style={{ flex: 1 }}>
                {categoryModal === 'edit' ? 'Save Changes' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c', marginBottom: 8 }}>Delete Category?</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This will not delete products in this category, but they will no longer be categorized.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteId(null)} className="btn-admin btn-admin-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDeleteCategory} className="btn-admin btn-admin-danger" style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
