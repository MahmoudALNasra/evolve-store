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

/**
 * Pull latest main (ff-only) and rebuild the Vite client into client/dist.
 * Fixed commands only — no arbitrary shell input.
 */
async function deployFrontend(options = {}) {
  const skipPull = options.skipPull === true
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

  return {
    ok: true,
    repoRoot,
    summary: skipPull
      ? 'Client rebuilt successfully (no git pull).'
      : 'Pulled latest code and rebuilt the storefront client.',
    steps,
  }
}

module.exports = {
  deployFrontend,
  getRepoRoot,
}
