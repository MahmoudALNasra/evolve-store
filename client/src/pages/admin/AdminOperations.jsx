import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  FileSpreadsheet,
  ImagePlus,
  HardDriveDownload,
  ClipboardCheck,
  PackagePlus,
  Play,
  Loader2,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const JOB_ICONS = {
  'sync-sheet': FileSpreadsheet,
  'pull-inventory': RefreshCw,
  'normalize-stock': PackagePlus,
  'enrich-images': ImagePlus,
  'mirror-images': HardDriveDownload,
  'catalog-audit': ClipboardCheck,
}

function formatDuration(ms) {
  if (!ms && ms !== 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function summarizeResult(job, result) {
  if (!result || typeof result !== 'object') return null
  if (job === 'sync-sheet') {
    return `${result.productCount ?? '—'} products → sheet` +
      (result.verification?.ok === false ? ' (verification warnings)' : '')
  }
  if (job === 'normalize-stock') {
    return `${result.updated ?? result.matched ?? 0} updated (matched ${result.matched ?? 0})`
  }
  if (job === 'catalog-audit') {
    const d = result.descriptions || {}
    return `${result.total} products · ${d.needsWork ?? 0} desc need work · ${result.badTitles ?? 0} bad titles`
  }
  if (job === 'enrich-images' || job === 'mirror-images') {
    return `scanned ${result.scanned ?? result.total ?? '—'} · updated ${result.updated ?? result.optimized ?? result.mirrored ?? 0}`
  }
  if (job === 'pull-inventory') {
    return `updated ${result.updated ?? result.productsUpdated ?? '—'} · skipped ${result.skipped ?? '—'}`
  }
  return null
}

export default function AdminOperations() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dryRunByJob, setDryRunByJob] = useState({})
  const [startingJob, setStartingJob] = useState(null)

  const loadStatus = useCallback(async (silent = false) => {
    try {
      const { data } = await api.get('/admin/ops')
      setStatus(data)
    } catch (err) {
      if (!silent) toast.error(err.response?.data?.message || 'Failed to load operations status')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  useEffect(() => {
    if (!status?.running) return undefined
    const id = setInterval(() => loadStatus(true), 2500)
    return () => clearInterval(id)
  }, [status?.running, loadStatus])

  const startJob = async (job, supportsDryRun) => {
    setStartingJob(job)
    try {
      const body = {}
      if (supportsDryRun && dryRunByJob[job]) body.dryRun = true
      await api.post(`/admin/ops/${job}`, body)
      toast.success(body.dryRun ? 'Dry run started' : 'Job started')
      await loadStatus(true)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start job')
    } finally {
      setStartingJob(null)
    }
  }

  if (loading) {
    return (
      <div className="spinner-wrap">
        <div className="spinner spinner-lg" />
      </div>
    )
  }

  const jobs = status?.jobs || []
  const running = status?.running
  const lastRuns = status?.lastRuns || {}

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Operations</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
            Run catalog sync, image, and audit jobs without SSH. Only one job runs at a time.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => loadStatus()} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {running && (
        <div
          className="admin-card"
          style={{
            marginBottom: 20,
            border: '1px solid #bbf7d0',
            background: '#f0fdf4',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <Loader2 size={18} className="spin" style={{ color: '#15803d' }} />
          <div>
            <strong style={{ color: '#166534' }}>Running: {running.label}</strong>
            <div style={{ fontSize: 13, color: '#15803d' }}>
              Started {new Date(running.startedAt).toLocaleString()}
              {running.params?.dryRun ? ' · dry run' : ''}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {jobs.map((def) => {
          const Icon = JOB_ICONS[def.job] || Play
          const last = lastRuns[def.job]
          const isThisRunning = running?.job === def.job
          const busy = Boolean(running) || startingJob === def.job
          const summary = last?.status === 'done' ? summarizeResult(def.job, last.result) : null

          return (
            <div key={def.job} className="admin-card">
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 14, flex: 1, minWidth: 240 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: '#ecfdf5',
                      color: '#166534',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div>
                    <h2 className="admin-card-title" style={{ marginBottom: 4 }}>{def.label}</h2>
                    <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5, margin: 0 }}>
                      {def.description}
                    </p>
                    {last && (
                      <div style={{ marginTop: 10, fontSize: 12, color: '#4b5563' }}>
                        Last run:{' '}
                        <span style={{ fontWeight: 600, color: last.status === 'done' ? '#166534' : '#b91c1c' }}>
                          {last.status}
                        </span>
                        {' · '}
                        {formatDuration(last.durationMs)}
                        {' · '}
                        {new Date(last.finishedAt).toLocaleString()}
                        {last.params?.dryRun || last.result?.dryRun ? ' · was dry run' : ''}
                        {summary && (
                          <div style={{ marginTop: 4, color: '#374151' }}>{summary}</div>
                        )}
                        {last.error && (
                          <div style={{ marginTop: 4, color: '#b91c1c' }}>{last.error}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
                  {def.supportsDryRun && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#4b5563', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(dryRunByJob[def.job])}
                        onChange={(e) => setDryRunByJob((prev) => ({ ...prev, [def.job]: e.target.checked }))}
                        disabled={busy}
                      />
                      Dry run
                    </label>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => startJob(def.job, def.supportsDryRun)}
                    style={{ display: 'inline-flex', gap: 8, alignItems: 'center', opacity: busy ? 0.6 : 1 }}
                  >
                    {isThisRunning || startingJob === def.job ? (
                      <Loader2 size={15} className="spin" />
                    ) : (
                      <Play size={15} />
                    )}
                    {isThisRunning ? 'Running…' : 'Run'}
                  </button>
                </div>
              </div>

              {last?.status === 'done' && last.result && (
                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>View full result JSON</summary>
                  <pre
                    style={{
                      marginTop: 8,
                      maxHeight: 240,
                      overflow: 'auto',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 11,
                      lineHeight: 1.45,
                    }}
                  >
                    {JSON.stringify(last.result, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
