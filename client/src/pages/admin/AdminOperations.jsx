import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw,
  FileSpreadsheet,
  ImagePlus,
  HardDriveDownload,
  ClipboardCheck,
  PackagePlus,
  Trash2,
  Combine,
  Rocket,
  Play,
  Loader2,
} from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

const JOB_ICONS = {
  'rebuild-frontend': Rocket,
  'sync-sheet': FileSpreadsheet,
  'delete-unpublished': Trash2,
  'purge-unpublished-and-sync': Combine,
  'pull-inventory': RefreshCw,
  'normalize-stock': PackagePlus,
  'enrich-images': ImagePlus,
  'mirror-images': HardDriveDownload,
  'catalog-audit': ClipboardCheck,
}

const DESTRUCTIVE_JOBS = new Set(['delete-unpublished', 'purge-unpublished-and-sync'])

function formatDuration(ms) {
  if (!ms && ms !== 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const sec = Math.round(ms / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

function summarizeResult(job, result) {
  if (!result || typeof result !== 'object') return null
  if (job === 'rebuild-frontend') {
    return result.summary || (result.ok ? 'Storefront rebuilt' : 'Rebuild failed')
  }
  if (job === 'purge-unpublished-and-sync') {
    return result.summary
      || `${result.dryRun ? 'Dry run' : 'Done'}: delete ${result.deleted?.matched ?? 0}, sheet ${result.sheet?.productCount ?? '—'}`
  }
  if (job === 'sync-sheet') {
    return `${result.productCount ?? '—'} products → sheet`
  }
  if (job === 'delete-unpublished') {
    const prefix = result.dryRun ? 'Dry run: would delete ' : 'Deleted '
    return `${prefix}${result.matched ?? result.deleted ?? 0} unpublished product(s)`
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
  const [loadError, setLoadError] = useState('')
  const [dryRunByJob, setDryRunByJob] = useState({
    'delete-unpublished': true,
    'purge-unpublished-and-sync': true,
  })
  const [startingJob, setStartingJob] = useState(null)
  const [lastOutcome, setLastOutcome] = useState(null)

  const loadStatus = useCallback(async (silent = false) => {
    try {
      const { data } = await api.get('/admin/ops')
      setStatus(data)
      setLoadError('')
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to load operations status'
      setLoadError(message)
      if (!silent) toast.error(message)
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
    const dryRun = supportsDryRun && Boolean(dryRunByJob[job])

    if (job === 'rebuild-frontend') {
      const ok = window.confirm(
        'This will run on the server:\n\n  git pull --ff-only\n  cd client && npm run build\n\nTakes 1–3 minutes. Continue?'
      )
      if (!ok) return
    }

    if (!dryRun && DESTRUCTIVE_JOBS.has(job)) {
      const unpublished = status?.counts?.unpublished ?? '?'
      const ok = window.confirm(
        `This will PERMANENTLY delete ${unpublished} unpublished product(s) from the website database` +
        (job === 'purge-unpublished-and-sync' ? ', then rewrite the Google Products sheet with published products only' : '') +
        '.\n\nDry run is OFF. Continue?'
      )
      if (!ok) return
    }

    setStartingJob(job)
    setLastOutcome(null)
    try {
      const body = {}
      if (supportsDryRun && dryRun) body.dryRun = true

      // Long jobs can take a few minutes (sheet write). Raise timeout.
      const { data } = await api.post(`/admin/ops/${job}`, body, { timeout: 10 * 60 * 1000 })

      if (data.waited) {
        setLastOutcome(data)
        if (data.counts) {
          setStatus((prev) => ({ ...(prev || {}), counts: data.counts, lastRuns: {
            ...(prev?.lastRuns || {}),
            [job]: {
              job,
              label: data.label,
              status: 'done',
              startedAt: data.startedAt,
              finishedAt: data.finishedAt,
              durationMs: data.durationMs,
              params: { dryRun: data.dryRun },
              result: data.result,
            },
          } }))
        } else {
          await loadStatus(true)
        }

        const summary = summarizeResult(job, data.result) || data.message || 'Done'
        if (data.dryRun) {
          toast.success(`Dry run finished — no changes. ${summary}`, { duration: 6000 })
        } else {
          toast.success(summary, { duration: 7000 })
        }
      } else {
        toast.success(data.message || 'Job started in background')
        await loadStatus(true)
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Failed to run job'
      toast.error(message, { duration: 8000 })
      setLastOutcome({ ok: false, message, job })
    } finally {
      setStartingJob(null)
      await loadStatus(true)
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
  const counts = status?.counts || null

  const orderedJobs = [...jobs].sort((a, b) => {
    const rank = (job) => {
      if (job === 'rebuild-frontend') return 0
      if (job === 'purge-unpublished-and-sync') return 1
      if (job === 'delete-unpublished') return 2
      if (job === 'sync-sheet') return 3
      return 10
    }
    return rank(a.job) - rank(b.job)
  })

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1 className="admin-page-title">Operations</h1>
          <p style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>
            Catalog cleanup and sync. Dry run = preview only. Uncheck it to make real changes.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => loadStatus()} style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {loadError && (
        <div className="admin-card" style={{ marginBottom: 20, border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b' }}>
          <strong>Could not load Operations API.</strong>
          <div style={{ marginTop: 6 }}>{loadError}</div>
          <div style={{ marginTop: 8, fontSize: 13 }}>
            On the server run: <code>cd /var/www/evolve-store && git pull && cd server && pm2 restart evolve-api --update-env && cd ../client && npm run build</code>
          </div>
        </div>
      )}

      <div
        className="admin-card"
        style={{
          marginBottom: 20,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Total in DB</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{counts ? counts.total : '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Published (live)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#166534' }}>{counts ? counts.published : '—'}</div>
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>Unpublished (draft)</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#b45309' }}>{counts ? counts.unpublished : '—'}</div>
        </div>
      </div>

      {counts && Number(counts.unpublished) > 0 && (
        <div
          className="admin-card"
          style={{ marginBottom: 20, border: '1px solid #fcd34d', background: '#fffbeb', color: '#92400e', fontSize: 14 }}
        >
          <strong>{counts.unpublished} unpublished</strong> products are still in the database.
          Use <strong>Delete unpublished + push sheet</strong> → set Dry run OFF → <strong>Run for real</strong>.
        </div>
      )}

      {lastOutcome?.waited && lastOutcome.result && (
        <div
          className="admin-card"
          style={{
            marginBottom: 20,
            border: lastOutcome.dryRun ? '1px solid #fcd34d' : '1px solid #86efac',
            background: lastOutcome.dryRun ? '#fffbeb' : '#f0fdf4',
          }}
        >
          <strong>{lastOutcome.dryRun ? 'Last result (DRY RUN — no changes)' : 'Last result (LIVE)'}</strong>
          <div style={{ marginTop: 6, fontSize: 14 }}>
            {summarizeResult(lastOutcome.job, lastOutcome.result)}
          </div>
          {lastOutcome.counts && (
            <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
              DB now: {lastOutcome.counts.total} total · {lastOutcome.counts.published} published · {lastOutcome.counts.unpublished} unpublished
            </div>
          )}
        </div>
      )}

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
              {running.params?.dryRun ? ' · DRY RUN' : ' · LIVE'}
            </div>
          </div>
        </div>
      )}

      {!orderedJobs.length && !loadError && (
        <div className="admin-card" style={{ color: '#6b7280' }}>
          No jobs returned from the API. Restart the API after pulling the latest code.
        </div>
      )}

      <div style={{ display: 'grid', gap: 16 }}>
        {orderedJobs.map((def) => {
          const Icon = JOB_ICONS[def.job] || Play
          const last = lastRuns[def.job]
          const isThisRunning = running?.job === def.job || startingJob === def.job
          const busy = Boolean(running) || Boolean(startingJob)
          const summary = last?.status === 'done' ? summarizeResult(def.job, last.result) : null
          const dryRunOn = Boolean(dryRunByJob[def.job])
          const highlight = def.job === 'rebuild-frontend' || def.job === 'purge-unpublished-and-sync'
          const highlightLabel = def.job === 'rebuild-frontend'
            ? '  ← after git push'
            : def.job === 'purge-unpublished-and-sync'
              ? '  ← use this'
              : ''

          return (
            <div
              key={def.job}
              className="admin-card"
              style={highlight ? { border: '1px solid #86efac', background: '#f0fdf4' } : undefined}
            >
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 14, flex: 1, minWidth: 240 }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 10,
                      background: highlight ? '#dcfce7' : '#ecfdf5',
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
                    <h2 className="admin-card-title" style={{ marginBottom: 4 }}>
                      {def.label}
                      {highlightLabel}
                    </h2>
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
                        {last.params?.dryRun || last.result?.dryRun ? (
                          <span style={{ color: '#b45309', fontWeight: 700 }}> · was DRY RUN</span>
                        ) : (
                          <span style={{ color: '#166534' }}> · was LIVE</span>
                        )}
                        {summary && (
                          <div style={{ marginTop: 4, color: '#374151', fontWeight: 600 }}>{summary}</div>
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
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: dryRunOn ? '#b45309' : '#166534', cursor: 'pointer', fontWeight: 600 }}>
                      <input
                        type="checkbox"
                        checked={dryRunOn}
                        onChange={(e) => setDryRunByJob((prev) => ({ ...prev, [def.job]: e.target.checked }))}
                        disabled={busy}
                      />
                      {dryRunOn ? 'Dry run ON (preview only)' : 'Dry run OFF (makes real changes)'}
                    </label>
                  )}
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => startJob(def.job, def.supportsDryRun)}
                    style={{
                      display: 'inline-flex',
                      gap: 8,
                      alignItems: 'center',
                      opacity: busy ? 0.6 : 1,
                      background: !dryRunOn && DESTRUCTIVE_JOBS.has(def.job) ? '#b91c1c' : undefined,
                    }}
                  >
                    {isThisRunning ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                    {isThisRunning ? 'Working…' : dryRunOn && def.supportsDryRun ? 'Preview' : 'Run for real'}
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
