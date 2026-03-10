'use strict'

const cp = require('child_process')
const os = require('os')
const { readAgentSyncConfig } = require('./workspace')
const { parseCommandArgv } = require('./io')

/**
 * Run a health-check command safely and asynchronously.
 */
function runCheckCommand(workspaceFolder, command) {
  if (!command || !command.trim()) return Promise.resolve({ ok: false, output: '' })

  const argv = parseCommandArgv(command.trim())
  if (argv.length === 0) return Promise.resolve({ ok: false, output: '' })
  const [program, ...args] = argv
  const resolvedProgram = resolveHealthCheckProgram(program)

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    const proc = cp.spawn(resolvedProgram, args, { cwd: workspaceFolder.uri.fsPath })

    proc.stdout.on('data', (data) => (stdout += data.toString()))
    proc.stderr.on('data', (data) => (stderr += data.toString()))

    const timeoutId = setTimeout(() => {
      proc.kill()
      resolve({ ok: false, output: 'Command timed out after 60s.' })
    }, 60000)

    proc.on('close', (code) => {
      clearTimeout(timeoutId)
      resolve({ ok: code === 0, output: (stdout + stderr).trim() })
    })

    proc.on('error', (err) => {
      clearTimeout(timeoutId)
      resolve({ ok: false, output: `Process error: ${err.message}` })
    })
  })
}

/**
 * Append .cmd shims for common package managers on Windows.
 */
function resolveHealthCheckProgram(program, platform = os.platform()) {
  const normalized = String(program || '').trim()
  if (!normalized || platform !== 'win32') return normalized
  if (/\.(cmd|exe|bat)$/i.test(normalized)) return normalized

  const shimCommands = new Set(['npm', 'npx', 'pnpm', 'pnpx', 'yarn', 'yarnpkg', 'corepack'])
  return shimCommands.has(normalized.toLowerCase()) ? `${normalized}.cmd` : normalized
}

/**
 * Execute configured health checks and return per-check status and output.
 */
async function runHealthChecks(workspaceFolder) {
  const config = readAgentSyncConfig(workspaceFolder)
  const commandMap = {
    Build: config.commands?.build,
    Tests: config.commands?.test || config.commands?.tests,
    Deploy: config.commands?.deploy
  }

  const results = {}
  const outputs = {}
  for (const [label, command] of Object.entries(commandMap)) {
    if (!command || !String(command).trim()) {
      results[label] = 'Not configured'
      outputs[label] = ''
      continue
    }

    const { ok, output } = await runCheckCommand(workspaceFolder, String(command))
    results[label] = ok ? 'Pass' : 'Fail'
    outputs[label] = output
  }

  return { results, outputs }
}

/**
 * Format Current Health section as a markdown table.
 */
function formatHealthTable(health, outputs = {}) {
  const rows = [
    '| Check  | Status |',
    '| ------ | ------ |',
    `| Build  | ${health.Build} |`,
    `| Tests  | ${health.Tests} |`,
    `| Deploy | ${health.Deploy} |`
  ]

  const failures = Object.entries(health).filter(([, status]) => status === 'Fail')
  for (const [label] of failures) {
    const output = (outputs[label] || '').trim()
    if (output) {
      const trimmed = output.split('\n').slice(-20).join('\n')
      rows.push('', `**${label} output:**`, '```', trimmed, '```')
    }
  }

  return rows.join('\n')
}

module.exports = {
  runHealthChecks,
  formatHealthTable,
  runCheckCommand,
  resolveHealthCheckProgram
}
