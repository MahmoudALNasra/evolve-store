const path = require('path')
const { spawn } = require('child_process')

function getRepoRoot() {
  // server/src/services → repo root
  return process.env.DEPLOY_ROOT
    ? path.resolve(process.env.DEPLOY_ROOT)
    : path.resolve(__dirname, '../../..')
}

function runCommand(command, args, cwd, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', CI: '1' },
      shell: process.platform === 'win32',
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let killed = false

    const timer = setTimeout(() => {
      killed = true
      child.kill('SIGTERM')
      setTimeout(() => child.kill('SIGKILL'), 5000)
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (stdout.length > 80000) stdout = stdout.slice(-80000)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > 80000) stderr = stderr.slice(-80000)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      resolve({
        ok: false,
        code: null,
        error: err.message,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut: false,
      })
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({
        ok: code === 0 && !killed,
        code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        timedOut: killed,
        error: killed ? `Timed out after ${timeoutMs}ms` : null,
      })
    })
  })
}

function tail(text, max = 2500) {
  const value = String(text || '')
  if (value.length <= max) return value
  return value.slice(-max)
}

function getPm2AppName() {
  return String(process.env.PM2_APP_NAME || 'evolve-api').trim() || 'evolve-api'
}

/**
 * Restart the API via PM2 after a short delay so the current HTTP response can finish.
 * Fixed command only — app name from env, never from request input.
 */
function scheduleApiRestart(options = {}) {
  const skipRestart = options.skipRestart === true
  if (skipRestart) {
    return { scheduled: false, skipped: true, reason: 'skipRestart' }
  }

  const appName = getPm2AppName()
  // Allow only safe PM2 process names
  if (!/^[a-zA-Z0-9._-]+$/.test(appName)) {
    return { scheduled: false, skipped: true, reason: 'invalid PM2_APP_NAME' }
  }

  const delaySec = Math.min(30, Math.max(1, Number(process.env.DEPLOY_RESTART_DELAY_SEC) || 3))

  try {
    const child = process.platform === 'win32'
      ? spawn(
        'cmd',
        ['/c', `timeout /t ${delaySec} /nobreak >nul & pm2 restart ${appName} --update-env`],
        { detached: true, stdio: 'ignore', windowsHide: true }
      )
      : spawn(
        'sh',
        ['-c', `sleep ${delaySec} && pm2 restart ${appName} --update-env`],
        { detached: true, stdio: 'ignore' }
      )
    child.unref()
    return { scheduled: true, appName, delaySec }
  } catch (err) {
    return { scheduled: false, skipped: true, reason: err.message, appName }
  }
}

/**
 * Pull latest main (ff-only), rebuild the Vite client into client/dist,
 * then schedule a PM2 API restart so new server routes go live too.
 * Fixed commands only — no arbitrary shell input.
 */
async function deployFrontend(options = {}) {
  const skipPull = options.skipPull === true
  const skipRestart = options.skipRestart === true
  const repoRoot = getRepoRoot()
  const clientDir = path.join(repoRoot, 'client')
  const steps = []

  if (!skipPull) {
    const pull = await runCommand('git', ['pull', '--ff-only'], repoRoot, 120000)
    steps.push({
      step: 'git pull --ff-only',
      cwd: repoRoot,
      ok: pull.ok,
      code: pull.code,
      timedOut: pull.timedOut,
      stdout: tail(pull.stdout),
      stderr: tail(pull.stderr),
      error: pull.error,
    })
    if (!pull.ok) {
      return {
        ok: false,
        repoRoot,
        summary: 'git pull failed — fix the server repo (conflicts / auth) then retry.',
        steps,
      }
    }
  } else {
    steps.push({ step: 'git pull', skipped: true, ok: true })
  }

  const build = await runCommand('npm', ['run', 'build'], clientDir, 10 * 60 * 1000)
  steps.push({
    step: 'npm run build',
    cwd: clientDir,
    ok: build.ok,
    code: build.code,
    timedOut: build.timedOut,
    stdout: tail(build.stdout),
    stderr: tail(build.stderr),
    error: build.error,
  })

  if (!build.ok) {
    return {
      ok: false,
      repoRoot,
      summary: 'Client build failed. See build stderr in the result JSON.',
      steps,
    }
  }

  const restart = scheduleApiRestart({ skipRestart })
  steps.push({
    step: `pm2 restart ${getPm2AppName()} --update-env`,
    ok: restart.scheduled || restart.skipped,
    scheduled: restart.scheduled,
    skipped: restart.skipped,
    delaySec: restart.delaySec,
    appName: restart.appName || getPm2AppName(),
    error: restart.reason || null,
  })

  const restartNote = restart.scheduled
    ? ` API restart scheduled in ${restart.delaySec}s (${restart.appName}).`
    : restart.skipped
      ? ' API restart skipped.'
      : ''

  return {
    ok: true,
    repoRoot,
    restart,
    summary: skipPull
      ? `Client rebuilt successfully.${restartNote}`
      : `Pulled latest code, rebuilt the storefront, and scheduled API restart.${restartNote}`,
    steps,
  }
}

module.exports = {
  deployFrontend,
  scheduleApiRestart,
  getRepoRoot,
  getPm2AppName,
}
