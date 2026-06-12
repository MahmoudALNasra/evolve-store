import { useEffect, useState, useRef } from 'react'
import { Plus, Edit2, Trash2, PackagePlus, Download, Upload, X, Search, Image, Link as LinkIcon, Sparkles, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getArticlePath } from '../../lib/blogSeo'
import api from '../../lib/api'
import { formatPrice } from '../../lib/utils'
import toast from 'react-hot-toast'

const EMPTY = {
  name: '', description: '', price: '', comparePrice: '', category: '',
  tags: '', sku: '', barcode: '', stock: '', weight: '',
  isPublished: false, isFeatured: false, images: [],
}

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState([])

  // Modal state
  const [modal, setModal] = useState(null) // 'add' | 'edit' | 'restock' | 'bulk' | 'bulkRestock'
  const [editProduct, setEditProduct] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [restockQty, setRestockQty] = useState(1)
  const [deleteId, setDeleteId] = useState(null)
  const [blogStatus, setBlogStatus] = useState({})
  const [generatingBlogFor, setGeneratingBlogFor] = useState(null)

  // Image inputs
  const [imgUrl, setImgUrl] = useState('')
  const imgFileRef = useRef()
  const bulkFileRef = useRef()
  const bulkRestockFileRef = useRef()

  const load = () => {
    setLoading(true)
    api.get('/products/admin/all', { params: { page, limit: 20, search } })
      .then(({ data }) => { setProducts(data.products); setTotal(data.total); setPages(data.pages) })
      .finally(() => setLoading(false))
  }

  const loadCategories = async () => {
    try {
      const { data } = await api.get('/categories')
      setCategories(data)
    } catch (err) {
      console.error('Failed to load categories')
    }
  }

  useEffect(() => { load() }, [page, search])
  useEffect(() => { loadCategories() }, [])
  useEffect(() => {
    api.get('/admin/blog/product-status')
      .then(({ data }) => setBlogStatus(data.statusByProduct || {}))
      .catch(() => setBlogStatus({}))
  }, [products.length, page])

  const openAdd = () => { setForm(EMPTY); setEditProduct(null); setModal('add') }
  const openEdit = (p) => {
    setEditProduct(p)
    setForm({
      name: p.name, description: p.description, price: p.price, comparePrice: p.comparePrice || '',
      category: p.category, tags: p.tags?.join(', ') || '', sku: p.sku || '', barcode: p.barcode || '',
      stock: p.stock, weight: p.weight || '', isPublished: p.isPublished, isFeatured: p.isFeatured,
      images: p.images || [],
    })
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    setSaving(true)
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        comparePrice: Number(form.comparePrice) || 0,
        stock: Number(form.stock) || 0,
        weight: Number(form.weight) || 0,
        tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      }
      if (editProduct) {
        await api.put(`/products/${editProduct._id}`, payload)
        toast.success('Product updated')
      } else {
        await api.post('/products', payload)
        toast.success('Product created')
      }
      setModal(null)
      loadCategories()
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    await api.delete(`/products/${deleteId}`)
    toast.success('Product deleted')
    setDeleteId(null)
    load()
  }

  const handleRestock = async () => {
    if (!editProduct || restockQty < 1) return
    await api.put(`/products/${editProduct._id}/restock`, { qty: restockQty })
    toast.success(`Stock updated +${restockQty}`)
    setModal(null)
    load()
  }

  // Image upload to Cloudinary
  const handleImageUpload = async (file) => {
    const fd = new FormData()
    fd.append('image', file)
    setSaving(true)
    try {
      const { data } = await api.post('/products/upload-image', fd)
      setForm((f) => ({ ...f, images: [...f.images, { url: data.url, source: 'upload', publicId: data.publicId }] }))
    } catch {
      toast.error('Image upload failed')
    } finally {
      setSaving(false)
    }
  }

  const addImageUrl = () => {
    if (!imgUrl.trim()) return
    setForm((f) => ({ ...f, images: [...f.images, { url: imgUrl.trim(), source: 'link' }] }))
    setImgUrl('')
  }

  const removeImage = (idx) => setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))

  // Bulk add via Excel
  const handleBulkUpload = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    setSaving(true)
    try {
      const { data } = await api.post('/products/bulk', fd)
      toast.success(
        `${data.inserted} products imported${
          data.categoriesCreated ? `, ${data.categoriesCreated} new categories added` : ''
        }`
      )
      setModal(null)
      loadCategories()
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Import failed')
    } finally {
      setSaving(false)
    }
  }

  // Bulk restock via Excel
  const handleBulkRestock = async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    setSaving(true)
    try {
      const { data } = await api.post('/products/bulk-restock', fd)
      toast.success(`Updated ${data.updated} products${data.notFound?.length ? `, ${data.notFound.length} SKUs not found` : ''}`)
      setModal(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Bulk restock failed')
    } finally {
      setSaving(false)
    }
  }

  const downloadTemplate = async (type) => {
    try {
      const response = await api.get(`/products/template/${type}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${type}-template.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Failed to download template')
    }
  }

  const handleGenerateBlog = async (product) => {
    setGeneratingBlogFor(product._id)
    try {
      const { data } = await api.post(`/admin/blog/generate/product/${product._id}`)
      toast.success('Blog draft generated')
      api.get('/admin/blog/product-status')
        .then(({ data: statusData }) => setBlogStatus(statusData.statusByProduct || {}))
      window.open(`${getArticlePath(data)}?preview=1`, '_blank', 'noopener,noreferrer')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Blog generation failed')
    } finally {
      setGeneratingBlogFor(null)
    }
  }

  const getBlogLabel = (productId) => {
    const status = blogStatus[productId]
    if (!status?.hasArticle) return { text: 'No article', className: 'gray' }
    if (status.hasPublished) return { text: `${status.publishedCount} published`, className: 'green' }
    return { text: `${status.draftCount} draft`, className: 'indigo' }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Products <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 18 }}>({total})</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setModal('bulkRestock')} className="btn-admin btn-admin-secondary">
            <PackagePlus size={15} /> Bulk Restock
          </button>
          <button onClick={() => setModal('bulk')} className="btn-admin btn-admin-secondary">
            <Upload size={15} /> Import Excel
          </button>
          <button onClick={openAdd} className="btn-admin btn-admin-primary">
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      <div className="admin-search">
        <Search size={15} className="admin-search-icon" />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Search by name, SKU, barcode…" />
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>Stock</th>
                <th style={{ textAlign: 'center' }}>Blog</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={7} className="admin-empty">No products found</td></tr>
              ) : products.map((p) => (
                <tr key={p._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <img src={p.images?.[0]?.url || 'https://placehold.co/40x40?text=?'} alt={p.name}
                        style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', border: '1px solid #e8eee8' }} />
                      <div>
                        <div style={{ fontWeight: 600, color: '#1c2b1c', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        {p.sku && <div style={{ fontSize: 11, color: '#9ca3af' }}>SKU: {p.sku}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: '#6b7280' }}>{p.category || '—'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPrice(p.price)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: p.stock === 0 ? '#dc2626' : p.stock <= 5 ? '#f59e0b' : '#1c2b1c' }}>{p.stock}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {(() => {
                      const label = getBlogLabel(p._id)
                      return <span className={`admin-badge ${label.className}`}>{label.text}</span>
                    })()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                      <span className={`admin-badge ${p.isPublished ? 'green' : 'gray'}`}>{p.isPublished ? 'Live' : 'Draft'}</span>
                      {p.isFeatured && <span className="admin-badge indigo">Featured</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <button
                        onClick={() => handleGenerateBlog(p)}
                        disabled={generatingBlogFor === p._id}
                        title="Generate blog draft"
                        className="btn-admin btn-admin-sm btn-admin-secondary"
                      >
                        <Sparkles size={14} />
                      </button>
                      <Link to="/admin/blog" title="Manage blog articles" className="btn-admin btn-admin-sm btn-admin-secondary">
                        <FileText size={14} />
                      </Link>
                      <button onClick={() => { setEditProduct(p); setRestockQty(1); setModal('restock') }} title="Restock" className="btn-admin btn-admin-sm btn-admin-secondary">
                        <PackagePlus size={14} />
                      </button>
                      <button onClick={() => openEdit(p)} title="Edit" className="btn-admin btn-admin-sm btn-admin-secondary">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(p._id)} title="Delete" className="btn-admin btn-admin-sm btn-admin-danger">
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

      {pages > 1 && (
        <div className="admin-pagination">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <button key={p} onClick={() => setPage(p)} className={page === p ? 'active' : ''}>{p}</button>
          ))}
        </div>
      )}

      {(modal === 'add' || modal === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 800, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottom: '1px solid #e8eee8', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c' }}>{modal === 'edit' ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setModal(null)} className="btn-admin btn-admin-sm btn-admin-secondary"><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div style={{ gridColumn: '1 / -1' }} className="auth-field">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }} className="auth-field">
                <label>Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} style={{ resize: 'none' }} />
              </div>
              <div className="auth-field">
                <label>Price ($) *</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} onWheel={(e) => e.target.blur()} />
              </div>
              <div className="auth-field">
                <label>Compare Price ($)</label>
                <input type="number" min="0" step="0.01" value={form.comparePrice} onChange={(e) => setForm((f) => ({ ...f, comparePrice: e.target.value }))} onWheel={(e) => e.target.blur()} />
              </div>
              <div className="auth-field">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="auth-field">
                <label>Tags (comma-separated)</label>
                <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Leave empty to auto-generate from name & description" />
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Optional. Empty = auto-tags from product name, description, and category.</p>
              </div>
              <div className="auth-field">
                <label>SKU</label>
                <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
              </div>
              <div className="auth-field">
                <label>Barcode</label>
                <input value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
              </div>
              <div className="auth-field">
                <label>Stock</label>
                <input type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} onWheel={(e) => e.target.blur()} />
              </div>
              <div className="auth-field">
                <label>Weight (kg)</label>
                <input type="number" min="0" step="0.1" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} onWheel={(e) => e.target.blur()} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#2d7a3a' }} />
                  <span style={{ fontSize: 14, color: '#374151' }}>Published</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#2d7a3a' }} />
                  <span style={{ fontSize: 14, color: '#374151' }}>Featured</span>
                </label>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Images</label>
                {form.images.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {form.images.map((img, i) => (
                      <div key={i} style={{ position: 'relative' }}>
                        <img src={img.url} alt="" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid #e8eee8' }} />
                        <button onClick={() => removeImage(i)} type="button"
                          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, background: '#dc2626', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button type="button" onClick={() => imgFileRef.current?.click()} className="btn-admin btn-admin-secondary" style={{ fontSize: 12 }}>
                    <Image size={14} /> Upload File
                  </button>
                  <input ref={imgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <LinkIcon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                    <input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="Paste image URL…"
                      style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, border: '1.5px solid #e0e7e0', borderRadius: 9, fontSize: 12, outline: 'none', background: '#f7faf7' }} />
                  </div>
                  <button type="button" onClick={addImageUrl} className="btn-admin btn-admin-secondary" style={{ fontSize: 12 }}>Add</button>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e8eee8', paddingTop: 16, marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button onClick={() => setModal(null)} className="btn-admin btn-admin-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-admin btn-admin-primary">
                {saving ? <div className="spinner spinner-sm" /> : modal === 'edit' ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'restock' && editProduct && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c' }}>Restock Product</h2>
              <button onClick={() => setModal(null)} className="btn-admin btn-admin-sm btn-admin-secondary"><X size={16} /></button>
            </div>
            <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>{editProduct.name}</p>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>Current stock: <span style={{ fontWeight: 600, color: '#1c2b1c' }}>{editProduct.stock}</span></p>
            <div className="auth-field">
              <label>Quantity to Add</label>
              <input type="number" min="1" value={restockQty} onChange={(e) => setRestockQty(Number(e.target.value))} onWheel={(e) => e.target.blur()} />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={() => setModal(null)} className="btn-admin btn-admin-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleRestock} className="btn-admin btn-admin-primary" style={{ flex: 1, background: '#059669' }}>
                Add +{restockQty}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'bulk' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c' }}>Import Products via Excel</h2>
              <button onClick={() => setModal(null)} className="btn-admin btn-admin-sm btn-admin-secondary"><X size={16} /></button>
            </div>
            <div style={{ background: '#e0e7ff', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#3730a3', marginBottom: 4 }}>Template columns:</p>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#4338ca' }}>name, description, price, comparePrice, category, tags, sku, barcode, stock, weight, isPublished, isFeatured, imageUrls</p>
            </div>
            <button onClick={() => downloadTemplate('bulk-add')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2d7a3a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
              <Download size={14} /> Download Template
            </button>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Upload Excel File (.xlsx)</label>
              <button type="button" onClick={() => bulkFileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: '2px dashed #e0e7e0', borderRadius: 10, padding: '24px 16px', fontSize: 13, color: '#6b7280', background: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f7faf7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                <Upload size={18} /> Click to select .xlsx file
              </button>
              <input ref={bulkFileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleBulkUpload(e.target.files[0])} />
            </div>
            {saving && <div className="spinner-wrap"><div className="spinner spinner-md" /></div>}
          </div>
        </div>
      )}

      {modal === 'bulkRestock' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c' }}>Bulk Restock via Excel</h2>
              <button onClick={() => setModal(null)} className="btn-admin btn-admin-sm btn-admin-secondary"><X size={16} /></button>
            </div>
            <div style={{ background: '#d1fae5', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 4 }}>Template columns:</p>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#047857' }}>sku, qty_to_add</p>
            </div>
            <button onClick={() => downloadTemplate('bulk-restock')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2d7a3a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
              <Download size={14} /> Download Restock Template
            </button>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>Upload Excel File (.xlsx)</label>
              <button type="button" onClick={() => bulkRestockFileRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', border: '2px dashed #e0e7e0', borderRadius: 10, padding: '24px 16px', fontSize: 13, color: '#6b7280', background: 'none', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#f7faf7'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                <Upload size={18} /> Click to select .xlsx file
              </button>
              <input ref={bulkRestockFileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && handleBulkRestock(e.target.files[0])} />
            </div>
            {saving && <div className="spinner-wrap"><div className="spinner spinner-md" /></div>}
          </div>
        </div>
      )}

      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1c2b1c', marginBottom: 8 }}>Delete Product?</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setDeleteId(null)} className="btn-admin btn-admin-secondary" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleDelete} className="btn-admin btn-admin-danger" style={{ flex: 1 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
