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
      <div className="admin-analytics-stat-value">{value}</div>
    </div>
  )
}

export default function AdminAnalytics() {
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState(defaultRange)
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState(null)
  const [pages, setPages] = useState([])
  const [journeys, setJourneys] = useState([])
  const [heatmap, setHeatmap] = useState(null)
  const [heatmapPage, setHeatmapPage] = useState('')

  const params = useMemo(() => ({
    from: new Date(`${range.from}T00:00:00`).toISOString(),
    to: new Date(`${range.to}T23:59:59`).toISOString(),
  }), [range.from, range.to])

  const load = async () => {
    setLoading(true)
    try {
      const requests = [
        api.get('/admin/analytics/overview', { params }),
        api.get('/admin/analytics/pages', { params }),
        api.get('/admin/analytics/journeys', { params }),
        api.get('/admin/analytics/heatmap', { params: { ...params, page: heatmapPage || undefined } }),
      ]
      const [overviewRes, pagesRes, journeysRes, heatmapRes] = await Promise.all(requests)
      setOverview(overviewRes.data)
      setPages(pagesRes.data.pages || [])
      setJourneys(journeysRes.data.journeys || [])
      setHeatmap(heatmapRes.data)
      if (!heatmapPage && heatmapRes.data?.page) setHeatmapPage(heatmapRes.data.page)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [range.from, range.to, heatmapPage])

  const maxPageViews = Math.max(...(overview?.dailyPageViews?.map((d) => d.views) || [1]), 1)
  const maxHeat = Math.max(...(heatmap?.points?.map((p) => p.count) || [1]), 1)

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
      ) : (
        <>
          {tab === 'overview' && overview && (
            <div className="admin-analytics-panel">
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
              <div className="admin-analytics-bars">
                {overview.dailyPageViews.map((row) => (
                  <div key={row.date} className="admin-analytics-bar-row">
                    <span className="admin-analytics-bar-label">{row.date}</span>
                    <div className="admin-analytics-bar-track">
                      <div className="admin-analytics-bar-fill" style={{ width: `${(row.views / maxPageViews) * 100}%` }} />
                    </div>
                    <span className="admin-analytics-bar-value">{row.views}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'pages' && (
            <div className="admin-card admin-analytics-panel">
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
            </div>
          )}

          {tab === 'journeys' && (
            <div className="admin-analytics-panel">
              {journeys.map((j) => (
                <div key={j.sessionId} className="admin-journey-card">
                  <div className="admin-journey-meta">
                    {j.pageCount} pages · {new Date(j.startedAt).toLocaleString()}
                  </div>
                  <div className="admin-journey-path">
                    {j.steps.map((step, i) => (
                      <span key={`${j.sessionId}-${i}`}>
                        {i > 0 && <span className="admin-journey-arrow">→</span>}
                        <code>{step.path}</code>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'heatmap' && heatmap && (
            <div className="admin-analytics-panel">
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
              <p className="admin-analytics-note">{heatmap.totalClicks} clicks on <code>{heatmap.page}</code></p>
              <div className="admin-heatmap-stage">
                {heatmap.points.map((point, i) => (
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
            </div>
          )}
        </>
      )}
    </div>
  )
}
