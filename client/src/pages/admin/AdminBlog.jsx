import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, RefreshCw, Eye, Trash2, CheckCircle, XCircle, ExternalLink, Sparkles, ImageIcon,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import { getArticlePath } from '../../lib/blogSeo'

const EMPTY_TOPIC = {
  topic: '',
  category: 'wellness',
  sourceUrl: '',
  sourceName: 'Evolve Specialty Pharmacy & Wellness',
}

export default function AdminBlog() {
  const [articles, setArticles] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [topicForm, setTopicForm] = useState(EMPTY_TOPIC)
  const [selected, setSelected] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (statusFilter) params.status = statusFilter
    api.get('/admin/blog', { params })
      .then(({ data }) => {
        setArticles(data.articles)
        setTotal(data.total)
        setPages(data.pages)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [page, statusFilter])

  const openEdit = (article) => {
    setSelected(article)
    setEditForm({
      title: article.title,
      meta_description: article.meta_description,
      content: article.content,
      key_takeaways: (article.key_takeaways || []).join('\n'),
      category: article.category,
      source_name: article.source_name,
      source_url: article.source_url,
      image_url: article.image_url,
      seo_keywords: (article.seo_keywords || []).join(', '),
    })
  }

  const handleSave = async () => {
    if (!selected || !editForm) return
    setSaving(true)
    try {
      const payload = {
        ...editForm,
        key_takeaways: editForm.key_takeaways
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, 3),
        seo_keywords: editForm.seo_keywords
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }
      await api.put(`/admin/blog/${selected._id}`, payload)
      toast.success('Article updated')
      setSelected(null)
      setEditForm(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async (article) => {
    try {
      await api.post(`/admin/blog/${article._id}/publish`)
      toast.success('Article published')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Publish failed')
    }
  }

  const handleUnpublish = async (article) => {
    try {
      await api.post(`/admin/blog/${article._id}/unpublish`)
      toast.success('Article moved to draft')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unpublish failed')
    }
  }

  const handleRegenerate = async (article) => {
    setGenerating(true)
    try {
      const { data } = await api.post(`/admin/blog/${article._id}/regenerate`)
      toast.success('New draft generated')
      openEdit(data)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Regeneration failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (article) => {
    if (!window.confirm(`Delete "${article.title}"?`)) return
    try {
      await api.delete(`/admin/blog/${article._id}`)
      toast.success('Article deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed')
    }
  }

  const handleTopicGenerate = async (e) => {
    e.preventDefault()
    if (!topicForm.topic.trim()) return toast.error('Topic is required')
    setGenerating(true)
    try {
      const { data } = await api.post('/admin/blog/generate/topic', topicForm)
      toast.success('Draft generated from topic')
      setTopicForm(EMPTY_TOPIC)
      openEdit(data)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleAuditImages = async () => {
    setGenerating(true)
    try {
      const { data } = await api.post('/admin/blog/audit-images', { limit: 20 })
      toast.success(`Audited ${data.scanned} products, removed ${data.totalRemoved} broken images`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Image audit failed')
    } finally {
      setGenerating(false)
    }
  }

  const previewPath = (article) => `${getArticlePath(article)}?preview=1`

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">
          Blog <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 18 }}>({total})</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={handleAuditImages} disabled={generating} className="btn-admin btn-admin-secondary">
            <ImageIcon size={15} /> Audit Product Images
          </button>
        </div>
      </div>

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Generate from topic</h2>
        <form onSubmit={handleTopicGenerate} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 12 }}>
          <input
            value={topicForm.topic}
            onChange={(e) => setTopicForm((f) => ({ ...f, topic: e.target.value }))}
            placeholder="Topic e.g. How to choose a quality multivitamin"
            className="admin-input"
          />
          <input
            value={topicForm.category}
            onChange={(e) => setTopicForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="Category"
            className="admin-input"
          />
          <input
            value={topicForm.sourceUrl}
            onChange={(e) => setTopicForm((f) => ({ ...f, sourceUrl: e.target.value }))}
            placeholder="Source URL (optional)"
            className="admin-input"
          />
          <button type="submit" disabled={generating} className="btn-admin btn-admin-primary">
            <Sparkles size={15} /> Generate
          </button>
        </form>
        <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
          Articles are saved as drafts. Review, edit, then publish explicitly.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'draft', 'published'].map((status) => (
          <button
            key={status || 'all'}
            type="button"
            onClick={() => { setStatusFilter(status); setPage(1) }}
            className={`btn-admin btn-admin-sm ${statusFilter === status ? 'btn-admin-primary' : 'btn-admin-secondary'}`}
          >
            {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
          </button>
        ))}
      </div>

      <div className="admin-card">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Category</th>
                <th>Product</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.length === 0 ? (
                <tr><td colSpan={5} className="admin-empty">No articles yet</td></tr>
              ) : articles.map((article) => (
                <tr key={article._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1c2b1c' }}>{article.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{article.slug}</div>
                  </td>
                  <td>{article.category}</td>
                  <td>{article.product?.name || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`admin-badge ${article.status === 'published' ? 'green' : 'gray'}`}>
                      {article.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => openEdit(article)} title="Edit" className="btn-admin btn-admin-sm btn-admin-secondary">
                        Edit
                      </button>
                      <Link to={previewPath(article)} target="_blank" className="btn-admin btn-admin-sm btn-admin-secondary" title="Preview">
                        <Eye size={14} />
                      </Link>
                      {article.status === 'draft' ? (
                        <button type="button" onClick={() => handlePublish(article)} title="Publish" className="btn-admin btn-admin-sm btn-admin-primary">
                          <CheckCircle size={14} />
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleUnpublish(article)} title="Unpublish" className="btn-admin btn-admin-sm btn-admin-secondary">
                          <XCircle size={14} />
                        </button>
                      )}
                      <button type="button" onClick={() => handleRegenerate(article)} disabled={generating} title="Generate new draft" className="btn-admin btn-admin-sm btn-admin-secondary">
                        <RefreshCw size={14} />
                      </button>
                      <button type="button" onClick={() => handleDelete(article)} title="Delete" className="btn-admin btn-admin-sm btn-admin-danger">
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
            <button key={p} type="button" onClick={() => setPage(p)} className={page === p ? 'active' : ''}>{p}</button>
          ))}
        </div>
      )}

      {selected && editForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', padding: 16 }}>
          <div className="admin-card" style={{ width: '100%', maxWidth: 960, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Edit draft</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <Link to={previewPath(selected)} target="_blank" className="btn-admin btn-admin-secondary">
                  <ExternalLink size={14} /> Preview
                </Link>
                {selected.status === 'draft' && (
                  <button type="button" onClick={() => handlePublish(selected)} className="btn-admin btn-admin-primary">
                    Publish
                  </button>
                )}
                <button type="button" onClick={() => { setSelected(null); setEditForm(null) }} className="btn-admin btn-admin-secondary">Close</button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <div className="auth-field">
                <label>Title</label>
                <input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="auth-field">
                <label>Meta description</label>
                <textarea value={editForm.meta_description} onChange={(e) => setEditForm((f) => ({ ...f, meta_description: e.target.value }))} rows={2} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="auth-field">
                  <label>Category</label>
                  <input value={editForm.category} onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))} />
                </div>
                <div className="auth-field">
                  <label>Hero image URL</label>
                  <input value={editForm.image_url} onChange={(e) => setEditForm((f) => ({ ...f, image_url: e.target.value }))} />
                </div>
              </div>
              <div className="auth-field">
                <label>Key takeaways (one per line, max 3)</label>
                <textarea value={editForm.key_takeaways} onChange={(e) => setEditForm((f) => ({ ...f, key_takeaways: e.target.value }))} rows={3} />
              </div>
              <div className="auth-field">
                <label>SEO keywords (comma-separated)</label>
                <input value={editForm.seo_keywords} onChange={(e) => setEditForm((f) => ({ ...f, seo_keywords: e.target.value }))} />
              </div>
              <div className="auth-field">
                <label>Content (markdown)</label>
                <textarea value={editForm.content} onChange={(e) => setEditForm((f) => ({ ...f, content: e.target.value }))} rows={16} style={{ fontFamily: 'monospace', fontSize: 13 }} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-admin btn-admin-primary">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
