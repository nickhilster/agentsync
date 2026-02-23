const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const PLACEHOLDER = '-'
const DEFAULT_STALE_HOURS = 24
const OPEN_HANDOFF_STATUSES = new Set([
  'queued',
  'in_progress',
  'blocked',
  'ready_for_review',
  'approved'
])

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Returns the templates directory bundled with this extension.
 * @param {vscode.ExtensionContext} context
 */
function getTemplatesDir(context) {
  return path.join(context.extensionPath, 'templates')
}

/**
 * Resolve the AgentTracker.md path for a workspace folder.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getTrackerPath(workspaceFolder) {
  return path.join(workspaceFolder.uri.fsPath, 'AgentTracker.md')
}

/**
 * Resolve the .agentsync.json config path for a workspace folder.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getConfigPath(workspaceFolder) {
  return path.join(workspaceFolder.uri.fsPath, '.agentsync.json')
}

/**
 * Resolve the .agentsync/ runtime directory for a workspace folder.
 * This directory holds state.json, request.json, and result.json.
 * It should be added to .gitignore — initWorkspace does this automatically.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getAgentSyncDir(workspaceFolder) {
  return path.join(workspaceFolder.uri.fsPath, '.agentsync')
}

/**
 * Resolve the state file path.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getStatePath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'state.json')
}

/**
 * Resolve the drop-zone request file path.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getRequestPath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'request.json')
}

/**
 * Resolve the drop-zone result file path.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getResultPath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'result.json')
}

/**
 * Resolve the handoffs file path.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getHandoffsPath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'handoffs.json')
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Whether a parsed value should be treated as empty.
 * @param {string | undefined | null} value
 */
function isEmptyValue(value) {
  const normalized = (value || '').trim()
  return normalized.length === 0 || normalized === PLACEHOLDER || normalized === '—'
}

/**
 * Parse AgentTracker.md content for status and automation.
 * @param {string} content
 */
function parseTracker(content) {
  const pick = (label) => {
    const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`))
    return match?.[1]?.trim() ?? PLACEHOLDER
  }

  return {
    agent: pick('Agent'),
    date: pick('Date'),
    summary: pick('Summary'),
    branch: pick('Branch'),
    commit: pick('Commit')
  }
}

/**
 * Escape a string for use in a regular expression.
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get the content body for a given section heading.
 * @param {string} content
 * @param {string} heading
 * @returns {string}
 */
function getSectionBody(content, heading) {
  const matcher = new RegExp(
    `## ${escapeRegExp(heading)}\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`,
    'm'
  )
  const match = content.match(matcher)
  return match?.[1]?.trim() ?? ''
}

/**
 * Replace a section body and keep the rest of the document intact.
 * @param {string} content
 * @param {string} heading
 * @param {string} body
 * @returns {string}
 */
function setSectionBody(content, heading, body) {
  const normalizedBody = body.trimEnd()
  const matcher = new RegExp(
    `(## ${escapeRegExp(heading)}\\r?\\n\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |$)`,
    'm'
  )

  if (matcher.test(content)) {
    return content.replace(matcher, `$1${normalizedBody}\n`)
  }

  return `${content.trimEnd()}\n\n## ${heading}\n\n${normalizedBody}\n`
}

// ─── Workspace helpers ────────────────────────────────────────────────────────

/**
 * Get active workspace folder without showing prompts.
 * @returns {vscode.WorkspaceFolder | null}
 */
function getActiveWorkspaceFolder() {
  const activeUri = vscode.window.activeTextEditor?.document?.uri
  if (activeUri) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(activeUri)
    if (activeFolder) return activeFolder
  }

  return vscode.workspace.workspaceFolders?.[0] ?? null
}

/**
 * Resolve a workspace folder for a command invocation.
 * @param {{ allowPick?: boolean }} options
 * @returns {Promise<vscode.WorkspaceFolder | null>}
 */
async function resolveWorkspaceFolder(options = {}) {
  const { allowPick = true } = options
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) return null

  const activeFolder = getActiveWorkspaceFolder()
  if (activeFolder) return activeFolder

  if (folders.length === 1 || !allowPick) {
    return folders[0]
  }

  const picks = folders.map((folder) => ({
    label: folder.name,
    description: folder.uri.fsPath,
    folder
  }))

  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select a workspace folder for AgentSync'
  })

  return selected?.folder ?? null
}

// ─── Config reader ────────────────────────────────────────────────────────────

/**
 * Read optional AgentSync configuration.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function readAgentSyncConfig(workspaceFolder) {
  const settings = vscode.workspace.getConfiguration('agentsync', workspaceFolder?.uri)
  const settingsAutoStale = Number(settings.get('autoStaleSessionMinutes', 0))
  const defaults = {
    staleAfterHours: DEFAULT_STALE_HOURS,
    autoStaleSessionMinutes: Number.isFinite(settingsAutoStale) && settingsAutoStale >= 0
      ? settingsAutoStale
      : 0,
    commands: {}
  }
  const configPath = getConfigPath(workspaceFolder)
  if (!fs.existsSync(configPath)) return defaults

  try {
    const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(raw)
    const staleAfterHours = Number(parsed.staleAfterHours)
    const autoStaleSessionMinutes = Number(parsed.autoStaleSessionMinutes)

    return {
      staleAfterHours:
        Number.isFinite(staleAfterHours) && staleAfterHours > 0
          ? staleAfterHours
          : DEFAULT_STALE_HOURS,
      autoStaleSessionMinutes:
        Number.isFinite(autoStaleSessionMinutes) && autoStaleSessionMinutes >= 0
          ? autoStaleSessionMinutes
          : 0,
      commands: parsed.commands && typeof parsed.commands === 'object' ? parsed.commands : {},
      requireHandoffOnEndSession: parsed.requireHandoffOnEndSession === true
    }
  } catch {
    return defaults
  }
}

/**
 * Normalize agent names/ids for comparisons.
 * @param {string | undefined | null} value
 * @returns {string}
 */
function canonicalAgentId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/**
 * Parse normalized In Progress lines from tracker content.
 * @param {string | null} trackerContent
 * @returns {string[]}
 */
function getInProgressLines(trackerContent) {
  if (!trackerContent) return []
  const body = getSectionBody(trackerContent, 'In Progress')
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== '*Nothing active*' && !line.startsWith('<!--'))
}

/**
 * Read .agentsync/handoffs.json when present.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {{ exists: boolean, handoffs: any[], error: string | null }}
 */
function readHandoffs(workspaceFolder) {
  const handoffsPath = getHandoffsPath(workspaceFolder)
  if (!fs.existsSync(handoffsPath)) {
    return { exists: false, handoffs: [], error: null }
  }

  try {
    const raw = fs.readFileSync(handoffsPath, 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(raw)
    const handoffs = Array.isArray(parsed?.handoffs) ? parsed.handoffs : []
    return { exists: true, handoffs, error: null }
  } catch (err) {
    return {
      exists: true,
      handoffs: [],
      error: err && err.message ? err.message : 'Invalid JSON'
    }
  }
}

/**
 * Ensure .agentsync/handoffs.json exists.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function ensureHandoffsFile(workspaceFolder) {
  try {
    fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
    const handoffsPath = getHandoffsPath(workspaceFolder)
    if (!fs.existsSync(handoffsPath)) {
      fs.writeFileSync(handoffsPath, JSON.stringify({ version: 1, handoffs: [] }, null, 2), 'utf8')
    }
  } catch {}
}

/**
 * Write the handoffs store to .agentsync/handoffs.json.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {{ version: number, handoffs: any[] }} data
 */
function writeHandoffs(workspaceFolder, data) {
  fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
  const handoffsPath = getHandoffsPath(workspaceFolder)
  fs.writeFileSync(handoffsPath, JSON.stringify(data, null, 2), 'utf8')
}

/**
 * Validate a handoff record before persisting.
 * @param {any} handoff
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateHandoff(handoff) {
  const errors = []

  if (!handoff.from_agent) errors.push('from_agent is required')
  if (!handoff.summary) errors.push('summary is required')
  if (!handoff.owner_mode) errors.push('owner_mode is required')
  if (!handoff.status) errors.push('status is required')

  const mode = String(handoff.owner_mode || '').toLowerCase()
  const toAgents = Array.isArray(handoff.to_agents) ? handoff.to_agents : []

  if (mode === 'single') {
    if (toAgents.length !== 1) errors.push('owner_mode "single" requires exactly 1 to_agents entry')
  } else if (mode === 'shared') {
    if (toAgents.length !== 2) errors.push('owner_mode "shared" requires exactly 2 to_agents entries')
  } else if (mode === 'auto') {
    const caps = Array.isArray(handoff.required_capabilities) ? handoff.required_capabilities : []
    if (caps.length === 0) errors.push('owner_mode "auto" requires at least one required_capabilities entry')
  } else if (mode !== '') {
    errors.push(`owner_mode must be "single", "shared", or "auto" (got "${mode}")`)
  }

  if (handoff.no_handoff_reason !== null && handoff.no_handoff_reason !== undefined) {
    if (typeof handoff.no_handoff_reason !== 'string' || !handoff.no_handoff_reason.trim()) {
      errors.push('no_handoff_reason must be a non-empty string when provided')
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Determine operational state for panel/status presentation.
 * @param {{ sessionActive?: boolean } | null} state
 * @param {string[]} inProgressLines
 * @param {any[]} handoffs
 * @returns {{ key: 'ready' | 'busy' | 'waiting', label: string, reason: string }}
 */
function getSessionStaleInfo(state, autoStaleSessionMinutes = 0) {
  if (!state?.sessionActive || !state?.activeSession?.startedAt) {
    return { isStale: false, ageMs: null, thresholdMs: null }
  }

  if (!Number.isFinite(autoStaleSessionMinutes) || autoStaleSessionMinutes <= 0) {
    return { isStale: false, ageMs: null, thresholdMs: null }
  }

  const started = Date.parse(state.activeSession.startedAt)
  if (!Number.isFinite(started)) {
    return { isStale: false, ageMs: null, thresholdMs: autoStaleSessionMinutes * 60 * 1000 }
  }

  const ageMs = Date.now() - started
  const thresholdMs = autoStaleSessionMinutes * 60 * 1000
  return { isStale: ageMs >= thresholdMs, ageMs, thresholdMs }
}

function getOperationalState(state, inProgressLines, handoffs, autoStaleSessionMinutes = 0) {
  const staleInfo = getSessionStaleInfo(state, autoStaleSessionMinutes)

  if (state?.sessionActive) {
    if (staleInfo.isStale) {
      const ageLabel = staleInfo.ageMs != null ? formatElapsed(staleInfo.ageMs) : 'unknown duration'
      return {
        key: 'waiting',
        label: 'Waiting',
        reason: `Active session appears stale (running ${ageLabel}). End or clear it before new work.`
      }
    }

    return {
      key: 'busy',
      label: 'Busy',
      reason: 'An active session flag exists. If stale, use "Clear Active Session".'
    }
  }

  const openHandoffs = handoffs.filter((h) => OPEN_HANDOFF_STATUSES.has(String(h?.status || '').toLowerCase()))
  if (inProgressLines.length > 0 || openHandoffs.length > 0) {
    return {
      key: 'waiting',
      label: 'Waiting',
      reason: 'No active session, but pending work/handoffs exist.'
    }
  }

  return { key: 'ready', label: 'Ready', reason: 'No active session and no pending queue.' }
}

/**
 * Lightweight ASCII pulse frames for live state feedback in the panel.
 * @param {'ready' | 'busy' | 'waiting'} stateKey
 * @returns {string}
 */
function getStatePulseFrame(stateKey) {
  const now = Math.floor(Date.now() / 700)
  if (stateKey === 'busy') {
    const frames = ['[01]', '[10]', '[11]', '[00]']
    return frames[now % frames.length]
  }
  if (stateKey === 'waiting') {
    const frames = ['[.]', '[..]', '[...]']
    return frames[now % frames.length]
  }
  return '[idle]'
}

/**
 * Open statuses that still need action.
 * @param {any} handoff
 * @returns {boolean}
 */
function isOpenHandoff(handoff) {
  return OPEN_HANDOFF_STATUSES.has(String(handoff?.status || '').toLowerCase())
}

/**
 * Group handoffs into actionable buckets for UI.
 * @param {any[]} handoffs
 * @param {string} currentAgentId
 * @param {number} staleAfterHours
 */
function getHandoffBuckets(handoffs, currentAgentId, staleAfterHours) {
  const now = Date.now()
  const staleMs = staleAfterHours * 60 * 60 * 1000
  const isMine = (h) => {
    const owners = Array.isArray(h?.to_agents) ? h.to_agents : []
    return owners.map((a) => canonicalAgentId(a)).includes(currentAgentId)
  }
  const isStale = (h) => {
    const stamp = h?.updated_at || h?.created_at
    if (!stamp) return false
    const parsed = Date.parse(stamp)
    if (!Number.isFinite(parsed)) return false
    return now - parsed > staleMs
  }

  const open = handoffs.filter(isOpenHandoff)
  const assignedToMe = open.filter(
    (h) => currentAgentId && isMine(h) && String(h?.owner_mode || '').toLowerCase() === 'single'
  )
  const sharedWithMe = open.filter(
    (h) => currentAgentId && isMine(h) && String(h?.owner_mode || '').toLowerCase() === 'shared'
  )
  const blockedOrStale = open.filter(
    (h) => String(h?.status || '').toLowerCase() === 'blocked' || isStale(h)
  )

  return { open, assignedToMe, sharedWithMe, blockedOrStale }
}

/**
 * Create a nonce for webview script/style tags.
 * @returns {string}
 */
function createNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''
  for (let i = 0; i < 32; i += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

/**
 * Run a git command and return stdout when successful.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string[]} args
 * @returns {string | null}
 */
function runGit(workspaceFolder, args) {
  const result = cp.spawnSync('git', args, {
    cwd: workspaceFolder.uri.fsPath,
    encoding: 'utf8'
  })

  if (result.error || result.status !== 0) return null
  return result.stdout.trim()
}

/**
 * Run a git command and return the exit code.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string[]} args
 * @returns {number}
 */
function runGitExitCode(workspaceFolder, args) {
  const result = cp.spawnSync('git', args, {
    cwd: workspaceFolder.uri.fsPath,
    encoding: 'utf8'
  })

  if (result.error || typeof result.status !== 'number') return 1
  return result.status
}

// ─── Health checks ────────────────────────────────────────────────────────────

/**
 * Run a shell command for build/test/deploy checks.
 * Returns both a pass/fail boolean and the captured stdout+stderr output.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} command
 * @returns {{ ok: boolean, output: string }}
 */
function runCheckCommand(workspaceFolder, command) {
  if (!command || !command.trim()) return { ok: false, output: '' }

  const result = cp.spawnSync(command, {
    cwd: workspaceFolder.uri.fsPath,
    encoding: 'utf8',
    shell: true,
    timeout: 10 * 60 * 1000
  })

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
  return { ok: !result.error && result.status === 0, output }
}

/**
 * Detect changed files for Hot Files using git.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string[]}
 */
function detectHotFiles(workspaceFolder) {
  const collected = new Set()
  const addLines = (output) => {
    if (!output) return
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => collected.add(line))
  }

  addLines(runGit(workspaceFolder, ['diff', '--name-only']))
  addLines(runGit(workspaceFolder, ['diff', '--cached', '--name-only']))
  addLines(runGit(workspaceFolder, ['ls-files', '--others', '--exclude-standard']))

  if (collected.size === 0) {
    addLines(runGit(workspaceFolder, ['show', '--pretty=format:', '--name-only', 'HEAD']))
  }

  return [...collected].sort((a, b) => a.localeCompare(b))
}

/**
 * Execute configured health checks and return per-check status and output.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {{ results: Record<string, string>, outputs: Record<string, string> }}
 */
function runHealthChecks(workspaceFolder) {
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

    const { ok, output } = runCheckCommand(workspaceFolder, String(command))
    results[label] = ok ? 'Pass' : 'Fail'
    outputs[label] = output
  }

  return { results, outputs }
}

/**
 * Format Current Health section as a markdown table.
 * Appends last 20 lines of captured output for any failed checks.
 * @param {Record<string, string>} health
 * @param {Record<string, string>} [outputs]
 * @returns {string}
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

/**
 * Render the ## Agent Handoffs section body for AgentTracker.md.
 * Only open handoffs are included. Returns placeholder when none.
 * @param {any[]} handoffs
 * @returns {string}
 */
function renderTrackerHandoffsSection(handoffs) {
  const open = handoffs.filter(isOpenHandoff)
  if (open.length === 0) return 'No open handoffs.'

  const lines = []
  for (const h of open) {
    const id = String(h.handoff_id || h.task_id || 'unknown')
    const from = String(h.from_agent || 'unknown')
    const to = Array.isArray(h.to_agents) && h.to_agents.length > 0
      ? h.to_agents.join(',')
      : '(none)'
    const mode = String(h.owner_mode || 'unknown')
    const status = String(h.status || 'queued')
    lines.push(`- [ ] ${id} | from: ${from} | to: ${to} | mode: ${mode} | status: ${status}`)

    const taskParts = []
    if (h.task_id) taskParts.push(`task: ${h.task_id}`)
    const files = Array.isArray(h.files) ? h.files : []
    if (files.length > 0) taskParts.push(`files: ${files.map((f) => `\`${f}\``).join(', ')}`)
    if (taskParts.length > 0) lines.push(`  - ${taskParts.join(' | ')}`)

    if (h.notes && h.notes.trim()) lines.push(`  - note: ${h.notes.trim()}`)
  }

  return lines.join('\n')
}

// ─── Tracker I/O ─────────────────────────────────────────────────────────────

/**
 * Open a tracker file in the editor.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
async function openTrackerDocument(workspaceFolder) {
  const trackerPath = getTrackerPath(workspaceFolder)
  const doc = await vscode.workspace.openTextDocument(trackerPath)
  await vscode.window.showTextDocument(doc)
}

/**
 * Focus the AgentSync live dashboard in the Activity Bar.
 * Returns false if VS Code cannot resolve the view commands.
 * @returns {Promise<boolean>}
 */
async function openAgentSyncDashboard() {
  try {
    await vscode.commands.executeCommand('agentsync.dashboard.focus')
    return true
  } catch {}

  try {
    await vscode.commands.executeCommand('workbench.view.extension.agentsync')
    await vscode.commands.executeCommand('agentsync.dashboard.focus')
    return true
  } catch {}

  return false
}

/**
 * Focus the AgentSync panel in the Activity Bar.
 * Prefers the live dashboard and falls back to details tree view.
 * Returns false if VS Code cannot resolve any AgentSync view commands.
 * @returns {Promise<boolean>}
 */
async function openAgentSyncPanel() {
  const dashboardOpened = await openAgentSyncDashboard()
  if (dashboardOpened) return true

  try {
    await vscode.commands.executeCommand('agentsync.panel.focus')
    return true
  } catch {}

  try {
    await vscode.commands.executeCommand('workbench.view.extension.agentsync')
    await vscode.commands.executeCommand('agentsync.panel.focus')
    return true
  } catch {}

  return false
}

/**
 * Open the AgentSync walkthrough in VS Code's Getting Started experience.
 * Returns false if VS Code cannot resolve walkthrough commands.
 * @param {vscode.ExtensionContext} context
 * @returns {Promise<boolean>}
 */
async function openAgentSyncTutorial(context) {
  const manifest = context?.extension?.packageJSON || {}
  const publisher = String(manifest.publisher || 'teambotics')
  const name = String(manifest.name || 'agentsync')
  const extensionId = `${publisher}.${name}`.toLowerCase()
  const walkthroughId = `${extensionId}#agentsync.gettingStarted`

  try {
    await vscode.commands.executeCommand('workbench.action.openWalkthrough', walkthroughId, false)
    return true
  } catch {}

  try {
    await vscode.commands.executeCommand('workbench.action.openWalkthroughs')
    return true
  } catch {}

  return false
}

/**
 * Ensure tracker exists, optionally offering initialization.
 * @param {vscode.ExtensionContext} context
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {Promise<boolean>}
 */
async function ensureTrackerExists(context, workspaceFolder) {
  const trackerPath = getTrackerPath(workspaceFolder)
  if (fs.existsSync(trackerPath)) return true

  const choice = await vscode.window.showWarningMessage(
    `AgentTracker.md not found in "${workspaceFolder.name}". Initialize this workspace first?`,
    'Initialize',
    'Cancel'
  )

  if (choice !== 'Initialize') return false
  await initWorkspace(context, workspaceFolder)
  return fs.existsSync(trackerPath)
}

/**
 * Read tracker file content.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string | null}
 */
function readTracker(workspaceFolder) {
  try {
    return fs.readFileSync(getTrackerPath(workspaceFolder), 'utf8')
  } catch {
    return null
  }
}

/**
 * Write tracker file content.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} content
 */
function writeTracker(workspaceFolder, content) {
  fs.writeFileSync(getTrackerPath(workspaceFolder), content, 'utf8')
}

// ─── State file I/O ───────────────────────────────────────────────────────────

/**
 * Write structured session state to .agentsync/state.json.
 * Agents can read this instead of parsing AgentTracker.md.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {object} data
 */
function writeStateFile(workspaceFolder, data) {
  try {
    fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
    fs.writeFileSync(getStatePath(workspaceFolder), JSON.stringify(data, null, 2), 'utf8')
  } catch {}
}

/**
 * Write a drop-zone action result to .agentsync/result.json.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {object} data
 */
function writeResultFile(workspaceFolder, data) {
  try {
    fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
    fs.writeFileSync(getResultPath(workspaceFolder), JSON.stringify(data, null, 2), 'utf8')
  } catch {}
}

// ─── Tracker warnings ─────────────────────────────────────────────────────────

/**
 * Return warning strings for stale tracker/branch drift.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {{ date: string, branch: string, commit: string }} tracker
 * @returns {string[]}
 */
function getTrackerWarnings(workspaceFolder, tracker) {
  const warnings = []
  const config = readAgentSyncConfig(workspaceFolder)

  if (!isEmptyValue(tracker.date)) {
    const parsed = Date.parse(tracker.date)
    if (Number.isFinite(parsed)) {
      const ageMs = Date.now() - parsed
      if (ageMs > config.staleAfterHours * 60 * 60 * 1000) {
        const ageHours = Math.floor(ageMs / (60 * 60 * 1000))
        warnings.push(`Tracker is stale (${ageHours}h old).`)
      }
    }
  }

  const currentBranch = runGit(workspaceFolder, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (currentBranch && !isEmptyValue(tracker.branch) && tracker.branch !== currentBranch) {
    warnings.push(`Branch mismatch: tracker=${tracker.branch}, current=${currentBranch}.`)
  }

  if (!isEmptyValue(tracker.commit)) {
    const exitCode = runGitExitCode(workspaceFolder, ['merge-base', '--is-ancestor', tracker.commit, 'HEAD'])
    if (exitCode !== 0) {
      warnings.push(`Tracker commit ${tracker.commit} is not in current HEAD history.`)
    }
  }

  return warnings
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────

/**
 * Prompt user for the acting agent.
 * @param {string} defaultAgent
 * @returns {Promise<string | null>}
 */
async function promptForAgent(defaultAgent) {
  const preset = ['Claude', 'Codex', 'Copilot']
  const defaultLabel = !isEmptyValue(defaultAgent) ? defaultAgent : 'Codex'

  const choice = await vscode.window.showQuickPick(
    [
      ...preset.map((name) => ({
        label: name,
        description: name === defaultLabel ? 'default' : undefined
      })),
      { label: 'Other' }
    ],
    { placeHolder: 'Select the agent for this session' }
  )

  if (!choice) return null
  if (choice.label !== 'Other') return choice.label

  const custom = await vscode.window.showInputBox({
    prompt: 'Enter agent name',
    value: defaultLabel !== 'Codex' ? defaultLabel : ''
  })
  if (custom === undefined) return null

  const trimmed = custom.trim()
  return trimmed || null
}

// ─── Core session logic (headless — no VS Code UI) ────────────────────────────
//
// These functions contain the pure tracker mutation logic.
// They are called by the interactive VS Code commands and by the drop-zone API,
// allowing terminal agents and scripts to drive sessions without the UI.

/**
 * Record a session start in AgentTracker.md and write state.json.
 * Throws if the tracker cannot be read.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} agent
 * @param {string} goal
 * @returns {{ agent: string, goal: string }}
 */
function startSessionCore(workspaceFolder, agent, goal) {
  const content = readTracker(workspaceFolder)
  if (!content) throw new Error('Could not read AgentTracker.md')

  const existingTracker = parseTracker(content)
  const normalizedGoal = (goal || '').trim() || 'Session started'
  const entry = `- [ ] ${agent} (${new Date().toISOString()}): ${normalizedGoal}`

  const currentBody = getSectionBody(content, 'In Progress')
  const currentLines = currentBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('<!--'))
    .filter((line) => line && line.toLowerCase() !== '*nothing active*')

  const updatedBody = [...currentLines, entry].join('\n')
  const updated = setSectionBody(content, 'In Progress', updatedBody || '*Nothing active*')
  writeTracker(workspaceFolder, updated)

  writeStateFile(workspaceFolder, {
    sessionActive: true,
    lastUpdated: new Date().toISOString(),
    activeSession: {
      agent,
      goal: normalizedGoal,
      startedAt: new Date().toISOString()
    },
    lastSession: isEmptyValue(existingTracker.agent)
      ? null
      : {
          agent: existingTracker.agent,
          date: existingTracker.date,
          summary: existingTracker.summary,
          branch: existingTracker.branch,
          commit: existingTracker.commit
        }
  })

  return { agent, goal: normalizedGoal }
}

/**
 * Record a session end in AgentTracker.md and write state.json.
 * Runs health checks and captures their output. Throws if the tracker cannot be read.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} agent
 * @param {string} summary
 * @param {string} [nextWork]
 * @param {{ summary: string, notes?: string, owner_mode: string, to_agents?: string[], required_capabilities?: string[], no_handoff_reason?: string } | null} [handoffData]
 * @returns {{ health: Record<string, string>, healthOutputs: Record<string, string>, hotFiles: string[], handoff: object | null }}
 */
function endSessionCore(workspaceFolder, agent, summary, nextWork, handoffData = null) {
  let content = readTracker(workspaceFolder)
  if (!content) throw new Error('Could not read AgentTracker.md')

  const config = readAgentSyncConfig(workspaceFolder)
  const now = new Date().toISOString()
  const branch = runGit(workspaceFolder, ['rev-parse', '--abbrev-ref', 'HEAD']) || PLACEHOLDER
  const commit = runGit(workspaceFolder, ['rev-parse', '--short', 'HEAD']) || PLACEHOLDER
  const hotFiles = detectHotFiles(workspaceFolder)
  const { results: health, outputs: healthOutputs } = runHealthChecks(workspaceFolder)

  // Enforce handoff requirement when hot files exist and flag is on
  if (hotFiles.length > 0 && config.requireHandoffOnEndSession && handoffData === null) {
    throw new Error(
      'Handoff note required when hot files exist. Provide handoffData or set no_handoff_reason.'
    )
  }

  content = setSectionBody(
    content,
    'Last Session',
    [
      `- **Agent:** ${agent}`,
      `- **Date:** ${now}`,
      `- **Summary:** ${(summary || '').trim() || PLACEHOLDER}`,
      `- **Branch:** ${branch}`,
      `- **Commit:** ${commit}`
    ].join('\n')
  )

  content = setSectionBody(content, 'Current Health', formatHealthTable(health, healthOutputs))
  content = setSectionBody(
    content,
    'Hot Files',
    hotFiles.length > 0 ? hotFiles.map((file) => `- \`${file}\``).join('\n') : '*None*'
  )

  const inProgressBody = getSectionBody(content, 'In Progress')
  const remainingInProgress = inProgressBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('<!--'))
    .filter((line) => line)
    .filter((line) => line.toLowerCase() !== '*nothing active*')
    .filter((line) => !line.toLowerCase().includes(agent.toLowerCase()))

  content = setSectionBody(
    content,
    'In Progress',
    remainingInProgress.length > 0 ? remainingInProgress.join('\n') : '*Nothing active*'
  )

  if (nextWork && nextWork.trim()) {
    const existingNext = getSectionBody(content, 'Suggested Next Work')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => !line.startsWith('<!--'))
      .filter((line) => line)

    content = setSectionBody(
      content,
      'Suggested Next Work',
      [...existingNext, `- ${nextWork.trim()}`].join('\n')
    )
  }

  // Persist handoff record if provided
  let handoffRecord = null
  if (handoffData !== null) {
    const existingHandoffs = readHandoffs(workspaceFolder)
    const allHandoffs = existingHandoffs.handoffs
    const dateStr = now.slice(0, 10).replace(/-/g, '')
    const seq = String(allHandoffs.length + 1).padStart(3, '0')
    const handoffId = `HO-${dateStr}-${seq}`

    if (handoffData.no_handoff_reason) {
      // Skip record — agent opted out with an explicit reason
      handoffRecord = {
        handoff_id: handoffId,
        task_id: null,
        from_agent: canonicalAgentId(agent),
        to_agents: [],
        owner_mode: 'single',
        status: 'queued',
        required_capabilities: [],
        summary: '',
        notes: '',
        no_handoff_reason: handoffData.no_handoff_reason.trim(),
        files: hotFiles,
        branch,
        commit,
        prior_attempts: 0,
        created_at: now,
        updated_at: now,
        state_history: [{ status: 'queued', agent: canonicalAgentId(agent), timestamp: now, reason: 'skipped' }]
      }
    } else {
      // Full handoff record
      handoffRecord = {
        handoff_id: handoffId,
        task_id: handoffData.task_id || null,
        from_agent: canonicalAgentId(agent),
        to_agents: (handoffData.to_agents || []).map((a) => canonicalAgentId(a)),
        owner_mode: String(handoffData.owner_mode || 'single').toLowerCase(),
        status: 'queued',
        required_capabilities: handoffData.required_capabilities || [],
        summary: (handoffData.summary || '').trim(),
        notes: (handoffData.notes || '').trim(),
        no_handoff_reason: null,
        files: hotFiles,
        branch,
        commit,
        prior_attempts: 0,
        created_at: now,
        updated_at: now,
        state_history: [{ status: 'queued', agent: canonicalAgentId(agent), timestamp: now, reason: 'session ended with hot files' }]
      }

      const { valid, errors } = validateHandoff(handoffRecord)
      if (!valid) throw new Error(`Invalid handoff: ${errors.join('; ')}`)
    }

    const updatedHandoffs = [...allHandoffs, handoffRecord]
    writeHandoffs(workspaceFolder, { version: 1, handoffs: updatedHandoffs })
    content = setSectionBody(content, 'Agent Handoffs', renderTrackerHandoffsSection(updatedHandoffs))
  } else {
    // Re-render the handoffs section from current store (in case handoffs changed externally)
    const existingHandoffs = readHandoffs(workspaceFolder)
    if (existingHandoffs.handoffs.length > 0) {
      content = setSectionBody(content, 'Agent Handoffs', renderTrackerHandoffsSection(existingHandoffs.handoffs))
    }
  }

  writeTracker(workspaceFolder, content)

  // Compute open handoff summary for state.json so the panel can read it without opening handoffs.json
  const currentHandoffs = readHandoffs(workspaceFolder)
  const openHandoffs = currentHandoffs.handoffs.filter(isOpenHandoff)

  writeStateFile(workspaceFolder, {
    sessionActive: false,
    lastUpdated: now,
    activeSession: null,
    lastSession: {
      agent,
      date: now,
      summary: (summary || '').trim() || PLACEHOLDER,
      branch,
      commit
    },
    health: Object.fromEntries(
      Object.entries(health).map(([label, status]) => [
        label,
        { status, output: healthOutputs[label] || '' }
      ])
    ),
    hotFiles,
    openHandoffCount: openHandoffs.length,
    activeHandoffIds: openHandoffs.map((h) => String(h.handoff_id || h.task_id || ''))
  })

  return { health, healthOutputs, hotFiles, handoff: handoffRecord }
}

/**
 * Clear an active session flag without running End Session health checks.
 * Useful when a session was left open accidentally.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {{ cleared: boolean, agent: string | null }}
 */
function clearActiveSessionCore(workspaceFolder) {
  const statePath = getStatePath(workspaceFolder)
  if (!fs.existsSync(statePath)) return { cleared: false, agent: null }

  let state
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    return { cleared: false, agent: null }
  }

  if (!state?.sessionActive || !state?.activeSession) {
    return { cleared: false, agent: null }
  }

  const agent = String(state.activeSession.agent || '').trim() || null
  const content = readTracker(workspaceFolder)
  if (content) {
    const inProgressBody = getSectionBody(content, 'In Progress')
    const remaining = inProgressBody
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => !line.startsWith('<!--'))
      .filter((line) => line)
      .filter((line) => line.toLowerCase() !== '*nothing active*')
      .filter((line) => !agent || !line.toLowerCase().includes(agent.toLowerCase()))

    const updated = setSectionBody(
      content,
      'In Progress',
      remaining.length > 0 ? remaining.join('\n') : '*Nothing active*'
    )
    writeTracker(workspaceFolder, updated)
  }

  writeStateFile(workspaceFolder, {
    ...state,
    sessionActive: false,
    activeSession: null,
    lastUpdated: new Date().toISOString()
  })

  return { cleared: true, agent }
}

// ─── Drop-zone API ────────────────────────────────────────────────────────────
//
// Terminal agents, scripts, and CI can drive AgentSync by writing a JSON file
// to .agentsync/request.json in the workspace root. The extension watches for
// this file, processes the action, and writes the result to .agentsync/result.json.
//
// Supported actions:
//
//   startSession  { action, agent, goal? }
//   endSession    { action, agent, summary?, nextWork? }
//   status        { action }
//   health        { action }
//
// Example (from a terminal agent):
//   echo '{"action":"startSession","agent":"Claude","goal":"Fix login bug"}' \
//     > .agentsync/request.json
//   # Poll .agentsync/result.json for { "ok": true, ... }

/**
 * Process a drop-zone request file and write the result.
 * The request file is deleted immediately after being read to prevent re-processing.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
async function processDropZoneRequest(workspaceFolder) {
  const requestPath = getRequestPath(workspaceFolder)
  if (!fs.existsSync(requestPath)) return

  let request
  try {
    const raw = fs.readFileSync(requestPath, 'utf8')
    request = JSON.parse(raw)
  } catch {
    writeResultFile(workspaceFolder, {
      ok: false,
      error: 'Invalid JSON in request file',
      timestamp: new Date().toISOString()
    })
    try { fs.unlinkSync(requestPath) } catch {}
    return
  }

  // Delete the request file immediately to prevent double-processing
  try { fs.unlinkSync(requestPath) } catch {}

  const { action } = request || {}
  const timestamp = new Date().toISOString()

  try {
    switch (action) {
      case 'startSession': {
        const { agent, goal } = request
        if (!agent) throw new Error('Missing required field: agent')
        startSessionCore(workspaceFolder, agent, goal || 'Session started')
        writeResultFile(workspaceFolder, { ok: true, action, timestamp })
        break
      }

      case 'endSession': {
        const { agent, summary, nextWork, handoff } = request
        if (!agent) throw new Error('Missing required field: agent')
        const { health, hotFiles, handoff: handoffRecord } = endSessionCore(
          workspaceFolder,
          agent,
          summary || '',
          nextWork || '',
          handoff || null
        )
        writeResultFile(workspaceFolder, { ok: true, action, timestamp, data: { health, hotFiles, handoff: handoffRecord } })
        break
      }

      case 'status': {
        const content = readTracker(workspaceFolder)
        const tracker = content ? parseTracker(content) : null
        const warnings = tracker ? getTrackerWarnings(workspaceFolder, tracker) : []
        writeResultFile(workspaceFolder, { ok: true, action, timestamp, data: { tracker, warnings } })
        break
      }

      case 'health': {
        const { results, outputs } = runHealthChecks(workspaceFolder)
        writeResultFile(workspaceFolder, { ok: true, action, timestamp, data: { results, outputs } })
        break
      }

      default:
        throw new Error(`Unknown action: ${action || '(none)'}`)
    }
  } catch (err) {
    writeResultFile(workspaceFolder, { ok: false, error: err.message, action, timestamp })
  }
}

// ─── Tree view ────────────────────────────────────────────────────────────────

/**
 * Format a duration in milliseconds as a human-readable elapsed string.
 * @param {number} ms
 * @returns {string}
 */
function formatElapsed(ms) {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

/**
 * Build a normalized snapshot for the live webview dashboard.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function getDashboardModel(workspaceFolder) {
  const trackerContent = readTracker(workspaceFolder)
  const tracker = trackerContent
    ? parseTracker(trackerContent)
    : {
        agent: PLACEHOLDER,
        date: PLACEHOLDER,
        summary: PLACEHOLDER,
        branch: PLACEHOLDER,
        commit: PLACEHOLDER
      }

  let state = null
  const statePath = getStatePath(workspaceFolder)
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    } catch {}
  }

  const config = readAgentSyncConfig(workspaceFolder)
  const handoffInfo = readHandoffs(workspaceFolder)
  const inProgressLines = getInProgressLines(trackerContent)
  const currentAgentId = canonicalAgentId(
    state?.activeSession?.agent || state?.lastSession?.agent || tracker.agent
  )
  const staleAfterHours = Number(config.staleAfterHours) || DEFAULT_STALE_HOURS
  const handoffBuckets = getHandoffBuckets(handoffInfo.handoffs, currentAgentId, staleAfterHours)
  const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0
  const opsState = getOperationalState(
    state,
    inProgressLines,
    handoffInfo.handoffs,
    autoStaleSessionMinutes
  )
  const warnings = trackerContent ? getTrackerWarnings(workspaceFolder, tracker) : []
  const getSuggestedNextStep = () => {
    if (!trackerContent) return 'Run "Initialize Workspace" to set up AgentSync files.'
    if (state?.sessionActive) return 'Use "End Session" when you are done, or "Clear Active Session" if stale.'
    if (inProgressLines.length > 0) return 'Review in-progress items, then start a new session to continue.'
    if (handoffBuckets.open.length > 0) return 'Open Handoffs JSON and pick the highest-priority open handoff.'
    return 'Ready to start. Use "Start Session" before making changes.'
  }
  const onboarding = {
    initialized: Boolean(trackerContent),
    started:
      Boolean(state?.sessionActive) ||
      Boolean(state?.activeSession?.startedAt) ||
      Boolean(state?.lastSession?.startedAt),
    ended:
      !state?.sessionActive &&
      (Boolean(state?.lastSession?.endedAt) ||
        (!isEmptyValue(tracker.date) && !isEmptyValue(tracker.summary)))
  }

  const toStatus = (entry) => {
    const value = entry?.status ?? entry ?? 'Not configured'
    return String(value || 'Not configured')
  }

  const health = state?.health || {}
  const summarizeHandoff = (h) => ({
    id: String(h?.handoff_id || h?.task_id || 'unknown'),
    summary: String(h?.summary || h?.task_id || 'No summary'),
    status: String(h?.status || 'queued'),
    mode: String(h?.owner_mode || 'unknown'),
    owners: Array.isArray(h?.to_agents) ? h.to_agents : []
  })

  return {
    hasWorkspace: true,
    workspace: workspaceFolder.name,
    state: {
      key: opsState.key,
      label: opsState.label,
      reason: opsState.reason,
      pulse: getStatePulseFrame(opsState.key)
    },
    refreshedAt: new Date().toISOString(),
    nextStep: getSuggestedNextStep(),
    onboarding,
    session: {
      active: Boolean(state?.sessionActive),
      agent: state?.activeSession?.agent || 'None',
      goal: state?.activeSession?.goal || 'No active goal',
      startedAt: state?.activeSession?.startedAt || null
    },
    tracker: {
      lastAgent: tracker.agent,
      lastDate: tracker.date,
      lastSummary: tracker.summary,
      branch: tracker.branch,
      commit: tracker.commit
    },
    warnings,
    inProgress: inProgressLines,
    health: {
      Build: toStatus(health.Build),
      Tests: toStatus(health.Tests),
      Deploy: toStatus(health.Deploy)
    },
    handoffs: {
      exists: handoffInfo.exists,
      parseError: handoffInfo.error,
      openCount: handoffBuckets.open.length,
      assignedToMe: handoffBuckets.assignedToMe.slice(0, 8).map(summarizeHandoff),
      sharedWithMe: handoffBuckets.sharedWithMe.slice(0, 8).map(summarizeHandoff),
      blockedOrStale: handoffBuckets.blockedOrStale.slice(0, 8).map(summarizeHandoff)
    }
  }
}

/**
 * Build webview HTML for the animated AgentSync Live dashboard.
 * @returns {string}
 */
function getDashboardHtml() {
  const nonce = createNonce()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentSync Live</title>
  <style>
    :root {
      --bg: #060b08;
      --card: rgba(8, 18, 13, 0.82);
      --line: rgba(68, 112, 79, 0.5);
      --text: #d7ffe5;
      --muted: #9fc2aa;
      --ready: #1fd678;
      --busy: #ff4d57;
      --waiting: #ffb347;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background: var(--bg);
      font: 13px/1.45 "Consolas", "SFMono-Regular", "Menlo", monospace;
      overflow: hidden;
    }
    #matrix {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0.22;
      pointer-events: none;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background:
        radial-gradient(circle at 15% 0%, rgba(43, 130, 78, 0.18), transparent 38%),
        radial-gradient(circle at 85% 10%, rgba(20, 80, 55, 0.17), transparent 35%),
        linear-gradient(180deg, rgba(6, 13, 9, 0.9), rgba(2, 7, 4, 0.96));
      pointer-events: none;
    }
    .app {
      position: relative;
      z-index: 1;
      height: 100vh;
      overflow: auto;
      padding: 12px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .title {
      font-weight: 700;
      letter-spacing: 0.4px;
      margin-right: 4px;
    }
    .badge {
      border: 1px solid transparent;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
    }
    .badge.ready { color: #103a25; background: var(--ready); border-color: #86ffc2; }
    .badge.busy { color: #420e12; background: var(--busy); border-color: #ff9aa0; }
    .badge.waiting { color: #4a2e04; background: var(--waiting); border-color: #ffd898; }
    .pulse { color: var(--muted); opacity: 0.9; }
    .actions {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: 7px;
      margin-bottom: 10px;
    }
    .actions.busy button.action {
      opacity: 0.65;
      cursor: wait;
    }
    button.action {
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      border-radius: 8px;
      padding: 7px 8px;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    button.action:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
      gap: 8px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card);
      padding: 9px;
      backdrop-filter: blur(2px);
    }
    .card h3 {
      margin: 0 0 7px 0;
      font-size: 12px;
      letter-spacing: 0.3px;
      color: #c0f0d3;
      text-transform: uppercase;
    }
    .kv {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 8px;
      row-gap: 4px;
    }
    .kv dt { color: var(--muted); }
    .kv dd { margin: 0; }
    ul.list {
      margin: 0;
      padding-left: 16px;
      max-height: 220px;
      overflow: auto;
    }
    ul.list li { margin: 3px 0; }
    li.empty { color: var(--muted); list-style: none; margin-left: -16px; }
    .hint {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .status-pill {
      display: inline-block;
      border-radius: 8px;
      padding: 1px 6px;
      border: 1px solid var(--line);
      margin-left: 5px;
      font-size: 11px;
      color: #d8ffe8;
    }
    .status-pass { border-color: #29ca72; color: #8df2b7; }
    .status-fail { border-color: #ff6c74; color: #ffb2b6; }
    .status-unknown { border-color: #888; color: #c9c9c9; }
    .action-center {
      margin-bottom: 10px;
    }
    .action-live {
      border-left: 3px solid #49cc83;
      padding-left: 8px;
      margin-bottom: 7px;
    }
    .action-live.running { border-left-color: #ffb347; }
    .action-live.error { border-left-color: #ff6c74; }
    .action-title {
      font-weight: 700;
      margin-bottom: 2px;
    }
    .checklist {
      margin: 8px 0 0 0;
      padding-left: 0;
      list-style: none;
    }
    .checklist li {
      margin: 4px 0;
      color: var(--muted);
    }
    .checklist li.done {
      color: #8df2b7;
    }
    .recovery {
      margin-top: 8px;
      display: none;
      gap: 6px;
      flex-wrap: wrap;
    }
    .recovery.visible {
      display: flex;
    }
    button.recovery-action {
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      border-radius: 8px;
      padding: 5px 8px;
      font: inherit;
      cursor: pointer;
    }
    button.recovery-action:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
  </style>
</head>
<body data-state="ready">
  <canvas id="matrix"></canvas>
  <div class="backdrop"></div>
  <div class="app">
    <div class="top">
      <div class="title">AgentSync Live</div>
      <span id="stateBadge" class="badge ready">READY</span>
      <span id="statePulse" class="pulse">[idle]</span>
      <span id="workspaceName" class="pulse"></span>
    </div>

    <div class="actions">
      <button class="action" data-command="agentsync.init">Initialize Workspace</button>
      <button class="action" data-command="agentsync.startSession">Start Session</button>
      <button class="action" data-command="agentsync.endSession">End Session</button>
      <button class="action" data-command="agentsync.clearActiveSession">Clear Active Session</button>
      <button class="action" data-command="agentsync.openTracker">Open AgentTracker</button>
      <button class="action" data-command="agentsync.openHandoffs">Open Handoffs JSON</button>
      <button class="action" data-command="agentsync.openTutorial">Open Interactive Tutorial</button>
      <button class="action" data-command="agentsync.refreshPanel">Refresh</button>
    </div>

    <section class="card action-center">
      <h3>Action Center</h3>
      <div id="actionLive" class="action-live">
        <div id="actionTitle" class="action-title">Idle</div>
        <div id="actionDetail">Choose an action to begin.</div>
      </div>
      <div id="recoveryActions" class="recovery">
        <button class="recovery-action" data-command="agentsync.openTracker">Open Tracker</button>
        <button class="recovery-action" data-command="agentsync.refreshPanel">Refresh</button>
      </div>
      <dl class="kv">
        <dt>Next step</dt><dd id="nextStep">-</dd>
        <dt>Last update</dt><dd id="actionUpdated">-</dd>
        <dt>Data refreshed</dt><dd id="dataRefreshed">-</dd>
      </dl>
      <ul id="onboardingList" class="checklist"></ul>
    </section>

    <div class="grid">
      <section class="card">
        <h3>Overview</h3>
        <dl class="kv">
          <dt>State</dt><dd id="stateText">-</dd>
          <dt>Reason</dt><dd id="stateReason">-</dd>
          <dt>Open handoffs</dt><dd id="openHandoffs">0</dd>
          <dt>In progress</dt><dd id="inProgressCount">0</dd>
        </dl>
      </section>

      <section class="card">
        <h3>Session</h3>
        <dl class="kv">
          <dt>Active</dt><dd id="sessionActive">No</dd>
          <dt>Agent</dt><dd id="sessionAgent">None</dd>
          <dt>Goal</dt><dd id="sessionGoal">No active goal</dd>
          <dt>Started</dt><dd id="sessionStarted">-</dd>
        </dl>
      </section>

      <section class="card">
        <h3>Health</h3>
        <ul id="healthList" class="list"></ul>
      </section>

      <section class="card">
        <h3>Handoffs</h3>
        <div><strong>Assigned to me</strong></div>
        <ul id="handoffAssigned" class="list"></ul>
        <div style="margin-top: 6px;"><strong>Shared with me</strong></div>
        <ul id="handoffShared" class="list"></ul>
        <div style="margin-top: 6px;"><strong>Blocked / stale</strong></div>
        <ul id="handoffBlocked" class="list"></ul>
      </section>

      <section class="card">
        <h3>Tracker</h3>
        <dl class="kv">
          <dt>Last agent</dt><dd id="lastAgent">-</dd>
          <dt>Last date</dt><dd id="lastDate">-</dd>
          <dt>Branch</dt><dd id="branch">-</dd>
          <dt>Commit</dt><dd id="commit">-</dd>
        </dl>
      </section>

      <section class="card">
        <h3>Warnings</h3>
        <ul id="warningsList" class="list"></ul>
      </section>
    </div>
    <div class="hint">Tip: this live view auto-refreshes from AgentTracker + .agentsync files.</div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let pendingCommand = null;
    let lastActionAt = null;

    const commandLabels = {
      'agentsync.init': 'Initialize Workspace',
      'agentsync.startSession': 'Start Session',
      'agentsync.endSession': 'End Session',
      'agentsync.clearActiveSession': 'Clear Active Session',
      'agentsync.openTracker': 'Open AgentTracker',
      'agentsync.openHandoffs': 'Open Handoffs JSON',
      'agentsync.openTutorial': 'Open Interactive Tutorial',
      'agentsync.refreshPanel': 'Refresh'
    };

    function byId(id) {
      return document.getElementById(id);
    }

    function setText(id, value) {
      const el = byId(id);
      if (el) el.textContent = value == null ? '-' : String(value);
    }

    function formatTime(value) {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleTimeString();
    }

    function setActionVisual(state, title, detail) {
      const live = byId('actionLive');
      if (live) {
        live.classList.remove('running', 'error');
        if (state === 'running') live.classList.add('running');
        if (state === 'error') live.classList.add('error');
      }
      setText('actionTitle', title);
      setText('actionDetail', detail);
      setText('actionUpdated', formatTime(lastActionAt));
    }

    function setRecoveryVisible(isVisible) {
      const el = byId('recoveryActions');
      if (!el) return;
      el.classList.toggle('visible', Boolean(isVisible));
    }

    function setActionsBusy(isBusy) {
      const container = document.querySelector('.actions');
      if (!container) return;
      container.classList.toggle('busy', isBusy);
      const buttons = container.querySelectorAll('button.action');
      buttons.forEach((button) => {
        const command = button.getAttribute('data-command');
        const keepEnabled = command === 'agentsync.refreshPanel';
        button.disabled = isBusy && !keepEnabled;
      });

      const recoveryButtons = document.querySelectorAll('button.recovery-action');
      recoveryButtons.forEach((button) => {
        const command = button.getAttribute('data-command');
        const keepEnabled = command === 'agentsync.refreshPanel';
        button.disabled = isBusy && !keepEnabled;
      });
    }

    function renderList(id, items, format, emptyLabel) {
      const el = byId(id);
      if (!el) return;
      el.innerHTML = '';
      if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = emptyLabel;
        el.appendChild(li);
        return;
      }
      items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = format(item);
        el.appendChild(li);
      });
    }

    function healthClass(status) {
      const normalized = String(status || '').toLowerCase();
      if (normalized === 'pass') return 'status-pass';
      if (normalized === 'fail') return 'status-fail';
      return 'status-unknown';
    }

    function renderHealth(health) {
      const rows = [
        { name: 'Build', status: health.Build },
        { name: 'Tests', status: health.Tests },
        { name: 'Deploy', status: health.Deploy }
      ];
      const el = byId('healthList');
      if (!el) return;
      el.innerHTML = '';
      rows.forEach((row) => {
        const li = document.createElement('li');
        const pill = document.createElement('span');
        pill.className = 'status-pill ' + healthClass(row.status);
        pill.textContent = row.status;
        li.textContent = row.name + ': ';
        li.appendChild(pill);
        el.appendChild(li);
      });
    }

    function formatHandoff(item) {
      return item.id + ' | ' + item.summary + ' (' + item.status + ', ' + item.mode + ')';
    }

    function renderOnboarding(onboarding) {
      const el = byId('onboardingList');
      if (!el) return;
      const stepRows = [
        {
          done: Boolean(onboarding && onboarding.initialized),
          label: '1. Initialize workspace'
        },
        {
          done: Boolean(onboarding && onboarding.started),
          label: '2. Start first session'
        },
        {
          done: Boolean(onboarding && onboarding.ended),
          label: '3. End session and hand off'
        }
      ];
      el.innerHTML = '';
      stepRows.forEach((row) => {
        const li = document.createElement('li');
        li.className = row.done ? 'done' : '';
        li.textContent = (row.done ? '[x] ' : '[ ] ') + row.label;
        el.appendChild(li);
      });
    }

    function getRunningHint(command, label) {
      if (command === 'agentsync.startSession') {
        return 'You may see prompts for agent name and goal. Fill those in, then wait for completion.';
      }
      if (command === 'agentsync.endSession') {
        return 'You may see prompts for summary and next work. Complete them, then wait for confirmation.';
      }
      if (command === 'agentsync.init') {
        return 'AgentSync files are being created now. You will see completion once file writes finish.';
      }
      return 'Watch for prompts in VS Code. This view will update when complete.';
    }

    function getFailureHint(command, message) {
      const base = message || 'The command failed.';
      if (command === 'agentsync.startSession' || command === 'agentsync.endSession') {
        return base + ' Open Tracker to review required fields, then try again.';
      }
      if (command === 'agentsync.init') {
        return base + ' Check workspace permissions and try Initialize Workspace again.';
      }
      return base + ' Try Refresh. If it persists, open AgentTracker for context.';
    }

    function render(model) {
      if (!model || !model.hasWorkspace) {
        setText('stateText', 'No workspace open');
        setText('nextStep', 'Open a folder/workspace to use AgentSync.');
        return;
      }

      document.body.dataset.state = model.state.key;
      const badge = byId('stateBadge');
      if (badge) {
        badge.className = 'badge ' + model.state.key;
        badge.textContent = String(model.state.label || '').toUpperCase();
      }
      setText('statePulse', model.state.pulse);
      setText('workspaceName', model.workspace);

      setText('stateText', model.state.label);
      setText('stateReason', model.state.reason);
      setText('openHandoffs', model.handoffs.openCount);
      setText('inProgressCount', model.inProgress.length);
      setText('nextStep', model.nextStep || '-');
      setText('dataRefreshed', formatTime(model.refreshedAt));

      setText('sessionActive', model.session.active ? 'Yes' : 'No');
      setText('sessionAgent', model.session.agent);
      setText('sessionGoal', model.session.goal);
      setText('sessionStarted', model.session.startedAt ? new Date(model.session.startedAt).toLocaleString() : '-');
      renderOnboarding(model.onboarding || {});

      setText('lastAgent', model.tracker.lastAgent);
      setText('lastDate', model.tracker.lastDate);
      setText('branch', model.tracker.branch);
      setText('commit', model.tracker.commit);

      renderHealth(model.health);
      renderList('handoffAssigned', model.handoffs.assignedToMe, formatHandoff, 'No direct assignments');
      renderList('handoffShared', model.handoffs.sharedWithMe, formatHandoff, 'No shared assignments');
      renderList('handoffBlocked', model.handoffs.blockedOrStale, formatHandoff, 'No blocked/stale handoffs');
      renderList('warningsList', model.warnings, (w) => w, 'No warnings');

      if (!pendingCommand) {
        const statusLabel = model.state && model.state.label ? model.state.label : 'Idle';
        setActionVisual('ok', 'Idle', 'Current state: ' + statusLabel + '.');
        setRecoveryVisible(false);
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'model') render(msg.model);
      if (msg.type === 'action') {
        const stage = String(msg.stage || '');
        const command = String(msg.command || '');
        const label = commandLabels[command] || command || 'Action';
        lastActionAt = msg.timestamp || new Date().toISOString();

        if (stage === 'started') {
          pendingCommand = command;
          setActionsBusy(true);
          setActionVisual(
            'running',
            'Running: ' + label,
            getRunningHint(command, label)
          );
          setRecoveryVisible(false);
          return;
        }

        if (stage === 'completed') {
          pendingCommand = null;
          setActionsBusy(false);
          setActionVisual('ok', 'Completed: ' + label, 'Action finished successfully.');
          setRecoveryVisible(false);
          return;
        }

        if (stage === 'failed') {
          pendingCommand = null;
          setActionsBusy(false);
          setActionVisual('error', 'Failed: ' + label, getFailureHint(command, msg.error || ''));
          setRecoveryVisible(true);
        }
      }
    });

    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-command]');
      if (!target) return;
      const command = target.getAttribute('data-command');
      if (!command) return;
      if (pendingCommand && command !== 'agentsync.refreshPanel') return;
      vscode.postMessage({ command });
    });

    (function startMatrix() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const canvas = byId('matrix');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-';
      const fontSize = 14;
      let cols = 0;
      let drops = [];

      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        cols = Math.max(1, Math.floor(canvas.width / fontSize));
        drops = Array(cols).fill(1);
      };

      const draw = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#20f080';
        ctx.font = fontSize + 'px monospace';
        for (let i = 0; i < drops.length; i += 1) {
          const text = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
          drops[i] += 1;
        }
      };

      resize();
      window.addEventListener('resize', resize);
      setInterval(draw, 60);
    })();

    vscode.postMessage({ command: 'agentsync.refreshPanel' });
  </script>
</body>
</html>`
}

/**
 * Webview provider for the animated AgentSync Live dashboard.
 */
class AgentSyncDashboardViewProvider {
  constructor() {
    this.view = null
  }

  postAction(stage, command, error = null) {
    if (!this.view) return
    this.view.webview.postMessage({
      type: 'action',
      stage,
      command,
      error,
      timestamp: new Date().toISOString()
    })
  }

  refresh() {
    if (!this.view) return
    const workspaceFolder = getActiveWorkspaceFolder()
    if (!workspaceFolder) {
      this.view.webview.postMessage({ type: 'model', model: { hasWorkspace: false } })
      return
    }
    this.view.webview.postMessage({ type: 'model', model: getDashboardModel(workspaceFolder) })
  }

  /**
   * @param {vscode.WebviewView} webviewView
   */
  resolveWebviewView(webviewView) {
    this.view = webviewView
    webviewView.webview.options = { enableScripts: true }
    webviewView.webview.html = getDashboardHtml()

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const command = String(message?.command || '')
      if (!command) return
      if (command === 'agentsync.refreshPanel') {
        this.postAction('started', command)
        this.refresh()
        this.postAction('completed', command)
        return
      }
      this.postAction('started', command)
      try {
        await vscode.commands.executeCommand(command)
        this.postAction('completed', command)
      } catch (err) {
        const msg = err && err.message ? err.message : 'Unknown error'
        this.postAction('failed', command, msg)
      }
      this.refresh()
    })

    webviewView.onDidDispose(() => {
      if (this.view === webviewView) this.view = null
    })

    this.refresh()
  }
}

/**
 * A single node in the AgentSync tree view.
 * Stores its children so AgentSyncTreeDataProvider.getChildren() can return them.
 */
class AgentSyncItem extends vscode.TreeItem {
  /**
   * @param {string} label
   * @param {vscode.TreeItemCollapsibleState} collapsibleState
   * @param {object} [opts]
   * @param {string} [opts.icon] codicon id
   * @param {vscode.ThemeColor} [opts.iconColor]
   * @param {string} [opts.description]
   * @param {string} [opts.tooltip]
   * @param {vscode.Command} [opts.command]
   * @param {string} [opts.contextValue]
   * @param {AgentSyncItem[]} [opts.children]
   */
  constructor(label, collapsibleState = vscode.TreeItemCollapsibleState.None, opts = {}) {
    super(label, collapsibleState)
    this.children = opts.children || []
    if (opts.icon) {
      this.iconPath = new vscode.ThemeIcon(opts.icon, opts.iconColor)
    }
    if (opts.description !== undefined) this.description = opts.description
    if (opts.tooltip) this.tooltip = opts.tooltip
    if (opts.command) this.command = opts.command
    if (opts.contextValue) this.contextValue = opts.contextValue
  }
}

/**
 * Provides tree data for the AgentSync sidebar panel.
 * Reads from .agentsync/state.json and AgentTracker.md.
 * Call refresh() to push an update to VS Code.
 */
class AgentSyncTreeDataProvider {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter()
    /** @type {vscode.Event<undefined>} */
    this.onDidChangeTreeData = this._onDidChangeTreeData.event
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined)
  }

  /** @param {AgentSyncItem} element */
  getTreeItem(element) {
    return element
  }

  /** @param {AgentSyncItem | undefined} element */
  getChildren(element) {
    if (element) return element.children

    const workspaceFolder = getActiveWorkspaceFolder()
    if (!workspaceFolder) {
      return [
        new AgentSyncItem('No workspace open', vscode.TreeItemCollapsibleState.None, {
          icon: 'warning'
        })
      ]
    }

    let state = null
    const statePath = getStatePath(workspaceFolder)
    if (fs.existsSync(statePath)) {
      try {
        state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      } catch {}
    }

    const config = readAgentSyncConfig(workspaceFolder)
    const handoffInfo = readHandoffs(workspaceFolder)
    const trackerContent = readTracker(workspaceFolder)
    const inProgressLines = getInProgressLines(trackerContent)
    const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0
    const staleInfo = getSessionStaleInfo(state, autoStaleSessionMinutes)
    const opsState = getOperationalState(
      state,
      inProgressLines,
      handoffInfo.handoffs,
      autoStaleSessionMinutes
    )
    const currentAgentId = canonicalAgentId(state?.activeSession?.agent || state?.lastSession?.agent)

    return [
      this._buildOverviewSection(workspaceFolder, opsState, state, inProgressLines, handoffInfo.handoffs),
      this._buildQuickActionsSection(),
      this._buildSessionSection(state, staleInfo),
      this._buildHandoffsSection(
        workspaceFolder,
        handoffInfo,
        currentAgentId,
        Number(config.staleAfterHours) || DEFAULT_STALE_HOURS
      ),
      this._buildHealthSection(state),
      this._buildHotFilesSection(state, workspaceFolder),
      this._buildInProgressSection(trackerContent)
    ]
  }

  _buildOverviewSection(workspaceFolder, opsState, state, inProgressLines, handoffs) {
    const byState = {
      ready: {
        icon: 'pass-filled',
        color: new vscode.ThemeColor('testing.iconPassed'),
        next: 'Next: Start Session when ready to make changes.'
      },
      busy: {
        icon: 'record',
        color: new vscode.ThemeColor('testing.iconFailed'),
        next: 'Next: Run End Session, or Clear Active Session if this is stale.'
      },
      waiting: {
        icon: 'clock',
        color: new vscode.ThemeColor('charts.yellow'),
        next: 'Next: Review pending work/handoffs, then start the next session.'
      }
    }

    const visual = byState[opsState.key]
    const pulse = getStatePulseFrame(opsState.key)
    const openHandoffCount = handoffs.filter((h) =>
      OPEN_HANDOFF_STATUSES.has(String(h?.status || '').toLowerCase())
    ).length

    const children = [
      new AgentSyncItem(`State: ${opsState.label} ${pulse}`, vscode.TreeItemCollapsibleState.None, {
        icon: visual.icon,
        iconColor: visual.color,
        tooltip: opsState.reason
      }),
      new AgentSyncItem(
        `Active session: ${state?.sessionActive ? state?.activeSession?.agent || 'Unknown' : 'None'}`,
        vscode.TreeItemCollapsibleState.None,
        { icon: 'account' }
      ),
      new AgentSyncItem(`In Progress items: ${inProgressLines.length}`, vscode.TreeItemCollapsibleState.None, {
        icon: 'tasklist'
      }),
      new AgentSyncItem(`Open handoffs: ${openHandoffCount}`, vscode.TreeItemCollapsibleState.None, {
        icon: 'git-pull-request'
      }),
      new AgentSyncItem(visual.next, vscode.TreeItemCollapsibleState.None, {
        icon: 'lightbulb',
        tooltip: `Workspace: ${workspaceFolder.name}`
      })
    ]

    return new AgentSyncItem('Overview', vscode.TreeItemCollapsibleState.Expanded, {
      icon: 'dashboard',
      children
    })
  }

  _buildQuickActionsSection() {
    const action = (label, command, icon, tooltip) =>
      new AgentSyncItem(label, vscode.TreeItemCollapsibleState.None, {
        icon,
        command: { command, title: label },
        tooltip
      })

    return new AgentSyncItem('Quick Actions', vscode.TreeItemCollapsibleState.Collapsed, {
      icon: 'rocket',
      children: [
        action('Initialize Workspace', 'agentsync.init', 'new-file', 'Create AgentSync files in this repo'),
        action('Start Session', 'agentsync.startSession', 'play', 'Begin tracking active work'),
        action('End Session', 'agentsync.endSession', 'debug-stop', 'Write handoff and health metadata'),
        action('Clear Active Session', 'agentsync.clearActiveSession', 'circle-slash', 'Clear stale busy state'),
        action('Open AgentTracker', 'agentsync.openTracker', 'book', 'Open shared handoff document'),
        action('Open Handoffs JSON', 'agentsync.openHandoffs', 'json', 'Open machine-readable handoff data'),
        action('Open Interactive Tutorial', 'agentsync.openTutorial', 'mortar-board', 'Open guided onboarding in Getting Started')
      ]
    })
  }

  _buildSessionSection(state, staleInfo = { isStale: false, ageMs: null }) {
    if (!state || !state.sessionActive || !state.activeSession) {
      const lastAgent = state?.lastSession?.agent
      const lastDate = state?.lastSession?.date
      const tooltip = lastDate
        ? `Last session: ${lastAgent} on ${new Date(lastDate).toLocaleString()}`
        : 'No sessions recorded yet'
      return new AgentSyncItem('No active session', vscode.TreeItemCollapsibleState.None, {
        icon: 'circle-outline',
        description: lastAgent && !isEmptyValue(lastAgent) ? `Last: ${lastAgent}` : undefined,
        tooltip,
        command: { command: 'agentsync.startSession', title: 'Start Session' }
      })
    }

    const { agent, goal, startedAt } = state.activeSession
    const elapsed = formatElapsed(Date.now() - Date.parse(startedAt))

    const staleChild =
      staleInfo?.isStale
        ? new AgentSyncItem(`Stale session: running ${formatElapsed(staleInfo.ageMs || 0)}`, vscode.TreeItemCollapsibleState.None, {
            icon: 'warning',
            iconColor: new vscode.ThemeColor('charts.yellow'),
            tooltip: 'Use Clear Active Session if this session is no longer active.'
          })
        : null

    const goalChild = new AgentSyncItem(
      goal || 'No goal set',
      vscode.TreeItemCollapsibleState.None,
      { icon: 'target', tooltip: 'Session goal' }
    )
    const elapsedChild = new AgentSyncItem(
      `Running: ${elapsed}`,
      vscode.TreeItemCollapsibleState.None,
      {
        icon: 'clock',
        tooltip: `Started at ${new Date(startedAt).toLocaleTimeString()}`
      }
    )

    return new AgentSyncItem(agent, vscode.TreeItemCollapsibleState.Expanded, {
      icon: staleInfo?.isStale ? 'warning' : 'record',
      iconColor: staleInfo?.isStale
        ? new vscode.ThemeColor('charts.yellow')
        : new vscode.ThemeColor('testing.iconPassed'),
      description: staleInfo?.isStale ? `stale ${elapsed}` : elapsed,
      contextValue: 'activeSession',
      children: [goalChild, elapsedChild, ...(staleChild ? [staleChild] : [])]
    })
  }

  _buildHandoffsSection(workspaceFolder, handoffInfo, currentAgentId, staleAfterHours) {
    const { exists, handoffs, error } = handoffInfo
    if (!exists) {
      return new AgentSyncItem('Handoffs', vscode.TreeItemCollapsibleState.Collapsed, {
        icon: 'git-pull-request',
        children: [
          new AgentSyncItem('No handoffs file yet', vscode.TreeItemCollapsibleState.None, {
            icon: 'dash',
            command: { command: 'agentsync.openHandoffs', title: 'Open Handoffs JSON' },
            tooltip: 'Create .agentsync/handoffs.json by opening it from Quick Actions.'
          })
        ]
      })
    }

    if (error) {
      return new AgentSyncItem('Handoffs', vscode.TreeItemCollapsibleState.Collapsed, {
        icon: 'error',
        iconColor: new vscode.ThemeColor('testing.iconFailed'),
        children: [
          new AgentSyncItem(`Invalid handoffs.json: ${error}`, vscode.TreeItemCollapsibleState.None, {
            icon: 'error',
            tooltip: `File: ${getHandoffsPath(workspaceFolder)}`,
            command: { command: 'agentsync.openHandoffs', title: 'Open Handoffs JSON' }
          })
        ]
      })
    }

    const buckets = getHandoffBuckets(handoffs, currentAgentId, staleAfterHours)
    const openHandoffs = buckets.open
    const assignedToMe = buckets.assignedToMe
    const sharedWithMe = buckets.sharedWithMe
    const blockedOrStale = buckets.blockedOrStale

    const toLeaf = (h) => {
      const id = h?.handoff_id || h?.task_id || 'unknown'
      const summary = (h?.summary || h?.task_id || 'No summary').trim()
      const status = String(h?.status || 'queued')
      const owners = Array.isArray(h?.to_agents) ? h.to_agents.join(',') : ''
      return new AgentSyncItem(`${id}: ${summary}`, vscode.TreeItemCollapsibleState.None, {
        icon: 'note',
        description: status,
        tooltip: [`owners: ${owners || '(none)'}`, `mode: ${h?.owner_mode || 'unknown'}`].join('\n'),
        command: { command: 'agentsync.openHandoffs', title: 'Open Handoffs JSON' }
      })
    }

    const group = (label, icon, items, emptyLabel) =>
      new AgentSyncItem(`${label} (${items.length})`, vscode.TreeItemCollapsibleState.Collapsed, {
        icon,
        children:
          items.length > 0
            ? items.slice(0, 10).map(toLeaf)
            : [new AgentSyncItem(emptyLabel, vscode.TreeItemCollapsibleState.None, { icon: 'dash' })]
      })

    const children = [
      group('Assigned to me', 'person', assignedToMe, 'No single-owner handoffs assigned to you'),
      group('Shared with me', 'organization', sharedWithMe, 'No shared-owner handoffs assigned to you'),
      group('Blocked/Stale', 'warning', blockedOrStale, 'No blocked or stale handoffs')
    ]

    return new AgentSyncItem(`Handoffs (${openHandoffs.length})`, vscode.TreeItemCollapsibleState.Collapsed, {
      icon: 'git-pull-request',
      children
    })
  }

  _buildHealthSection(state) {
    const health = state?.health || {}

    const statusIcon = (status) => {
      if (status === 'Pass') return { icon: 'pass-filled', color: new vscode.ThemeColor('testing.iconPassed') }
      if (status === 'Fail') return { icon: 'error', color: new vscode.ThemeColor('testing.iconFailed') }
      return { icon: 'circle-outline', color: undefined }
    }

    const children = ['Build', 'Tests', 'Deploy'].map((label) => {
      const entry = health[label]
      const status = entry?.status ?? entry ?? 'Not configured'
      const { icon, color } = statusIcon(status)
      const output = (entry?.output || '').trim()
      return new AgentSyncItem(label, vscode.TreeItemCollapsibleState.None, {
        icon,
        iconColor: color,
        description: status,
        tooltip: output ? `Last output:\n${output.slice(-300)}` : undefined
      })
    })

    const hasFail = Object.values(health).some((e) => (e?.status ?? e) === 'Fail')
    return new AgentSyncItem('Health', vscode.TreeItemCollapsibleState.Collapsed, {
      icon: hasFail ? 'error' : 'heart',
      iconColor: hasFail ? new vscode.ThemeColor('testing.iconFailed') : undefined,
      children
    })
  }

  _buildHotFilesSection(state, workspaceFolder) {
    const hotFiles = state?.hotFiles || []
    const label = hotFiles.length > 0 ? `Hot Files (${hotFiles.length})` : 'Hot Files'

    const children = hotFiles.length > 0
      ? hotFiles.map((file) => {
          const fullPath = path.join(workspaceFolder.uri.fsPath, file)
          return new AgentSyncItem(file, vscode.TreeItemCollapsibleState.None, {
            icon: 'file-code',
            tooltip: fullPath,
            command: {
              command: 'vscode.open',
              title: 'Open File',
              arguments: [vscode.Uri.file(fullPath)]
            }
          })
        })
      : [new AgentSyncItem('None', vscode.TreeItemCollapsibleState.None, { icon: 'dash' })]

    return new AgentSyncItem(label, vscode.TreeItemCollapsibleState.Collapsed, {
      icon: 'flame',
      children
    })
  }

  _buildInProgressSection(trackerContent) {
    const body = trackerContent ? getSectionBody(trackerContent, 'In Progress') : ''
    const lines = body
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && l !== '*Nothing active*' && !l.startsWith('<!--'))

    const label = lines.length > 0 ? `In Progress (${lines.length})` : 'In Progress'

    const children = lines.length > 0
      ? lines.map((line) => {
          const done = line.startsWith('- [x]')
          const text = line.replace(/^- \[[ x]\]\s*/, '').trim()
          return new AgentSyncItem(text, vscode.TreeItemCollapsibleState.None, {
            icon: done ? 'check' : 'circle-outline',
            tooltip: line
          })
        })
      : [new AgentSyncItem('Nothing active', vscode.TreeItemCollapsibleState.None, { icon: 'dash' })]

    return new AgentSyncItem(label, vscode.TreeItemCollapsibleState.Collapsed, {
      icon: 'tasklist',
      children
    })
  }
}

// ─── Status bar ───────────────────────────────────────────────────────────────

/**
 * Format text prefix for multi-root workspaces.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getWorkspaceLabelPrefix(workspaceFolder) {
  const count = vscode.workspace.workspaceFolders?.length ?? 0
  return count > 1 ? `${workspaceFolder.name}: ` : ''
}

/**
 * Update status bar item from current AgentTracker.md state.
 * @param {vscode.StatusBarItem} statusItem
 */
function updateStatusBar(statusItem) {
  const workspaceFolder = getActiveWorkspaceFolder()

  if (!workspaceFolder) {
    statusItem.text = '$(sync) AgentSync'
    statusItem.tooltip = 'No workspace open'
    statusItem.show()
    return
  }

  const trackerPath = getTrackerPath(workspaceFolder)
  const prefix = getWorkspaceLabelPrefix(workspaceFolder)

  if (!fs.existsSync(trackerPath)) {
    statusItem.text = `$(circle-outline) ${prefix}AgentSync Ready`
    statusItem.tooltip = `AgentTracker not initialized for ${workspaceFolder.name}.\nRun "AgentSync: Initialize Workspace".`
    statusItem.show()
    return
  }

  try {
    const trackerContent = fs.readFileSync(trackerPath, 'utf8')
    const tracker = parseTracker(trackerContent)
    let state = null
    const statePath = getStatePath(workspaceFolder)
    if (fs.existsSync(statePath)) {
      try {
        state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      } catch {}
    }
    const config = readAgentSyncConfig(workspaceFolder)
    const handoffInfo = readHandoffs(workspaceFolder)
    const inProgressLines = getInProgressLines(trackerContent)
    const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0
    const opsState = getOperationalState(
      state,
      inProgressLines,
      handoffInfo.handoffs,
      autoStaleSessionMinutes
    )
    const warnings = getTrackerWarnings(workspaceFolder, tracker)
    const stateIconByKey = {
      ready: '$(pass-filled)',
      busy: '$(sync~spin)',
      waiting: '$(clock)'
    }
    const baseIcon = stateIconByKey[opsState.key] || '$(sync)'
    const icon = warnings.length > 0 ? '$(warning)' : baseIcon
    statusItem.text = `${icon} ${prefix}AgentSync ${opsState.label}`

    const tooltipLines = []
    tooltipLines.push(`State: ${opsState.label}`)
    tooltipLines.push(opsState.reason)
    if (!isEmptyValue(tracker.agent) || !isEmptyValue(tracker.date)) {
      tooltipLines.push(`Last session: ${tracker.agent} | ${tracker.date}`)
    }
    if (!isEmptyValue(tracker.branch) || !isEmptyValue(tracker.commit)) {
      tooltipLines.push(`Branch: ${tracker.branch} | Commit: ${tracker.commit}`)
    }
    if (handoffInfo.handoffs.length > 0) {
      const openHandoffs = handoffInfo.handoffs.filter((h) =>
        OPEN_HANDOFF_STATUSES.has(String(h?.status || '').toLowerCase())
      )
      tooltipLines.push(`Open handoffs: ${openHandoffs.length}`)
    }
    if (warnings.length > 0) {
      tooltipLines.push('', 'Warnings:')
      warnings.forEach((warning) => tooltipLines.push(`- ${warning}`))
    }
    tooltipLines.push('', 'Click to open AgentTracker')
    statusItem.tooltip = tooltipLines.join('\n')
  } catch {
    statusItem.text = `$(sync) ${prefix}AgentSync`
    statusItem.tooltip = `Could not read AgentTracker.md for ${workspaceFolder.name}`
  }

  statusItem.show()
}

// ─── Commands ─────────────────────────────────────────────────────────────────

/**
 * Initialize the workspace with AgentSync protocol files.
 * Also creates the .agentsync/ runtime directory and ensures it is gitignored.
 * @param {vscode.ExtensionContext} context
 * @param {vscode.WorkspaceFolder | null} selectedFolder
 */
async function initWorkspace(context, selectedFolder = null) {
  const workspaceFolder = selectedFolder || (await resolveWorkspaceFolder({ allowPick: true }))
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const root = workspaceFolder.uri.fsPath
  const templatesDir = getTemplatesDir(context)

  const filesToCreate = [
    { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
    { src: 'AGENTS.md', dest: 'AGENTS.md' },
    { src: 'copilot-instructions.md', dest: path.join('.github', 'copilot-instructions.md') },
    { src: 'AgentTracker.md', dest: 'AgentTracker.md' },
    { src: 'agentsync.json', dest: '.agentsync.json' }
  ]

  let created = 0
  let skipped = 0

  for (const file of filesToCreate) {
    const destPath = path.join(root, file.dest)
    const srcPath = path.join(templatesDir, file.src)

    if (fs.existsSync(destPath)) {
      const choice = await vscode.window.showWarningMessage(
        `${file.dest} already exists in ${workspaceFolder.name}. Overwrite?`,
        { modal: false },
        'Overwrite',
        'Skip'
      )
      if (choice !== 'Overwrite') {
        skipped++
        continue
      }
    }

    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
      created++
    } catch (err) {
      vscode.window.showErrorMessage(`AgentSync: Failed to create ${file.dest}: ${err.message}`)
    }
  }

  // Create the .agentsync/ runtime directory up front
  try {
    fs.mkdirSync(path.join(root, '.agentsync'), { recursive: true })
  } catch {}

  // Create default handoff store so the panel can render handoff state immediately.
  ensureHandoffsFile(workspaceFolder)

  // Ensure .agentsync/ is gitignored so runtime files don't land in version control
  try {
    const gitignorePath = path.join(root, '.gitignore')
    let gitignoreContent = ''
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, 'utf8')
    }
    const alreadyIgnored = gitignoreContent
      .split(/\r?\n/)
      .some((line) => line.trim() === '.agentsync' || line.trim() === '.agentsync/')
    if (!alreadyIgnored) {
      const separator = gitignoreContent && !gitignoreContent.endsWith('\n') ? '\n' : ''
      fs.appendFileSync(gitignorePath, `${separator}.agentsync/\n`, 'utf8')
    }
  } catch {}

  // Offer to populate .agentsync.json commands from package.json scripts
  await autoDetectCommands(workspaceFolder, { force: false })

  const summary =
    created === 0 && skipped > 0
      ? 'All files skipped.'
      : `${created} file${created !== 1 ? 's' : ''} created${skipped > 0 ? `, ${skipped} skipped` : ''}.`

  const choice = await vscode.window.showInformationMessage(
    `AgentSync: Workspace "${workspaceFolder.name}" initialized. ${summary}`,
    'Open AgentSync Panel',
    'Open Interactive Tutorial'
  )

  if (choice === 'Open AgentSync Panel') {
    const opened = await openAgentSyncPanel()
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Could not focus the panel. Run "View: Reset View Locations" and try again.'
      )
    }
  } else if (choice === 'Open Interactive Tutorial') {
    const opened = await openAgentSyncTutorial(context)
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Could not open the interactive tutorial. Open "Getting Started" and select AgentSync.'
      )
    }
  }

  const trackerPath = getTrackerPath(workspaceFolder)
  if (fs.existsSync(trackerPath)) {
    await openTrackerDocument(workspaceFolder)
  }
}

/**
 * Open AgentTracker.md in the editor.
 * @param {vscode.ExtensionContext} context
 */
async function openTracker(context) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const ready = await ensureTrackerExists(context, workspaceFolder)
  if (!ready) return

  await openTrackerDocument(workspaceFolder)
}

/**
 * Open .agentsync/handoffs.json in the editor (creates an empty file if missing).
 * @returns {Promise<void>}
 */
async function openHandoffs() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  ensureHandoffsFile(workspaceFolder)
  const handoffsPath = getHandoffsPath(workspaceFolder)
  const doc = await vscode.workspace.openTextDocument(handoffsPath)
  await vscode.window.showTextDocument(doc)
}

/**
 * Clear an accidentally left-open active session.
 * @returns {Promise<void>}
 */
async function clearActiveSession() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const statePath = getStatePath(workspaceFolder)
  if (!fs.existsSync(statePath)) {
    vscode.window.showInformationMessage('AgentSync: No active session to clear.')
    return
  }

  let state = null
  try {
    state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {}

  if (!state?.sessionActive || !state?.activeSession) {
    vscode.window.showInformationMessage('AgentSync: No active session to clear.')
    return
  }

  const agent = String(state.activeSession.agent || 'Unknown')
  const choice = await vscode.window.showWarningMessage(
    `AgentSync: Clear the active session for ${agent} without running End Session checks?`,
    'Clear Session',
    'Cancel'
  )
  if (choice !== 'Clear Session') return

  const result = clearActiveSessionCore(workspaceFolder)
  if (!result.cleared) {
    vscode.window.showErrorMessage('AgentSync: Could not clear active session.')
    return
  }

  vscode.window.showInformationMessage(
    `AgentSync: Cleared active session${result.agent ? ` for ${result.agent}` : ''}.`
  )
}

/**
 * Start a session and append an In Progress entry.
 * @param {vscode.ExtensionContext} context
 */
async function startSession(context) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const ready = await ensureTrackerExists(context, workspaceFolder)
  if (!ready) return

  const content = readTracker(workspaceFolder)
  if (!content) {
    vscode.window.showErrorMessage('AgentSync: Could not read AgentTracker.md.')
    return
  }

  const tracker = parseTracker(content)
  const agent = await promptForAgent(tracker.agent)
  if (!agent) return

  const goal = await vscode.window.showInputBox({
    prompt: 'What are you working on this session?',
    placeHolder: 'Example: Implement auth callback retries'
  })
  if (goal === undefined) return

  try {
    startSessionCore(workspaceFolder, agent, goal)
  } catch (err) {
    vscode.window.showErrorMessage(`AgentSync: ${err.message}`)
    return
  }

  await openTrackerDocument(workspaceFolder)
  vscode.window.showInformationMessage(`AgentSync: Session started for ${agent}.`)
}

/**
 * End a session and update Last Session/Health/Hot Files.
 * @param {vscode.ExtensionContext} context
 */
async function endSession(context) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const ready = await ensureTrackerExists(context, workspaceFolder)
  if (!ready) return

  const content = readTracker(workspaceFolder)
  if (!content) {
    vscode.window.showErrorMessage('AgentSync: Could not read AgentTracker.md.')
    return
  }

  const parsed = parseTracker(content)
  const agent = await promptForAgent(parsed.agent)
  if (!agent) return

  const summary = await vscode.window.showInputBox({
    prompt: 'One-line session summary',
    placeHolder: 'Example: Added queue retry logic and fixed race condition'
  })
  if (summary === undefined) return

  const nextWork = await vscode.window.showInputBox({
    prompt: 'Suggested next work (optional)',
    placeHolder: 'Leave empty to keep existing notes'
  })
  if (nextWork === undefined) return

  // Detect hot files early so we can offer handoff prompts
  const hotFiles = detectHotFiles(workspaceFolder)
  let handoffData = null

  if (hotFiles.length > 0) {
    const modeChoice = await vscode.window.showQuickPick(
      [
        { label: 'Single owner', description: 'Hand off to one agent', value: 'single' },
        { label: 'Shared owners', description: 'Two agents co-own the next step', value: 'shared' },
        { label: 'Auto-route', description: 'System picks owner(s) from capabilities', value: 'auto' },
        { label: 'Skip (enter reason)', description: 'No handoff — record reason instead', value: 'skip' }
      ],
      { placeHolder: `${hotFiles.length} hot file(s) detected. Add a handoff note?`, ignoreFocusOut: true }
    )
    if (modeChoice === undefined) return

    if (modeChoice.value === 'skip') {
      const skipReason = await vscode.window.showInputBox({
        prompt: 'Why are you skipping the handoff? (required)',
        placeHolder: 'Example: Solo branch, no review needed yet',
        ignoreFocusOut: true,
        validateInput: (v) => (v && v.trim() ? null : 'Reason cannot be empty')
      })
      if (skipReason === undefined) return
      handoffData = { no_handoff_reason: skipReason.trim() }
    } else {
      let toAgents = []
      let requiredCapabilities = []

      if (modeChoice.value === 'single') {
        const toInput = await vscode.window.showInputBox({
          prompt: 'Target agent name (e.g. claude)',
          placeHolder: 'claude',
          ignoreFocusOut: true,
          validateInput: (v) => (v && v.trim() ? null : 'Agent name cannot be empty')
        })
        if (toInput === undefined) return
        toAgents = [toInput.trim()]
      } else if (modeChoice.value === 'shared') {
        const toInput = await vscode.window.showInputBox({
          prompt: 'Two agent names, comma-separated (e.g. claude, copilot)',
          placeHolder: 'claude, copilot',
          ignoreFocusOut: true,
          validateInput: (v) => {
            const parts = (v || '').split(',').map((s) => s.trim()).filter(Boolean)
            return parts.length === 2 ? null : 'Enter exactly 2 agent names separated by a comma'
          }
        })
        if (toInput === undefined) return
        toAgents = toInput.split(',').map((s) => s.trim()).filter(Boolean)
      } else if (modeChoice.value === 'auto') {
        const capsInput = await vscode.window.showInputBox({
          prompt: 'Required capabilities, comma-separated (e.g. policy_review, pr_review)',
          placeHolder: 'policy_review, pr_review',
          ignoreFocusOut: true,
          validateInput: (v) => {
            const parts = (v || '').split(',').map((s) => s.trim()).filter(Boolean)
            return parts.length > 0 ? null : 'Enter at least one capability'
          }
        })
        if (capsInput === undefined) return
        requiredCapabilities = capsInput.split(',').map((s) => s.trim()).filter(Boolean)
      }

      const handoffSummary = await vscode.window.showInputBox({
        prompt: 'Handoff summary (what does the next agent need to do?)',
        value: summary,
        ignoreFocusOut: true
      })
      if (handoffSummary === undefined) return

      const handoffNotes = await vscode.window.showInputBox({
        prompt: 'Additional notes for the next agent (optional)',
        placeHolder: 'Example: Check regression risk in token refresh path before merge.',
        ignoreFocusOut: true
      })
      if (handoffNotes === undefined) return

      handoffData = {
        summary: handoffSummary.trim() || summary,
        notes: handoffNotes.trim(),
        owner_mode: modeChoice.value,
        to_agents: toAgents,
        required_capabilities: requiredCapabilities,
        no_handoff_reason: null
      }
    }
  }

  let health
  try {
    const result = endSessionCore(workspaceFolder, agent, summary, nextWork, handoffData)
    health = result.health
  } catch (err) {
    vscode.window.showErrorMessage(`AgentSync: ${err.message}`)
    return
  }

  await openTrackerDocument(workspaceFolder)

  const failedChecks = Object.values(health).filter((status) => status === 'Fail').length
  const handoffMsg = handoffData
    ? handoffData.no_handoff_reason
      ? ' Handoff skipped (reason recorded).'
      : ' Handoff note created.'
    : ''
  const summaryMessage =
    failedChecks > 0
      ? `AgentSync: Session ended. ${failedChecks} health check(s) failed.${handoffMsg}`
      : `AgentSync: Session ended and tracker updated.${handoffMsg}`

  vscode.window.showInformationMessage(summaryMessage)
}

// ─── Automation helpers ───────────────────────────────────────────────────────

/**
 * Scan the workspace's package.json for build/test/deploy scripts and offer to
 * populate .agentsync.json commands. Called automatically during initWorkspace
 * (skips if commands already configured) and on demand from the command palette
 * (always prompts).
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<boolean>} true if commands were written
 */
/**
 * Detect which package manager is in use by checking for lock files.
 * @param {string} workspaceRoot
 * @returns {'bun' | 'pnpm' | 'yarn' | 'npm'}
 */
function detectPackageManager(workspaceRoot) {
  if (
    fs.existsSync(path.join(workspaceRoot, 'bun.lockb')) ||
    fs.existsSync(path.join(workspaceRoot, 'bun.lock'))
  ) return 'bun'
  if (fs.existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(workspaceRoot, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

async function autoDetectCommands(workspaceFolder, options = {}) {
  const { force = false } = options
  const cfg = vscode.workspace.getConfiguration('agentsync')
  if (!force && !cfg.get('autoDetectCommands', true)) return false

  const pkgPath = path.join(workspaceFolder.uri.fsPath, 'package.json')
  if (!fs.existsSync(pkgPath)) return false

  let scripts
  try {
    const raw = fs.readFileSync(pkgPath, 'utf8').replace(/^\uFEFF/, '')
    scripts = JSON.parse(raw).scripts || {}
  } catch {
    return false
  }

  const manager = detectPackageManager(workspaceFolder.uri.fsPath)

  // Map .agentsync.json command keys to candidate script names (first match wins)
  const candidateMap = {
    build: ['build', 'compile', 'bundle', 'tsc'],
    test: ['test', 'tests', 'jest', 'mocha', 'vitest', 'spec'],
    deploy: ['deploy', 'release', 'publish', 'ship']
  }

  const detected = {}
  for (const [key, candidates] of Object.entries(candidateMap)) {
    for (const candidate of candidates) {
      if (scripts[candidate]) {
        detected[key] = `${manager} run ${candidate}`
        break
      }
    }
  }

  if (Object.keys(detected).length === 0) return false

  // Unless forced, skip if .agentsync.json already has commands configured
  if (!force) {
    const existing = readAgentSyncConfig(workspaceFolder)
    const hasExisting = Object.values(existing.commands).some((v) => v && String(v).trim())
    if (hasExisting) return false
  }

  const detectedList = Object.entries(detected)
    .map(([k, v]) => `${k}: "${v}"`)
    .join(', ')

  const choice = await vscode.window.showInformationMessage(
    `AgentSync: Detected scripts in "${workspaceFolder.name}" — ${detectedList}. Populate .agentsync.json?`,
    'Yes',
    'Skip'
  )
  if (choice !== 'Yes') return false

  const existing = readAgentSyncConfig(workspaceFolder)
  const updated = { ...existing, commands: { ...existing.commands, ...detected } }
  try {
    fs.writeFileSync(getConfigPath(workspaceFolder), JSON.stringify(updated, null, 2), 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * On VS Code startup, check all workspace folders for an active AgentSync session
 * and prompt the user to continue or end it.
 * Controlled by the agentsync.promptOnStartup setting.
 * @param {vscode.ExtensionContext} _context
 */
async function checkSessionOnStartup(_context) {
  const cfg = vscode.workspace.getConfiguration('agentsync')
  if (!cfg.get('promptOnStartup', true)) return

  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) return

  for (const folder of folders) {
    const statePath = getStatePath(folder)
    if (!fs.existsSync(statePath)) continue

    let state
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    } catch {
      continue
    }

    if (!state.sessionActive || !state.activeSession) continue

    const { agent, goal, startedAt } = state.activeSession
    const ageMs = Date.now() - Date.parse(startedAt)
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000))
    const ageLabel = ageHours >= 1 ? `${ageHours}h ago` : 'recently'
    const goalLabel = goal ? ` — "${goal}"` : ''

    const choice = await vscode.window.showInformationMessage(
      `AgentSync: ${agent} has an active session in "${folder.name}" (started ${ageLabel}${goalLabel}).`,
      'Continue',
      'End Session'
    )

    if (choice === 'End Session') {
      await vscode.commands.executeCommand('agentsync.endSession')
    }
  }
}

/**
 * Start a background timer that reminds the user to end a session that has been
 * running longer than agentsync.sessionReminderHours. Fires at most once per
 * session (identified by its startedAt timestamp).
 * @param {vscode.ExtensionContext} context
 */
function startSessionReminderTimer(context) {
  const reminded = new Set()
  const CHECK_INTERVAL_MS = 30 * 60 * 1000 // check every 30 minutes

  const timer = setInterval(() => {
    const cfg = vscode.workspace.getConfiguration('agentsync')
    const reminderHours = cfg.get('sessionReminderHours', 2)
    if (!reminderHours || reminderHours <= 0) return

    const folders = vscode.workspace.workspaceFolders
    if (!folders) return

    for (const folder of folders) {
      const statePath = getStatePath(folder)
      if (!fs.existsSync(statePath)) continue

      let state
      try {
        state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      } catch {
        continue
      }

      if (!state.sessionActive || !state.activeSession?.startedAt) continue

      // De-dup: only remind once per unique session start
      const sessionKey = `${folder.uri.fsPath}::${state.activeSession.startedAt}`
      if (reminded.has(sessionKey)) continue

      const ageMs = Date.now() - Date.parse(state.activeSession.startedAt)
      const ageHours = ageMs / (60 * 60 * 1000)
      if (ageHours < reminderHours) continue

      reminded.add(sessionKey)

      const ageLabel = Math.floor(ageHours) + 'h'
      vscode.window
        .showWarningMessage(
          `AgentSync: ${state.activeSession.agent}'s session in "${folder.name}" has been running for ${ageLabel}. Time to wrap up?`,
          'End Session',
          'Dismiss'
        )
        .then((choice) => {
          if (choice === 'End Session') {
            vscode.commands.executeCommand('agentsync.endSession')
          }
        })
    }
  }, CHECK_INTERVAL_MS)

  context.subscriptions.push({ dispose: () => clearInterval(timer) })
}

// ─── Extension lifecycle ──────────────────────────────────────────────────────

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // ── Status bar ──
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  statusItem.command = 'agentsync.openTracker'
  updateStatusBar(statusItem)

  const dashboardProvider = new AgentSyncDashboardViewProvider()
  const dashboardView = vscode.window.registerWebviewViewProvider('agentsync.dashboard', dashboardProvider, {
    webviewOptions: { retainContextWhenHidden: true }
  })

  // ── Tree view ──
  const treeProvider = new AgentSyncTreeDataProvider()
  const treeView = vscode.window.createTreeView('agentsync.panel', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  })

  const refresh = () => {
    updateStatusBar(statusItem)
    treeProvider.refresh()
    dashboardProvider.refresh()
  }

  // ── File watchers ──
  const trackerWatcher = vscode.workspace.createFileSystemWatcher('**/AgentTracker.md')
  trackerWatcher.onDidChange(refresh)
  trackerWatcher.onDidCreate(refresh)
  trackerWatcher.onDidDelete(refresh)

  const configWatcher = vscode.workspace.createFileSystemWatcher('**/.agentsync.json')
  configWatcher.onDidChange(refresh)
  configWatcher.onDidCreate(refresh)
  configWatcher.onDidDelete(refresh)

  const handoffsWatcher = vscode.workspace.createFileSystemWatcher('**/.agentsync/handoffs.json')
  handoffsWatcher.onDidChange(refresh)
  handoffsWatcher.onDidCreate(refresh)
  handoffsWatcher.onDidDelete(refresh)

  // state.json is written after AgentTracker.md on session changes, but the
  // drop-zone API writes it independently — watch it to keep the panel live.
  const stateWatcher = vscode.workspace.createFileSystemWatcher('**/.agentsync/state.json')
  stateWatcher.onDidChange(refresh)
  stateWatcher.onDidCreate(refresh)

  // Drop-zone API: terminal agents write .agentsync/request.json to trigger actions
  const requestWatcher = vscode.workspace.createFileSystemWatcher('**/.agentsync/request.json')
  requestWatcher.onDidChange(async (uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri)
    if (folder) await processDropZoneRequest(folder)
  })
  requestWatcher.onDidCreate(async (uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri)
    if (folder) await processDropZoneRequest(folder)
  })

  // Refresh the panel when the active editor changes (workspace folder may differ)
  const onEditorChange = vscode.window.onDidChangeActiveTextEditor(refresh)
  const onWorkspaceChange = vscode.workspace.onDidChangeWorkspaceFolders(refresh)

  // Tick the elapsed-time display every 60 seconds while a session is active
  const elapsedTimer = setInterval(() => {
    const folder = getActiveWorkspaceFolder()
    if (!folder) return
    const statePath = getStatePath(folder)
    if (!fs.existsSync(statePath)) return
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      if (state.sessionActive) refresh()
    } catch {}
  }, 60 * 1000)

  // Gentle pulse so the panel can show live state feedback frames.
  const statePulseTimer = setInterval(() => {
    refresh()
  }, 2000)

  // ── Commands ──
  const initCmd = vscode.commands.registerCommand('agentsync.init', () => initWorkspace(context))
  const openCmd = vscode.commands.registerCommand('agentsync.openTracker', () => openTracker(context))
  const openDashboardCmd = vscode.commands.registerCommand('agentsync.openDashboard', async () => {
    const opened = await openAgentSyncDashboard()
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Live dashboard not found. Run "View: Reset View Locations" and try again.'
      )
    }
  })
  const openPanelCmd = vscode.commands.registerCommand('agentsync.openPanel', async () => {
    const opened = await openAgentSyncPanel()
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Panel not found. Run "View: Reset View Locations" and then "AgentSync: Open Panel".'
      )
    }
  })
  const openTutorialCmd = vscode.commands.registerCommand('agentsync.openTutorial', async () => {
    const opened = await openAgentSyncTutorial(context)
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Could not open the interactive tutorial. Open "Getting Started" and select AgentSync.'
      )
    }
  })
  const openHandoffsCmd = vscode.commands.registerCommand('agentsync.openHandoffs', () => openHandoffs())
  const clearActiveSessionCmd = vscode.commands.registerCommand(
    'agentsync.clearActiveSession',
    () => clearActiveSession()
  )
  const startCmd = vscode.commands.registerCommand('agentsync.startSession', () => startSession(context))
  const endCmd = vscode.commands.registerCommand('agentsync.endSession', () => endSession(context))
  const detectCmd = vscode.commands.registerCommand('agentsync.detectCommands', async () => {
    const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
      return
    }
    const wrote = await autoDetectCommands(workspaceFolder, { force: true })
    if (!wrote) {
      vscode.window.showInformationMessage(
        'AgentSync: No new npm scripts detected, or .agentsync.json is already configured.'
      )
    }
  })
  const refreshCmd = vscode.commands.registerCommand('agentsync.refreshPanel', () => {
    refresh()
  })

  // ── Startup automation ──
  setTimeout(() => checkSessionOnStartup(context), 3000)
  startSessionReminderTimer(context)

  context.subscriptions.push(
    statusItem,
    dashboardView,
    treeView,
    trackerWatcher,
    configWatcher,
    handoffsWatcher,
    stateWatcher,
    requestWatcher,
    onEditorChange,
    onWorkspaceChange,
    { dispose: () => clearInterval(elapsedTimer) },
    { dispose: () => clearInterval(statePulseTimer) },
    initCmd,
    openCmd,
    openDashboardCmd,
    openPanelCmd,
    openTutorialCmd,
    openHandoffsCmd,
    clearActiveSessionCmd,
    startCmd,
    endCmd,
    detectCmd,
    refreshCmd
  )
}

function deactivate() {}

module.exports = { activate, deactivate }
