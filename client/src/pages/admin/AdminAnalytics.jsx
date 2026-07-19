import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Flame, Route, TrendingUp } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const TABS = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'pages', label: 'Top Pages', icon: BarChart3 },
  { id: 'journeys', label: 'User Journeys', icon: Route },
  { id: 'heatmap', label: 'Heatmap', icon: Flame },
]

function defaultRange() {
  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  }
}

function StatCard({ label, value }) {
  return (
    <div className="admin-analytics-stat">
      <div className="admin-analytics-stat-label">{label}</div>
      <div className="admin-analytics-stat-value">{value ?? 0}</div>
    </div>
  )
}

export default function AdminAnalytics() {
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState(null)
  const [pages, setPages] = useState([])
  const [journeys, setJourneys] = useState([])
  const [heatmap, setHeatmap] = useState(null)
  const [heatmapPage, setHeatmapPage] = useState('')

  const params = useMemo(() => {
    const fromDate = new Date(`${range.from}T00:00:00`)
    const toDate = new Date(`${range.to}T23:59:59`)
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return null
    }
    return {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    }
  }, [range.from, range.to])

  useEffect(() => {
    if (!params) return undefined
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const requests = [
          api.get('/admin/analytics/overview', { params }),
          api.get('/admin/analytics/pages', { params }),
          api.get('/admin/analytics/journeys', { params }),
          api.get('/admin/analytics/heatmap', {
            params: { ...params, page: heatmapPage || undefined },
          }),
        ]
        const [overviewRes, pagesRes, journeysRes, heatmapRes] = await Promise.all(requests)
        if (cancelled) return

        setOverview(overviewRes.data || null)
        setPages(Array.isArray(pagesRes.data?.pages) ? pagesRes.data.pages : [])
        setJourneys(Array.isArray(journeysRes.data?.journeys) ? journeysRes.data.journeys : [])
        setHeatmap(heatmapRes.data || null)

        const suggested = heatmapRes.data?.page
        if (!heatmapPage && suggested) {
          setHeatmapPage(suggested)
        }
      } catch (err) {
        if (cancelled) return
        const message = err.response?.data?.message || 'Failed to load analytics'
        setError(message)
        toast.error(message)
        setOverview(null)
        setPages([])
        setJourneys([])
        setHeatmap(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [params, heatmapPage])

  const daily = Array.isArray(overview?.dailyPageViews) ? overview.dailyPageViews : []
  const heatPoints = Array.isArray(heatmap?.points) ? heatmap.points : []
  const maxPageViews = Math.max(1, ...daily.map((d) => Number(d.views) || 0), 1)
  const maxHeat = Math.max(1, ...heatPoints.map((p) => Number(p.count) || 0), 1)

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">Analytics & Heatmap</h1>
        <div className="admin-analytics-filters">
          <label>
            From
            <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          </label>
          <label>
            To
            <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          </label>
        </div>
      </div>

      <div className="admin-analytics-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`admin-analytics-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner-wrap"><div className="spinner spinner-lg" /></div>
      ) : error ? (
        <div className="admin-card" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>
          <strong>Analytics unavailable</strong>
          <p style={{ marginTop: 8 }}>{error}</p>
          <p style={{ marginTop: 8, fontSize: 13, color: '#7f1d1d' }}>
            Usually this means Supabase analytics env vars are missing on the server
            (<code>SUPABASE_URL</code> / <code>SUPABASE_SERVICE_ROLE_KEY</code>).
          </p>
        </div>
      ) : (
        <>
          {tab === 'overview' && (
            <div className="admin-analytics-panel">
              {overview ? (
                <>
                  <div className="admin-analytics-stats">
                    <StatCard label="Page views" value={overview.pageViews} />
                    <StatCard label="Unique visitors" value={overview.uniqueVisitors} />
                    <StatCard label="Sessions" value={overview.uniqueSessions} />
                    <StatCard label="Clicks tracked" value={overview.clicks} />
                  </div>
                  {overview.truncated && (
                    <p className="admin-analytics-note">Showing the most recent {overview.totalEvents} events in range.</p>
                  )}
                  <h3 className="admin-analytics-subtitle">Daily page views</h3>
                  {daily.length === 0 ? (
                    <p className="admin-analytics-note">No page views in this range yet.</p>
                  ) : (
                    <div className="admin-analytics-bars">
                      {daily.map((row) => (
                        <div key={row.date} className="admin-analytics-bar-row">
                          <span className="admin-analytics-bar-label">{row.date}</span>
                          <div className="admin-analytics-bar-track">
                            <div className="admin-analytics-bar-fill" style={{ width: `${(row.views / maxPageViews) * 100}%` }} />
                          </div>
                          <span className="admin-analytics-bar-value">{row.views}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="admin-analytics-note">No overview data.</p>
              )}
            </div>
          )}

          {tab === 'pages' && (
            <div className="admin-card admin-analytics-panel">
              {pages.length === 0 ? (
                <p className="admin-analytics-note">No page data in this range.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr><th>Page</th><th style={{ textAlign: 'right' }}>Views</th></tr>
                  </thead>
                  <tbody>
                    {pages.map((row) => (
                      <tr key={row.path}>
                        <td><code>{row.path}</code></td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'journeys' && (
            <div className="admin-analytics-panel">
              {journeys.length === 0 ? (
                <p className="admin-analytics-note">No journeys in this range.</p>
              ) : (
                journeys.map((j) => (
                  <div key={j.sessionId} className="admin-journey-card">
                    <div className="admin-journey-meta">
                      {j.pageCount} pages · {j.startedAt ? new Date(j.startedAt).toLocaleString() : '—'}
                    </div>
                    <div className="admin-journey-path">
                      {(j.steps || []).map((step, i) => (
                        <span key={`${j.sessionId}-${i}`}>
                          {i > 0 && <span className="admin-journey-arrow">→</span>}
                          <code>{step.path}</code>
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'heatmap' && (
            <div className="admin-analytics-panel">
              {!heatmap ? (
                <p className="admin-analytics-note">No heatmap data.</p>
              ) : (
                <>
                  <div className="admin-analytics-filters">
                    <label>
                      Page
                      <select value={heatmapPage} onChange={(e) => setHeatmapPage(e.target.value)}>
                        {(heatmap.topPages || []).map((p) => (
                          <option key={p.path} value={p.path}>{p.path} ({p.clicks})</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="admin-analytics-note">{heatmap.totalClicks || 0} clicks on <code>{heatmap.page || heatmapPage || '—'}</code></p>
                  <div className="admin-heatmap-stage">
                    {heatPoints.map((point, i) => (
                      <span
                        key={`${point.x}-${point.y}-${i}`}
                        className="admin-heatmap-dot"
                        style={{
                          left: `${point.x}%`,
                          top: `${point.y}%`,
                          opacity: 0.25 + (point.count / maxHeat) * 0.75,
                          transform: `translate(-50%, -50%) scale(${0.8 + (point.count / maxHeat) * 1.4})`,
                        }}
                        title={`${point.count} clicks`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
