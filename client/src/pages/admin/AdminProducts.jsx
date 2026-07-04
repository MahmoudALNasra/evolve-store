import { useEffect, useState, useRef } from 'react'
import { Plus, Edit2, Trash2, PackagePlus, Download, Upload, X, Search, Image, Link as LinkIcon, Sparkles, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getArticlePath } from '../../lib/blogSeo'
import { getProductPath } from '../../lib/productSeo'
import api from '../../lib/api'
import { formatPrice } from '../../lib/utils'
import toast from 'react-hot-toast'
import AdminFieldLabel from '../../components/admin/AdminFieldLabel'
import AdminCheckboxOption from '../../components/admin/AdminCheckboxOption'
import FieldHint from '../../components/admin/FieldHint'

const EMPTY = {
  name: '', description: '', price: '', comparePrice: '', category: '',
  tags: '', sku: '', barcode: '', stock: '', weight: '',
  isPublished: false, isFeatured: false, isTaxable: false, images: [],
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
  const [seoSuggestion, setSeoSuggestion] = useState(null)
  const [loadingSeo, setLoadingSeo] = useState(false)

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

  const openAdd = () => { setForm(EMPTY); setEditProduct(null); setSeoSuggestion(null); setModal('add') }
  const openEdit = (p) => {
    setEditProduct(p)
    setSeoSuggestion(null)
    setForm({
      name: p.name, description: p.description, price: p.price, comparePrice: p.comparePrice || '',
      category: p.category, tags: p.tags?.join(', ') || '', sku: p.sku || '', barcode: p.barcode || '',
      stock: p.stock, weight: p.weight || '', isPublished: p.isPublished, isFeatured: p.isFeatured,
      isTaxable: Boolean(p.isTaxable), images: p.images || [],
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

  const handleSuggestSeo = async () => {
    if (!editProduct?._id) return
    setLoadingSeo(true)
    try {
      const { data } = await api.post(`/admin/products/${editProduct._id}/suggest-seo`)
      setSeoSuggestion(data)
      toast.success('SEO suggestion ready')
    } catch (err) {
      toast.error(err.response?.data?.message || 'SEO suggestion failed')
    } finally {
      setLoadingSeo(false)
    }
  }

  const handleApplySeo = async () => {
    if (!editProduct?._id || !seoSuggestion?.suggested) return
    setSaving(true)
    try {
      const { suggested } = seoSuggestion
      await api.post(`/admin/products/${editProduct._id}/apply-seo`, {
        description: suggested.descriptionDraft,
        seoTitle: suggested.seoTitle,
        seoMetaDescription: suggested.seoMetaDescription,
        seoFaqs: suggested.seoFaqs,
      })
      setForm((f) => ({ ...f, description: suggested.descriptionDraft }))
      setSeoSuggestion(null)
      toast.success('SEO fields applied')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Apply failed')
    } finally {
      setSaving(false)
    }
  }

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
                <th style={{ textAlign: 'center' }}>Tax</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={8} className="admin-empty">No products found</td></tr>
              ) : products.map((p) => (
                <tr key={p._id}>
                  <td>
                    <Link
                      to={getProductPath(p)}
                      className="admin-product-cell-link"
                      title="View product page"
                    >
                      <img src={p.images?.[0]?.url || 'https://placehold.co/40x40?text=?'} alt=""
                        style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', border: '1px solid #e8eee8' }} />
                      <div className="admin-product-cell-text">
                        <div className="admin-product-cell-name">{p.name}</div>
                        {p.sku && <div className="admin-product-cell-sku">SKU: {p.sku}</div>}
                      </div>
                    </Link>
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
                    <span className={`admin-badge ${p.isTaxable ? 'green' : 'gray'}`}>
                      {p.isTaxable ? 'Taxable' : 'Exempt'}
                    </span>
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
                <AdminFieldLabel
                  hint="Customer-facing product title shown on the shop, product page, cart, and checkout."
                  required
                >
                  Name
                </AdminFieldLabel>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1 / -1' }} className="auth-field">
                <AdminFieldLabel hint="Full product details for the product page. Used for SEO and the AI description tool when editing.">
                  Description
                </AdminFieldLabel>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} style={{ resize: 'none' }} />
                {modal === 'edit' && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button type="button" onClick={handleSuggestSeo} disabled={loadingSeo} className="btn-admin btn-admin-secondary" style={{ width: 'fit-content', fontSize: 12 }}>
                      <Sparkles size={14} /> {loadingSeo ? 'Generating…' : 'Suggest SEO Description'}
                    </button>
                    {seoSuggestion && (
                      <div style={{ background: '#f7faf7', border: '1px solid #e0e7e0', borderRadius: 10, padding: 14, fontSize: 13 }}>
                        <p style={{ fontWeight: 700, marginBottom: 8 }}>Before / After</p>
                        <p><strong>Title:</strong> {seoSuggestion.original?.seoTitle} → {seoSuggestion.suggested?.seoTitle}</p>
                        <p><strong>Meta:</strong> {seoSuggestion.original?.seoMetaDescription} → {seoSuggestion.suggested?.seoMetaDescription}</p>
                        <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}><strong>Description:</strong><br />{seoSuggestion.suggested?.descriptionDraft}</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button type="button" onClick={handleApplySeo} className="btn-admin btn-admin-primary" style={{ fontSize: 12 }}>Use This</button>
                          <button type="button" onClick={() => setSeoSuggestion(null)} className="btn-admin btn-admin-secondary" style={{ fontSize: 12 }}>Discard</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="auth-field">
                <AdminFieldLabel hint="Selling price in USD. This is what customers pay before tax and shipping." required>
                  Price ($)
                </AdminFieldLabel>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} onWheel={(e) => e.target.blur()} />
              </div>
              <div className="auth-field">
                <AdminFieldLabel hint="Optional “was” price for showing a sale. Leave blank or 0 if not on sale.">
                  Compare Price ($)
                </AdminFieldLabel>
                <input type="number" min="0" step="0.01" value={form.comparePrice} onChange={(e) => setForm((f) => ({ ...f, comparePrice: e.target.value }))} onWheel={(e) => e.target.blur()} />
              </div>
              <div className="auth-field">
                <AdminFieldLabel hint="Shop category for browsing and filters. New categories are created automatically if needed.">
                  Category
                </AdminFieldLabel>
                <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="auth-field">
                <AdminFieldLabel hint="Optional keywords for search and SEO. Leave empty to auto-generate from name, description, and category.">
                  Tags (comma-separated)
                </AdminFieldLabel>
                <input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="vitamins, wellness, supplement" />
              </div>
              <div className="auth-field">
                <AdminFieldLabel hint="Internal stock-keeping ID. Must be unique if set. Used for inventory, restock imports, and order records.">
                  SKU
                </AdminFieldLabel>
                <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
              </div>
              <div className="auth-field">
                <AdminFieldLabel hint="Product barcode (UPC/EAN) for scanning and inventory matching. Optional.">
                  Barcode
                </AdminFieldLabel>
                <input value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
              </div>
              <div className="auth-field">
                <AdminFieldLabel hint="Units available to sell. Checkout is blocked when stock is 0. Restock adds to this number.">
                  Stock
                </AdminFieldLabel>
                <input type="number" min="0" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} onWheel={(e) => e.target.blur()} />
              </div>
              <div className="auth-field">
                <AdminFieldLabel hint="Product weight in kilograms. Used for shipping rate estimates when applicable.">
                  Weight (kg)
                </AdminFieldLabel>
                <input type="number" min="0" step="0.1" value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))} onWheel={(e) => e.target.blur()} />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                <AdminCheckboxOption
                  checked={form.isPublished}
                  onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                  label="Published"
                  hint="When checked, the product is visible on the storefront. Unchecked saves as a draft."
                />
                <AdminCheckboxOption
                  checked={form.isFeatured}
                  onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                  label="Featured"
                  hint="Shows on the home page Best Sellers section and can display a Best Seller badge."
                />
                <AdminCheckboxOption
                  checked={form.isTaxable}
                  onChange={(e) => setForm((f) => ({ ...f, isTaxable: e.target.checked }))}
                  label="Taxable"
                  hint="When checked, sales tax is applied to this product at checkout. Unchecked items are tax-exempt."
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }} className="auth-field">
                <AdminFieldLabel hint="Product photos for the shop and product page. Upload files or paste image URLs. First image is the main thumbnail.">
                  Images
                </AdminFieldLabel>
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
              <AdminFieldLabel hint="Number of units to add to current inventory. This increases stock immediately.">
                Quantity to Add
              </AdminFieldLabel>
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
              <p style={{ fontSize: 13, fontWeight: 600, color: '#3730a3', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Template columns
                <FieldHint text="Download the template first. Each row is one product. Use true/false for isPublished, isFeatured, and isTaxable. Separate multiple image URLs with commas in imageUrls." />
              </p>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#4338ca' }}>name, description, price, comparePrice, category, tags, sku, barcode, stock, weight, isPublished, isFeatured, isTaxable, imageUrls</p>
            </div>
            <button onClick={() => downloadTemplate('bulk-add')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2d7a3a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
              <Download size={14} /> Download Template
            </button>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
                Upload Excel File (.xlsx)
                <FieldHint text="Select a filled .xlsx from the template. Products are created in bulk; new categories in the file are added automatically." />
              </label>
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
              <p style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Template columns
                <FieldHint text="Each row adds stock to an existing product matched by SKU. qty_to_add is added to the current stock level." />
              </p>
              <p style={{ fontSize: 11, fontFamily: 'monospace', color: '#047857' }}>sku, qty_to_add</p>
            </div>
            <button onClick={() => downloadTemplate('bulk-restock')} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#2d7a3a', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
              <Download size={14} /> Download Restock Template
            </button>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>
                Upload Excel File (.xlsx)
                <FieldHint text="Upload the restock template with SKU and quantity. Unknown SKUs are skipped and reported in the result." />
              </label>
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
