const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const linker = require('./sync/linker')

// ——— Modular imports —————————————————————————————————————————————————————
const utils = require('./utils')
const SessionManager = require('./session/SessionManager')
const { AgentSyncDashboardViewProvider } = require('./dashboard/DashboardProvider')

const {
  // constants
  PLACEHOLDER,
  DEFAULT_STALE_HOURS,
  OPEN_HANDOFF_STATUSES,
  DEFAULT_END_SESSION_ZERO_TOUCH,
  DEFAULT_START_SESSION_ZERO_TOUCH,
  ROLE_LIST,
  EXECUTION_PROVIDER_DEFS,
  EXECUTION_PROVIDER_BY_ID,
  // paths
  getTemplatesDir,
  getTrackerPath,
  getConfigPath,
  getAgentSyncDir,
  getStatePath,
  getRequestPath,
  getResultPath,
  getHandoffsPath,
  getContextCapsulePath,
  // text
  isEmptyValue,
  escapeRegExp,
  parseTracker,
  getSectionBody,
  setSectionBody,
  canonicalAgentId,
  toSingleLine,
  formatElapsed,
  // io
  parseISODate,
  parseCommandArgv,
  // git
  runGit,
  runGitExitCode,
  normalizeRepoRelativePath,
  scoreNextTaskCapabilities,
  getHotFilesCached,
  // workspace
  getActiveWorkspaceFolder,
  resolveWorkspaceFolder,
  getWorkspaceLabelPrefix,
  readAgentSyncConfig,
  writeConfigFile,
  // snapshot
  getWorkspaceSnapshot,
  invalidateWorkspaceCaches,
  // agent catalog
  buildCatalog,
  mapAgentToCapabilities,
  matchAgentsByCapabilities,
  // execution channels
  assembleAgentPrompt,
  deliverPrompt,
  injectPersonalityToWorkspace,
  // session
  buildSessionIdentity,
  // automation
  buildDeterministicSessionSummary,
  resolveAutomationRoute,
  buildAutomationHandoffNotes,
  // health
  runHealthChecks,
  resolveHealthCheckProgram,
  // handoffs
  validateHandoff,
  claimHandoffRecord,
  completeHandoffRecord,
  syncTrackerHandoffsSection,
  generateContextCapsule,
  readTracker,
  readStateFile,
  writeStateFile,
  readHandoffs,
  writeHandoffs,
  normalizeHandoffStatus,
  buildHandoffId,
  getHandoffOwners,
  listHandoffRecords,
  createHandoffRecord,
  listRunnableQueuedHandoffs
} = utils

let _agentCatalog = null
let _extensionPath = null

/**
 * Prompt the user to select their workspace role.
 * @param {string} [prefillRole]
 * @returns {Promise<string|null>}
 */
async function promptForRole(prefillRole) {
  const picks = ROLE_LIST.map((r) => ({
    label: r.replace(/_/g, ' '),
    description: '',
    role: r
  }))
  if (prefillRole) {
    const match = picks.find((p) => p.role === prefillRole)
    if (match) return match.role
  }
  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select your primary role for this project',
    ignoreFocusOut: true
  })
  return selected?.role || null
}

/**
 * Apply a preset configuration and instruction block for the given role.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} role
 */
function applyRolePreset(workspaceFolder, role) {
  if (!ROLE_LIST.includes(role)) return
  const root = workspaceFolder.uri.fsPath
  // read role JSON template
  let preset = null
  try {
    const rolesDir = path.join(__dirname, 'templates', 'roles')
    const raw = fs.readFileSync(path.join(rolesDir, `${role}.json`), 'utf8')
    preset = JSON.parse(raw)
  } catch {
    // missing or invalid roles file
  }
  if (!preset) return

  // Update Config
  const cfg = readAgentSyncConfig(workspaceFolder)
  cfg.userProfile = { role }
  if (Array.isArray(preset.dashboardShortcuts)) {
    cfg.dashboardShortcuts = preset.dashboardShortcuts
  }
  if (typeof preset.sessionDurationWarningMinutes === 'number') {
    cfg.sessionDurationWarningMinutes = preset.sessionDurationWarningMinutes
  }
  if (preset.handoffRoutingDefaults) {
    cfg.automation = cfg.automation || {}
    cfg.automation.handoffRoutingDefaults = preset.handoffRoutingDefaults
  }
  writeConfigFile(workspaceFolder, cfg)

  // Append role instructions to agent docs
  const appendBlock = (filePath, text) => {
    let content = ''
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch {}
    // remove previous role block
    content = content.replace(/## Role:[\s\S]*?(?=\n## |$)/g, '')
    content += '\n\n## Role: ' + role.replace(/_/g, ' ') + '\n\n' + text + '\n'
    fs.writeFileSync(filePath, content, 'utf8')
  }

  if (preset.agentInstructionBlock) {
    appendBlock(path.join(root, 'CLAUDE.md'), preset.agentInstructionBlock)
    appendBlock(path.join(root, 'AGENTS.md'), preset.agentInstructionBlock)
    appendBlock(path.join(root, '.github', 'copilot-instructions.md'), preset.agentInstructionBlock)
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
      invalidateWorkspaceCaches(workspaceFolder)
    }
  } catch (err) {
    // M4: only silently ignore ENOENT; log unexpected errors
    if (err && err.code !== 'ENOENT') console.error('[AgentSync] ensureHandoffsFile error:', err)
  }
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

  // M5: use strict ISO parser to avoid silent misparse of locale date strings
  const started = parseISODate(state.activeSession.startedAt)
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

  const openHandoffs = handoffs.filter((h) =>
    OPEN_HANDOFF_STATUSES.has(String(h?.status || '').toLowerCase())
  )
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

// ——— Git helpers ——————————————————————————————————————————————————————————

/**
 * Run a git command and return stdout when successful.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string[]} args
 * @returns {string | null}
 */

/**
 * Run a git command and return the exit code.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string[]} args
 * @returns {number}
 */

// ——— Safe file I/O helpers ——————————————————————————————————————————————

/**
 * Write a file atomically: write to a .tmp sibling then rename.
 * Prevents partial-write corruption if VS Code or the OS crashes mid-write.
 * On same-volume targets this rename is atomic on both NTFS and POSIX file systems.
 * C3 fix.
 * @param {string} filePath
 * @param {string} content
 * @param {BufferEncoding} [encoding]
 */

/**
 * Parse an ISO 8601 timestamp string into a numeric epoch ms value.
 * Returns NaN for non-ISO strings, avoiding silent misparse from Date.parse().
 * M5 fix.
 * @param {string | null | undefined} str
 * @returns {number}
 */

/**
 * Tokenise a command string into [program, ...args] without invoking a shell.
 * Handles quoted substrings (" and ') and backslash escapes within quotes.
 * Does NOT support shell operators (&&, ||, ;, |, $(), backticks) — use a


// ——— Health checks ————————————————————————————————————————————————————————





// ———————— UI Lifecycle ————————————————————————————————————————————————————

// ——— Tracker I/O —————————————————————————————————————————————————————————

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

async function openAgentSyncDocs(context) {
  const manifest = context?.extension?.packageJSON || {}
  const target = String(manifest.homepage || manifest.repository?.url || '').trim()
  if (!target) return false
  try {
    await vscode.env.openExternal(vscode.Uri.parse(target))
    return true
  } catch {
    return false
  }
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
}

// ——— State file I/O ——————————————————————————————————————————————————————

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

// ——— Tracker warnings ————————————————————————————————————————————————————

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
    const exitCode = runGitExitCode(workspaceFolder, [
      'merge-base',
      '--is-ancestor',
      tracker.commit,
      'HEAD'
    ])
    if (exitCode !== 0) {
      warnings.push(`Tracker commit ${tracker.commit} is not in current HEAD history.`)
    }
  }

  return warnings
}

// ——— Prompt helpers ——————————————————————————————————————————————————————

function getExecutionProvider(value) {
  const normalized = canonicalAgentId(value)
  if (!normalized) return null
  return EXECUTION_PROVIDER_BY_ID[normalized] || null
}

function getExecutionProviderId(value) {
  if (isEmptyValue(String(value || ''))) return null
  return getExecutionProvider(value)?.id || canonicalAgentId(value) || null
}

function getExecutionProviderLabel(value) {
  if (isEmptyValue(String(value || ''))) return null
  const provider = getExecutionProvider(value)
  if (provider) return provider.label
  const text = String(value || '').trim()
  return text || null
}

function getSessionProviderInfo(session, fallback = null) {
  const providerId =
    canonicalAgentId(session?.provider_id || '') ||
    getExecutionProviderId(session?.provider_label || '') ||
    getExecutionProviderId(session?.agent || '') ||
    getExecutionProviderId(fallback)
  const providerLabel =
    getExecutionProviderLabel(session?.provider_label || '') ||
    getExecutionProviderLabel(session?.agent || '') ||
    getExecutionProviderLabel(fallback) ||
    'Unknown'
  return { id: providerId, label: providerLabel }
}

function getPersonalityDisplayName(workspaceFolder, personalityId) {
  const normalized = canonicalAgentId(personalityId)
  if (!normalized) return null
  try {
    const catalog = getAgentCatalog(workspaceFolder)
    const match = catalog?.agents?.find((agent) => canonicalAgentId(agent.id) === normalized)
    return match?.name || null
  } catch {
    return null
  }
}

function getSessionPersonalityInfo(workspaceFolder, session) {
  const personalityId =
    canonicalAgentId(session?.personality_id || '') ||
    canonicalAgentId(session?.agent_personality_id || '') ||
    null
  const personalityName =
    String(session?.personality_name || '').trim() ||
    getPersonalityDisplayName(workspaceFolder, personalityId) ||
    'None'
  return { id: personalityId, name: personalityName }
}

/**
 * Prompt user for the execution provider.
 * @param {string} defaultAgent
 * @returns {Promise<string | null>}
 */
async function promptForAgent(defaultAgent) {
  const defaultLabel = getExecutionProviderLabel(defaultAgent) || 'Codex'
  const builtIn = EXECUTION_PROVIDER_DEFS.map((provider) => ({
    label: provider.label,
    description: provider.label === defaultLabel ? 'default' : undefined
  }))

  const choice = await vscode.window.showQuickPick([...builtIn, { label: 'Other' }], {
    placeHolder: 'Select the execution provider for this session'
  })

  if (!choice) return null
  if (choice.label !== 'Other') return choice.label

  const custom = await vscode.window.showInputBox({
    prompt: 'Enter provider name',
    value: defaultLabel !== 'Codex' ? defaultLabel : ''
  })
  if (custom === undefined) return null

  const trimmed = custom.trim()
  return trimmed || null
}

/**
 * Build a deterministic one-line summary for End Session automation.
 * @param {{
 *  goal: string,
 *  hotFiles: string[],
 *  health: Record<string, string>,
 *  maxSummaryLength: number
 * }} params
 * @returns {string}
 */
// ———————— Session Management ——————————————————————————————————————————————
async function promptAutomationFallbackRouting(hotFileCount) {
  const modeChoice = await vscode.window.showQuickPick(
    [
      { label: 'single', description: 'Route to one target agent' },
      { label: 'shared', description: 'Route to exactly two agents' },
      { label: 'auto', description: 'Route by required capabilities' },
      { label: 'skip', description: 'Skip creating a handoff record for now' }
    ],
    {
      placeHolder: `${hotFileCount} hot file(s) detected. Select fallback routing mode.`,
      ignoreFocusOut: true
    }
  )
  if (!modeChoice) return null

  const selected = modeChoice.label
  if (selected === 'skip') {
    return {
      handoffData: {
        no_handoff_reason: 'Zero-touch fallback selected skip.',
        automation_context: 'fallback:skip'
      },
      automationContext: 'fallback:skip'
    }
  }

  const inputPrompt =
    selected === 'single'
      ? 'Fallback target agent (single owner)'
      : selected === 'shared'
        ? 'Fallback target agents (comma-separated, exactly two)'
        : 'Fallback required capabilities (comma-separated)'

  const rawInput = await vscode.window.showInputBox({
    prompt: inputPrompt,
    ignoreFocusOut: true,
    validateInput: (value) => {
      const parts = String(value || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean)
      if (selected === 'single')
        return parts.length === 1 ? null : 'Enter exactly one target agent.'
      if (selected === 'shared')
        return parts.length === 2 ? null : 'Enter exactly two target agents.'
      return parts.length > 0 ? null : 'Enter at least one capability.'
    }
  })
  if (rawInput === undefined) return null

  const values = rawInput
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  if (selected === 'single') {
    return {
      handoffData: {
        owner_mode: 'single',
        to_agents: [canonicalAgentId(values[0])],
        required_capabilities: [],
        no_handoff_reason: null,
        automation_context: 'fallback:single'
      },
      automationContext: 'fallback:single'
    }
  }
  if (selected === 'shared') {
    return {
      handoffData: {
        owner_mode: 'shared',
        to_agents: values.slice(0, 2).map((v) => canonicalAgentId(v)),
        required_capabilities: [],
        no_handoff_reason: null,
        automation_context: 'fallback:shared'
      },
      automationContext: 'fallback:shared'
    }
  }

  return {
    handoffData: {
      owner_mode: 'auto',
      to_agents: [],
      required_capabilities: values,
      no_handoff_reason: null,
      automation_context: 'fallback:auto'
    },
    automationContext: 'fallback:auto'
  }
}

/**
 * Copy generated handoff prompt lines to clipboard.
 * For multiple prompts, user selects which one to copy.
 * @param {string[]} promptLines
 * @returns {Promise<boolean>}
 */
async function copyHandoffPromptToClipboard(promptLines) {
  if (!Array.isArray(promptLines) || promptLines.length === 0) return false

  if (promptLines.length === 1) {
    await vscode.env.clipboard.writeText(promptLines[0])
    return true
  }

  const picks = promptLines.map((line, index) => ({
    label: `Prompt ${index + 1}`,
    description: line,
    line
  }))
  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select which handoff prompt to copy',
    ignoreFocusOut: true
  })
  if (!selected) return false
  await vscode.env.clipboard.writeText(selected.line)
  return true
}

/**
 * Update prompt_copied_to_clipboard on an existing handoff record.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string | null | undefined} handoffId
 * @param {boolean} copied
 */
function updateHandoffPromptCopiedFlag(workspaceFolder, handoffId, copied) {
  const normalizedId = toSingleLine(handoffId)
  if (!normalizedId) return
  const store = readHandoffs(workspaceFolder)
  if (!store.handoffs.length) return
  const next = store.handoffs.map((handoff) => {
    if (toSingleLine(handoff?.handoff_id) !== normalizedId) return handoff
    return {
      ...handoff,
      prompt_copied_to_clipboard: copied === true,
      updated_at: new Date().toISOString()
    }
  })
  writeHandoffs(workspaceFolder, { version: 1, handoffs: next })
}

/**
 * Find the first queued handoff in handoffs.json addressed to a specific agent.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} agentId
 * @returns {any | null}
 */
function findClaimableHandoff(workspaceFolder, agentId) {
  const canonical = canonicalAgentId(agentId)
  if (!canonical) return null
  const { handoffs } = readHandoffs(workspaceFolder)
  return (
    handoffs.find((h) => {
      if (String(h?.status || '').toLowerCase() !== 'queued') return false
      const owners = utils.getHandoffOwners(h)
      return owners.length === 0 || owners.includes(canonical)
    }) || null
  )
}

/**
 * Normalize an input status to a supported handoff state.
 * @param {string | null | undefined} status
 * @param {string} fallback
 * @returns {string}
 */
// ———————— Handoff Records —————————————————————————————————————————————————

/**
 * Create and persist a handoff record.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {any} input
 */

/**
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
// DEPRECATED: .agencysync/ sync is maintained for backward compatibility.
// New projects should use the AgentSync agent catalog and clipboard-first execution instead.
function getAgencySyncPaths(workspaceFolder) {
  const base = path.join(workspaceFolder.uri.fsPath, '.agencysync')
  return {
    base,
    runs: path.join(base, 'runs.json'),
    events: path.join(base, 'events')
  }
}

/**
 * Parse a JSON file and return null on failure.
 * @param {string} filePath
 * @returns {any | null}
 */
function tryReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * @param {string} dirPath
 * @returns {string[]}
 */
function listJsonFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  const files = []
  /** @param {string} current */
  const walk = (current) => {
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) files.push(full)
    }
  }
  walk(dirPath)
  return files
}

/**
 * Normalize an Agency run/event object into an AgentSync handoff candidate.
 * @param {any} raw
 * @param {{ sourceRunId?: string | null, sourceEventId?: string | null }} [meta]
 */
function normalizeAgencyCandidate(raw, meta = {}) {
  if (!raw || typeof raw !== 'object') return null
  const toAgents = Array.isArray(raw.to_agents || raw.owners || raw.assignees)
    ? raw.to_agents || raw.owners || raw.assignees
    : []
  const requiredCaps = Array.isArray(raw.required_capabilities || raw.capabilities)
    ? raw.required_capabilities || raw.capabilities
    : []
  const sourceRunId = toSingleLine(raw.run_id || raw.runId || meta.sourceRunId || '') || null
  const sourceEventId =
    toSingleLine(raw.event_id || raw.eventId || meta.sourceEventId || '') || null

  const modeInput = String(raw.owner_mode || '').toLowerCase()
  const ownerMode =
    modeInput || (toAgents.length >= 2 ? 'shared' : toAgents.length === 1 ? 'single' : 'auto')
  const normalizedMode =
    ownerMode === 'single' || ownerMode === 'shared' || ownerMode === 'auto' ? ownerMode : 'auto'

  return {
    handoff_id: toSingleLine(raw.handoff_id || raw.handoffId || ''),
    task_id: toSingleLine(raw.task_id || raw.taskId || raw.id || ''),
    from_agent: canonicalAgentId(raw.from_agent || raw.agent || raw.source_agent || 'agency'),
    to_agents: toAgents.map((a) => canonicalAgentId(a)).filter(Boolean),
    owner_mode: normalizedMode,
    status: normalizeHandoffStatus(raw.status || raw.state, 'queued'),
    required_capabilities: requiredCaps.map((c) => toSingleLine(c)).filter(Boolean),
    summary: toSingleLine(raw.summary || raw.title || raw.message || ''),
    notes: toSingleLine(raw.notes || raw.description || ''),
    files: Array.isArray(raw.files || raw.changed_files)
      ? (raw.files || raw.changed_files).map((f) => toSingleLine(f)).filter(Boolean)
      : [],
    branch: toSingleLine(raw.branch || ''),
    commit: toSingleLine(raw.commit || raw.sha || ''),
    no_handoff_reason: toSingleLine(raw.no_handoff_reason || '') || null,
    source_system: 'agencysync',
    source_run_id: sourceRunId,
    source_event_id: sourceEventId
  }
}

/**
 * Sync .agencysync run/event artifacts into AgentSync handoffs.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {{ synced: number, created: number, updated: number, errors: string[] }}
 */
function syncAgencyRunsCore(workspaceFolder) {
  const paths = getAgencySyncPaths(workspaceFolder)
  const errors = []
  if (!fs.existsSync(paths.base)) {
    return { synced: 0, created: 0, updated: 0, errors }
  }

  const candidates = []
  const runsData = tryReadJson(paths.runs)
  if (Array.isArray(runsData)) {
    runsData.forEach((run, index) => {
      const candidate = normalizeAgencyCandidate(run, {
        sourceRunId: toSingleLine(run?.id || run?.run_id || index + 1) || null
      })
      if (candidate) candidates.push(candidate)
    })
  }

  const eventFiles = listJsonFilesRecursive(paths.events)
  for (const filePath of eventFiles) {
    const eventData = tryReadJson(filePath)
    const sourceEventId = path.relative(paths.events, filePath).replace(/\\/g, '/')
    const rows = Array.isArray(eventData) ? eventData : eventData ? [eventData] : []
    rows.forEach((row, index) => {
      const candidate = normalizeAgencyCandidate(row, {
        sourceEventId: `${sourceEventId}#${index + 1}`,
        sourceRunId: toSingleLine(row?.run_id || row?.runId || '') || null
      })
      if (candidate) candidates.push(candidate)
    })
  }

  if (candidates.length === 0) {
    const state = readStateFile(workspaceFolder) || {}
    const integration = {
      ...(state.integration && typeof state.integration === 'object' ? state.integration : {}),
      lastAgencySyncAt: new Date().toISOString()
    }
    writeStateFile(workspaceFolder, {
      ...state,
      integration,
      lastUpdated: new Date().toISOString()
    })
    return { synced: 0, created: 0, updated: 0, errors }
  }

  const store = readHandoffs(workspaceFolder)
  let created = 0
  let updatedCount = 0
  const now = new Date().toISOString()
  const next = [...store.handoffs]

  const resolveExistingIndex = (candidate) => {
    const cid = toSingleLine(candidate.handoff_id)
    if (cid) {
      const byId = next.findIndex((h) => toSingleLine(h?.handoff_id) === cid)
      if (byId >= 0) return byId
    }
    if (candidate.source_event_id) {
      const byEvent = next.findIndex(
        (h) => toSingleLine(h?.source_event_id) === candidate.source_event_id
      )
      if (byEvent >= 0) return byEvent
    }
    if (candidate.source_run_id && candidate.task_id) {
      const byRunTask = next.findIndex(
        (h) =>
          toSingleLine(h?.source_run_id) === candidate.source_run_id &&
          toSingleLine(h?.task_id) === candidate.task_id
      )
      if (byRunTask >= 0) return byRunTask
    }
    return -1
  }

  for (const candidate of candidates) {
    try {
      const idx = resolveExistingIndex(candidate)
      if (idx >= 0) {
        const existing = next[idx]
        const merged = {
          ...existing,
          ...candidate,
          handoff_id:
            toSingleLine(existing.handoff_id || candidate.handoff_id || '') ||
            buildHandoffId(next, now),
          task_id: toSingleLine(existing.task_id || candidate.task_id) || null,
          from_agent: canonicalAgentId(candidate.from_agent || existing.from_agent || 'agency'),
          to_agents:
            Array.isArray(candidate.to_agents) && candidate.to_agents.length > 0
              ? candidate.to_agents
              : Array.isArray(existing.to_agents)
                ? existing.to_agents
                : [],
          owner_mode:
            candidate.owner_mode ||
            existing.owner_mode ||
            (Array.isArray(candidate.to_agents) && candidate.to_agents.length >= 2
              ? 'shared'
              : Array.isArray(candidate.to_agents) && candidate.to_agents.length === 1
                ? 'single'
                : 'auto'),
          required_capabilities:
            Array.isArray(candidate.required_capabilities) &&
            candidate.required_capabilities.length > 0
              ? candidate.required_capabilities
              : Array.isArray(existing.required_capabilities)
                ? existing.required_capabilities
                : [],
          summary: candidate.summary || existing.summary || 'Agency handoff',
          notes: candidate.notes || existing.notes || '',
          updated_at: now,
          created_at: existing.created_at || now,
          state_history: [
            ...(Array.isArray(existing.state_history) ? existing.state_history : []),
            {
              status: normalizeHandoffStatus(candidate.status || existing.status, 'queued'),
              agent: canonicalAgentId(candidate.from_agent || existing.from_agent || 'agency'),
              timestamp: now,
              reason: 'synced from .agencysync'
            }
          ]
        }
        if (merged.no_handoff_reason) {
          merged.owner_mode = 'auto'
          merged.to_agents = []
          if (
            !Array.isArray(merged.required_capabilities) ||
            merged.required_capabilities.length === 0
          ) {
            merged.required_capabilities = ['skip-handoff']
          }
        } else if (merged.owner_mode === 'auto' && merged.required_capabilities.length === 0) {
          merged.required_capabilities = ['handoff']
        }
        const validation = validateHandoff(merged)
        if (!validation.valid) throw new Error(validation.errors.join('; '))
        next[idx] = merged
        updatedCount += 1
      } else {
        const createdRecord = utils.createHandoffRecord(workspaceFolder, {
          ...candidate,
          summary: candidate.summary || 'Agency handoff',
          notes: candidate.notes || '',
          source_system: 'agencysync'
        })
        next.push(createdRecord)
        created += 1
      }
    } catch (err) {
      errors.push(err && err.message ? err.message : 'Unknown agency sync error')
    }
  }

  // createHandoffRecord writes directly, so only perform a final write for in-memory updates.
  if (updatedCount > 0) {
    writeHandoffs(workspaceFolder, { version: 1, handoffs: next })
  }
  syncTrackerHandoffsSection(workspaceFolder)

  const state = readStateFile(workspaceFolder) || {}
  const integration = {
    ...(state.integration && typeof state.integration === 'object' ? state.integration : {}),
    lastAgencySyncAt: now
  }
  writeStateFile(workspaceFolder, { ...state, integration, lastUpdated: now })
  return { synced: candidates.length, created, updated: updatedCount, errors }
}

// â”€â”€â”€ Core session logic (headless â€” no VS Code UI) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// These functions contain the pure tracker mutation logic.
// They are called by the interactive VS Code commands and by the drop-zone API,
// allowing terminal agents and scripts to drive sessions without the UI.

function updateActiveSessionContext(workspaceFolder, updates = {}) {
  const state = readStateFile(workspaceFolder) || {}
  if (!state?.sessionActive || !state?.activeSession) return null
  const nextSession = {
    ...state.activeSession,
    ...updates
  }
  writeStateFile(workspaceFolder, {
    ...state,
    lastUpdated: new Date().toISOString(),
    activeSession: nextSession
  })
  return nextSession
}

/**
// ———————— Dashboard ————————————————————————————————————————————————————————

// â”€â”€â”€ Drop-zone API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Terminal agents, scripts, and CI can drive AgentSync by writing a JSON file
// to .agentsync/request.json in the workspace root. The extension watches for
// this file, processes the action, and writes the result to .agentsync/result.json.
//
// Supported actions:
//
//   startSession  { action, agent, goal? }
//   endSession    { action, agent, summary?, nextWork?, handoff? }
//   status        { action }
//   health        { action }
//   listHandoffs  { action }
//   claimHandoff  { action, handoffId, agent }
//   completeHandoff { action, handoffId, agent, status?, reason? }
//   createHandoff { action, handoff }
//   syncAgencyRuns { action }
//
// Example (from a terminal agent):
//   echo '{"action":"startSession","agent":"Claude","goal":"Fix login bug"}' \
//     > .agentsync/request.json
//   # Poll .agentsync/result.json for { "ok": true, ... }

/**
 * Per-folder in-flight guard for processDropZoneRequest.
 * Prevents both onDidChange and onDidCreate firing on the same file from
 * causing duplicate processing (C2 / H1 fix).
 * @type {Set<string>}
 */
const _dropZoneInFlight = new Set()

/**
 * Process a drop-zone request file and write the result.
 * C2 fix: request.json is renamed to request.json.processing BEFORE reading â€”
 * this is atomic on same-volume writes and prevents the race where a crash after
 * delete but before write left no result for the caller.  An in-flight Set
 * prevents concurrent calls (onDidChange + onDidCreate both firing) from
 * racing to claim the same file.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
async function processDropZoneRequest(workspaceFolder) {
  const folderKey = workspaceFolder.uri.fsPath
  // H1/C2: skip if already processing this folder
  if (_dropZoneInFlight.has(folderKey)) return

  const requestPath = getRequestPath(workspaceFolder)
  const claimPath = requestPath + '.processing'

  // Atomically claim the file â€” if another call already renamed it, renameSync throws
  try {
    fs.renameSync(requestPath, claimPath)
  } catch {
    return // File doesn't exist or was already claimed by a concurrent call
  }

  _dropZoneInFlight.add(folderKey)

  let request
  try {
    const raw = fs.readFileSync(claimPath, 'utf8')
    request = JSON.parse(raw)
  } catch {
    writeResultFile(workspaceFolder, {
      ok: false,
      error: 'Invalid JSON in request file',
      timestamp: new Date().toISOString()
    })
    try {
      fs.unlinkSync(claimPath)
    } catch (err) {
      if (err && err.code !== 'ENOENT') console.error('[AgentSync] drop-zone cleanup error:', err)
    }
    _dropZoneInFlight.delete(folderKey)
    return
  }

  const { action } = request || {}
  const timestamp = new Date().toISOString()

  try {
    switch (action) {
      case 'startSession': {
        const { agent, goal } = request
        if (!agent) throw new Error('Missing required field: agent')
        SessionManager.startSessionCore(workspaceFolder, agent, goal || 'Session started')
        const state = readStateFile(workspaceFolder)
        if (state?.sessionMetrics) {
          state.sessionMetrics.commandsRun = (state.sessionMetrics.commandsRun || 0) + 1
          writeStateFile(workspaceFolder, state)
        }
        writeResultFile(workspaceFolder, { ok: true, action, timestamp })
        break
      }

      case 'endSession': {
        const { agent, summary, nextWork, handoff } = request
        if (!agent) throw new Error('Missing required field: agent')
        const state = readStateFile(workspaceFolder)
        if (state?.sessionMetrics) {
          state.sessionMetrics.commandsRun = (state.sessionMetrics.commandsRun || 0) + 1
          writeStateFile(workspaceFolder, state)
        }
        const hasProvidedSummary = typeof summary === 'string' && toSingleLine(summary).length > 0
        const zeroTouchEnabled =
          readAgentSyncConfig(workspaceFolder).automation?.endSessionZeroTouch?.enabled === true
        // M1: endSessionCore is now async
        const {
          health,
          hotFiles,
          handoff: handoffRecord,
          generatedSummary,
          summarySource,
          handoffPrompts
        } = await SessionManager.endSessionCore(
          workspaceFolder,
          agent,
          summary || '',
          nextWork || '',
          handoff || null,
          {
            summarySource: !hasProvidedSummary && zeroTouchEnabled ? 'deterministic' : 'user',
            automationUsed: zeroTouchEnabled && !hasProvidedSummary
          }
        )
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: {
            health,
            hotFiles,
            handoff: handoffRecord,
            generatedSummary,
            summarySource,
            handoffPrompts,
            promptCopiedToClipboard: false
          }
        })
        break
      }

      case 'status': {
        const content = readTracker(workspaceFolder)
        const tracker = content ? parseTracker(content) : null
        const warnings = tracker ? getTrackerWarnings(workspaceFolder, tracker) : []
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: { tracker, warnings }
        })
        break
      }

      case 'health': {
        // M1: runHealthChecks is now async
        const { results, outputs } = await runHealthChecks(workspaceFolder)
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: { results, outputs }
        })
        break
      }

      case 'listHandoffs': {
        const handoffs = utils.listHandoffRecords(workspaceFolder)
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: { count: handoffs.length, handoffs }
        })
        break
      }

      case 'claimHandoff': {
        const handoffId = toSingleLine(request?.handoffId || request?.handoff_id)
        const agent = toSingleLine(request?.agent)
        if (!handoffId) throw new Error('Missing required field: handoffId')
        if (!agent) throw new Error('Missing required field: agent')
        const result = claimHandoffRecord(workspaceFolder, handoffId, agent)
        if (!result.ok) {
          writeResultFile(workspaceFolder, {
            ok: false,
            action,
            timestamp,
            error: result.reason || 'claim failed',
            data: result
          })
          break
        }
        syncTrackerHandoffsSection(workspaceFolder)
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: result
        })
        break
      }

      case 'completeHandoff': {
        const handoffId = toSingleLine(request?.handoffId || request?.handoff_id)
        const agent = toSingleLine(request?.agent)
        const status = toSingleLine(request?.status || 'merged') || 'merged'
        const reason = toSingleLine(request?.reason || '') || null
        if (!handoffId) throw new Error('Missing required field: handoffId')
        if (!agent) throw new Error('Missing required field: agent')
        const result = utils.completeHandoffRecord(
          workspaceFolder,
          handoffId,
          status,
          agent,
          reason
        )
        if (!result.ok) {
          writeResultFile(workspaceFolder, {
            ok: false,
            action,
            timestamp,
            error: result.reason || 'complete failed',
            data: result
          })
          break
        }
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: result
        })
        break
      }

      case 'createHandoff': {
        const handoff = request?.handoff
        if (!handoff || typeof handoff !== 'object') {
          throw new Error('Missing required field: handoff')
        }
        const created = utils.createHandoffRecord(workspaceFolder, handoff)
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: { handoff: created }
        })
        break
      }

      case 'syncAgencyRuns': {
        const data = syncAgencyRunsCore(workspaceFolder)
        writeResultFile(workspaceFolder, { ok: true, action, timestamp, data })
        break
      }

      default:
        throw new Error(`Unknown action: ${action || '(none)'}`)
    }
  } catch (err) {
    writeResultFile(workspaceFolder, { ok: false, error: err.message, action, timestamp })
  } finally {
    // C2: clean up claim file and release lock regardless of success or failure
    try {
      fs.unlinkSync(claimPath)
    } catch (err) {
      if (err && err.code !== 'ENOENT') console.error('[AgentSync] drop-zone cleanup error:', err)
    }
    _dropZoneInFlight.delete(folderKey)
  }
}

// â”€â”€â”€ Tree view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ———————— Tree View ——————————————————————————————————————————————————————

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

    const snapshot = getWorkspaceSnapshot(workspaceFolder)
    const state = snapshot.state
    const config = snapshot.config
    const handoffInfo = snapshot.handoffInfo
    const trackerContent = snapshot.trackerContent
    const inProgressLines = snapshot.inProgressLines
    const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0
    const staleInfo = getSessionStaleInfo(state, autoStaleSessionMinutes)
    const opsState = getOperationalState(
      state,
      inProgressLines,
      handoffInfo.handoffs,
      autoStaleSessionMinutes
    )
    const currentAgentId = getSessionProviderInfo(
      state?.activeSession || state?.lastSession || null
    ).id

    return [
      this._buildOverviewSection(
        workspaceFolder,
        opsState,
        state,
        inProgressLines,
        handoffInfo.handoffs
      ),
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
        `Active provider: ${
          state?.sessionActive
            ? getSessionProviderInfo(state?.activeSession || null).label || 'Unknown'
            : 'None'
        }`,
        vscode.TreeItemCollapsibleState.None,
        { icon: 'account' }
      ),
      new AgentSyncItem(
        `In Progress items: ${inProgressLines.length}`,
        vscode.TreeItemCollapsibleState.None,
        {
          icon: 'tasklist'
        }
      ),
      new AgentSyncItem(
        `Open handoffs: ${openHandoffCount}`,
        vscode.TreeItemCollapsibleState.None,
        {
          icon: 'git-pull-request'
        }
      ),
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
        action(
          'Initialize Workspace',
          'agentsync.init',
          'new-file',
          'Create AgentSync files in this repo'
        ),
        action('Start Session', 'agentsync.startSession', 'play', 'Begin tracking active work'),
        action(
          'Run Next Step',
          'agentsync.runNextStep',
          'run',
          'Claim the next runnable handoff and prepare its prompt'
        ),
        action(
          'End Session',
          'agentsync.endSession',
          'debug-stop',
          'Write handoff and health metadata'
        ),
        action(
          'Clear Active Session',
          'agentsync.clearActiveSession',
          'circle-slash',
          'Clear stale busy state'
        ),
        action(
          'Open AgentTracker',
          'agentsync.openTracker',
          'book',
          'Open shared handoff document'
        ),
        action(
          'Open Handoffs JSON',
          'agentsync.openHandoffs',
          'json',
          'Open machine-readable handoff data'
        ),
        action(
          'Context Status',
          'agentsync.contextStatus',
          'info',
          'Show session metrics and context health'
        ),
        action(
          'Open Walkthrough',
          'agentsync.openTutorial',
          'mortar-board',
          'Open guided onboarding in VS Code Getting Started'
        ),
        action(
          'Open Web Docs',
          'agentsync.openDocs',
          'link-external',
          'Open AgentSync documentation in your browser'
        )
      ]
    })
  }

  _buildSessionSection(state, staleInfo = { isStale: false, ageMs: null }) {
    if (!state || !state.sessionActive || !state.activeSession) {
      const lastAgent = state?.lastSession?.provider_label || state?.lastSession?.agent
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

    const sessionProvider = getSessionProviderInfo(state.activeSession || null)
    const sessionPersonality = getSessionPersonalityInfo(
      getActiveWorkspaceFolder(),
      state.activeSession || null
    )
    const { goal, startedAt } = state.activeSession
    const elapsed = formatElapsed(Date.now() - Date.parse(startedAt))

    const staleChild = staleInfo?.isStale
      ? new AgentSyncItem(
          `Stale session: running ${formatElapsed(staleInfo.ageMs || 0)}`,
          vscode.TreeItemCollapsibleState.None,
          {
            icon: 'warning',
            iconColor: new vscode.ThemeColor('charts.yellow'),
            tooltip: 'Use Clear Active Session if this session is no longer active.'
          }
        )
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

    return new AgentSyncItem(sessionProvider.label, vscode.TreeItemCollapsibleState.Expanded, {
      icon: staleInfo?.isStale ? 'warning' : 'record',
      iconColor: staleInfo?.isStale
        ? new vscode.ThemeColor('charts.yellow')
        : new vscode.ThemeColor('testing.iconPassed'),
      description: staleInfo?.isStale ? `stale ${elapsed}` : elapsed,
      contextValue: 'activeSession',
      children: [
        new AgentSyncItem(
          `Personality: ${sessionPersonality.name || 'None'}`,
          vscode.TreeItemCollapsibleState.None,
          { icon: 'library', tooltip: 'Active work personality' }
        ),
        goalChild,
        elapsedChild,
        ...(staleChild ? [staleChild] : [])
      ]
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
          new AgentSyncItem(
            `Invalid handoffs.json: ${error}`,
            vscode.TreeItemCollapsibleState.None,
            {
              icon: 'error',
              tooltip: `File: ${getHandoffsPath(workspaceFolder)}`,
              command: { command: 'agentsync.openHandoffs', title: 'Open Handoffs JSON' }
            }
          )
        ]
      })
    }

    const buckets = utils.getHandoffBuckets(handoffs, currentAgentId, staleAfterHours)
    const openHandoffs = buckets.open
    const assignedToMe = buckets.assignedToMe
    const sharedWithMe = buckets.sharedWithMe
    const blockedOrStale = buckets.blockedOrStale

    const toLeaf = (h) => {
      const id = h?.handoff_id || h?.task_id || 'unknown'
      const summary = (h?.summary || h?.task_id || 'No summary').trim()
      const status = String(h?.status || 'queued')
      const owners = utils.getHandoffOwners(h).join(',')
      const personality = getPersonalityDisplayName(
        workspaceFolder,
        utils.getHandoffPersonalityId(h)
      )
      return new AgentSyncItem(`${id}: ${summary}`, vscode.TreeItemCollapsibleState.None, {
        icon: 'note',
        description: status,
        tooltip: [
          `owners: ${owners || 'provider-flex'}`,
          `personality: ${personality || utils.getHandoffPersonalityId(h) || 'auto'}`,
          `mode: ${h?.owner_mode || 'unknown'}`
        ].join('\n'),
        command: { command: 'agentsync.openHandoffs', title: 'Open Handoffs JSON' }
      })
    }

    const group = (label, icon, items, emptyLabel) =>
      new AgentSyncItem(`${label} (${items.length})`, vscode.TreeItemCollapsibleState.Collapsed, {
        icon,
        children:
          items.length > 0
            ? items.slice(0, 10).map(toLeaf)
            : [
                new AgentSyncItem(emptyLabel, vscode.TreeItemCollapsibleState.None, {
                  icon: 'dash'
                })
              ]
      })

    const children = [
      group('Assigned to me', 'person', assignedToMe, 'No single-owner handoffs assigned to you'),
      group(
        'Shared with me',
        'organization',
        sharedWithMe,
        'No shared-owner handoffs assigned to you'
      ),
      group('Blocked/Stale', 'warning', blockedOrStale, 'No blocked or stale handoffs')
    ]

    return new AgentSyncItem(
      `Handoffs (${openHandoffs.length})`,
      vscode.TreeItemCollapsibleState.Collapsed,
      {
        icon: 'git-pull-request',
        children
      }
    )
  }

  _buildHealthSection(state) {
    const health = state?.health || {}

    const statusIcon = (status) => {
      if (status === 'Pass')
        return { icon: 'pass-filled', color: new vscode.ThemeColor('testing.iconPassed') }
      if (status === 'Fail')
        return { icon: 'error', color: new vscode.ThemeColor('testing.iconFailed') }
      return { icon: 'circle-outline', color: undefined }
    }

    const children = ['Build', 'Tests', 'Deploy'].map((label) => {
      const entry = health[label]
      const status = entry?.status ?? entry ?? 'Not configured'
      const { icon, color } = statusIcon(status)
      const output = (entry?.output || '').trim()
      return new AgentSyncItem(label, vscode.TreeItemCollapsibleState.None, {
        icon: status === 'Not configured' ? 'warning' : icon,
        iconColor: status === 'Not configured' ? new vscode.ThemeColor('charts.yellow') : color,
        description: status === 'Not configured' ? 'Setup needed' : status,
        tooltip:
          status === 'Not configured'
            ? 'Configure this command in .agentsync.json or run Detect Build/Test Commands.'
            : output
              ? `Last output:\n${output.slice(-300)}`
              : undefined,
        command:
          status === 'Not configured'
            ? { command: 'agentsync.detectCommands', title: 'Detect Build/Test Commands' }
            : undefined
      })
    })

    const hasFail = Object.values(health).some((e) => (e?.status ?? e) === 'Fail')
    const hasSetupMissing = ['Build', 'Tests', 'Deploy'].some((label) => {
      const entry = health[label]
      return (entry?.status ?? entry ?? 'Not configured') === 'Not configured'
    })
    return new AgentSyncItem('Health', vscode.TreeItemCollapsibleState.Collapsed, {
      icon: hasFail ? 'error' : hasSetupMissing ? 'warning' : 'heart',
      iconColor: hasFail
        ? new vscode.ThemeColor('testing.iconFailed')
        : hasSetupMissing
          ? new vscode.ThemeColor('charts.yellow')
          : undefined,
      children
    })
  }

  _buildHotFilesSection(state, workspaceFolder) {
    const hotFiles = state?.hotFiles || []
    const label = hotFiles.length > 0 ? `Hot Files (${hotFiles.length})` : 'Hot Files'

    const children =
      hotFiles.length > 0
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

    const children =
      lines.length > 0
        ? lines.map((line) => {
            const done = line.startsWith('- [x]')
            const text = line.replace(/^- \[[ x]\]\s*/, '').trim()
            return new AgentSyncItem(text, vscode.TreeItemCollapsibleState.None, {
              icon: done ? 'check' : 'circle-outline',
              tooltip: line
            })
          })
        : [
            new AgentSyncItem('Nothing active', vscode.TreeItemCollapsibleState.None, {
              icon: 'dash'
            })
          ]

    return new AgentSyncItem(label, vscode.TreeItemCollapsibleState.Collapsed, {
      icon: 'tasklist',
      children
    })
  }
}

// â”€â”€â”€ Status bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    const snapshot = getWorkspaceSnapshot(workspaceFolder)
    const tracker = snapshot.tracker
    const state = snapshot.state
    const config = snapshot.config
    const handoffInfo = snapshot.handoffInfo
    const inProgressLines = snapshot.inProgressLines
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
    if (state?.sessionActive && state?.activeSession) {
      const activeProvider = getSessionProviderInfo(state.activeSession || null)
      const activePersonality = getSessionPersonalityInfo(
        workspaceFolder,
        state.activeSession || null
      )
      tooltipLines.push(
        `Active: ${activeProvider.label}${activePersonality.name && activePersonality.name !== 'None' ? ' | ' + activePersonality.name : ''}`
      )
    }
    // Prefer state.json lastSession fields for display; fall back to parsed tracker.
    const displayAgent =
      state?.lastSession?.provider_label || state?.lastSession?.agent || tracker.agent
    const displayDate = state?.lastSession?.date || tracker.date
    const displayBranch = state?.lastSession?.branch || tracker.branch
    const displayCommit = state?.lastSession?.commit || tracker.commit
    if (!isEmptyValue(displayAgent) || !isEmptyValue(displayDate)) {
      tooltipLines.push(`Last session: ${displayAgent} | ${displayDate}`)
    }
    if (!isEmptyValue(displayBranch) || !isEmptyValue(displayCommit)) {
      tooltipLines.push(`Branch: ${displayBranch} | Commit: ${displayCommit}`)
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
    tooltipLines.push('', 'Click to open AgentSync Live')
    statusItem.tooltip = tooltipLines.join('\n')
  } catch {
    statusItem.text = `$(sync) ${prefix}AgentSync`
    statusItem.tooltip = `Could not read AgentTracker.md for ${workspaceFolder.name}`
  }

  statusItem.show()
}

// â”€â”€â”€ Commands â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  // If the workspace config requests symlink sync mode, move templates into
  // `.agents/` and replace the created files with symlinks pointing at them.
  try {
    const cfg = readAgentSyncConfig(workspaceFolder)
    if (cfg && cfg.sync && String(cfg.sync.mode || '').toLowerCase() === 'symlink') {
      const agentsDir = path.join(root, '.agents')
      fs.mkdirSync(agentsDir, { recursive: true })
      for (const file of filesToCreate) {
        const templateSrc = path.join(templatesDir, file.src)
        const canonicalTarget = path.join(agentsDir, path.basename(file.dest))
        try {
          fs.copyFileSync(templateSrc, canonicalTarget)
        } catch {}
        // create symlink mapping from canonicalTarget -> dest
        const relSource = path.relative(root, canonicalTarget)
        try {
          linker.syncAgentFiles(root, [{ source: relSource, dest: file.dest }], {
            allowWindowsBypass: true
          })
        } catch (e) {
          // log and continue
          console.error('agentsync: linker error', e && e.message)
        }
      }
      // refresh the dashboard/panel so UI reflects new files
      try {
        vscode.commands.executeCommand('agentsync.refreshPanel')
      } catch {}
    }
  } catch (e) {}

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
    'Open Walkthrough',
    'Open Web Docs'
  )

  // prompt for user role if not already set
  const cfg = readAgentSyncConfig(workspaceFolder)
  if (!cfg.userProfile || !cfg.userProfile.role) {
    const role = await promptForRole()
    if (role) applyRolePreset(workspaceFolder, role)
  }

  if (choice === 'Open AgentSync Panel') {
    const opened = await openAgentSyncPanel()
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Could not focus the panel. Run "View: Reset View Locations" and try again.'
      )
    }
  } else if (choice === 'Open Walkthrough') {
    const opened = await openAgentSyncTutorial(context)
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Could not open the walkthrough. Open "Getting Started" and select AgentSync.'
      )
    }
  } else if (choice === 'Open Web Docs') {
    const opened = await openAgentSyncDocs(context)
    if (!opened) {
      vscode.window.showWarningMessage('AgentSync: Could not open the documentation URL.')
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

async function openConfigFile() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const configPath = getConfigPath(workspaceFolder)
  if (!fs.existsSync(configPath)) {
    writeConfigFile(workspaceFolder, readAgentSyncConfig(workspaceFolder))
  }
  const doc = await vscode.workspace.openTextDocument(configPath)
  await vscode.window.showTextDocument(doc)
}

/**
 * Show a compact handoff summary and open the handoff store file.
 * @returns {Promise<void>}
 */
async function listHandoffsCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }
  ensureHandoffsFile(workspaceFolder)
  const handoffs = utils.listHandoffRecords(workspaceFolder)
  const openCount = handoffs.filter((h) => utils.isOpenHandoff(h)).length
  const detail = [
    `Total handoffs: ${handoffs.length}`,
    `Open handoffs: ${openCount}`,
    `Queued: ${handoffs.filter((h) => String(h?.status || '').toLowerCase() === 'queued').length}`,
    `In progress: ${handoffs.filter((h) => String(h?.status || '').toLowerCase() === 'in_progress').length}`
  ].join('\n')
  vscode.window.showInformationMessage('AgentSync Handoffs', { modal: true, detail })
  const handoffsPath = getHandoffsPath(workspaceFolder)
  const doc = await vscode.workspace.openTextDocument(handoffsPath)
  await vscode.window.showTextDocument(doc)
}

/**
 * Claim a queued handoff from the command palette.
 * @returns {Promise<void>}
 */
async function claimHandoffCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }
  const state = readStateFile(workspaceFolder) || {}
  const defaultAgent =
    toSingleLine(state?.activeSession?.agent) || toSingleLine(state?.lastSession?.agent) || 'Codex'
  const agent = await promptForAgent(defaultAgent)
  if (!agent) return

  const queued = utils
    .listHandoffRecords(workspaceFolder)
    .filter((h) => String(h?.status || '').toLowerCase() === 'queued')
  if (queued.length === 0) {
    vscode.window.showInformationMessage('AgentSync: No queued handoffs to claim.')
    return
  }

  const picks = queued.map((h) => ({
    label: toSingleLine(h?.handoff_id) || 'unknown',
    description: toSingleLine(h?.summary) || 'No summary',
    detail: `from ${toSingleLine(h?.from_agent) || 'unknown'} -> ${(h?.to_agents || []).join(', ') || 'any'}`
  }))
  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select a queued handoff to claim',
    ignoreFocusOut: true
  })
  if (!selected) return

  const result = claimHandoffRecord(workspaceFolder, selected.label, agent)
  if (!result.ok) {
    vscode.window.showWarningMessage(
      `AgentSync: Could not claim ${selected.label} (${result.reason || 'unknown reason'}).`
    )
    return
  }
  syncTrackerHandoffsSection(workspaceFolder)
  vscode.window.showInformationMessage(`AgentSync: Claimed handoff ${selected.label}.`)

  // Show agent personality context if the handoff has one
  const handoffRecord = utils
    .listHandoffRecords(workspaceFolder)
    .find((h) => toSingleLine(h?.handoff_id) === selected.label)
  const personalityId =
    handoffRecord?.agent_personality_id || handoffRecord?.suggested_agent_personality_id
  if (personalityId) {
    try {
      const catalog = getAgentCatalog(workspaceFolder)
      const agent = catalog?.agents?.find((a) => a.id === personalityId)
      if (agent) {
        const activateChoice = await vscode.window.showInformationMessage(
          'This handoff suggests agent personality: ' + agent.name + '. Activate it?',
          'Activate',
          'View',
          'Skip'
        )
        if (activateChoice === 'Activate') {
          injectPersonalityToWorkspace(workspaceFolder.uri.fsPath, agent)
          vscode.window.showInformationMessage(
            'AgentSync: Agent personality ' + agent.name + ' activated.'
          )
        } else if (activateChoice === 'View') {
          const doc = await vscode.workspace.openTextDocument({
            content: '# ' + agent.name + '\n\n' + agent.promptBody,
            language: 'markdown'
          })
          await vscode.window.showTextDocument(doc, { preview: true })
        }
      }
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Mark an existing handoff as complete/transitioned.
 * @returns {Promise<void>}
 */
async function completeHandoffCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }
  const state = readStateFile(workspaceFolder) || {}
  const defaultAgent =
    toSingleLine(state?.activeSession?.agent) || toSingleLine(state?.lastSession?.agent) || 'Codex'
  const agent = await promptForAgent(defaultAgent)
  if (!agent) return

  const candidates = utils
    .listHandoffRecords(workspaceFolder)
    .filter((h) => OPEN_HANDOFF_STATUSES.has(String(h?.status || '').toLowerCase()))
  if (candidates.length === 0) {
    vscode.window.showInformationMessage('AgentSync: No open handoffs to complete.')
    return
  }

  const selected = await vscode.window.showQuickPick(
    candidates.map((h) => ({
      label: toSingleLine(h?.handoff_id) || 'unknown',
      description: `${toSingleLine(h?.status) || 'queued'} | ${toSingleLine(h?.summary) || 'No summary'}`
    })),
    {
      placeHolder: 'Select a handoff to transition',
      ignoreFocusOut: true
    }
  )
  if (!selected) return

  const statusPick = await vscode.window.showQuickPick(
    [
      { label: 'merged', description: 'Mark as merged' },
      { label: 'approved', description: 'Mark as approved' },
      { label: 'ready_for_review', description: 'Mark as ready for review' },
      { label: 'blocked', description: 'Mark as blocked' },
      { label: 'escalated', description: 'Mark as escalated' }
    ],
    {
      placeHolder: 'Select resulting status',
      ignoreFocusOut: true
    }
  )
  if (!statusPick) return

  const reasonInput = await vscode.window.showInputBox({
    prompt: 'Transition reason (optional)',
    placeHolder: 'Example: CI green, merged via PR #123'
  })
  if (reasonInput === undefined) return

  const result = utils.completeHandoffRecord(
    workspaceFolder,
    selected.label,
    statusPick.label,
    agent,
    reasonInput
  )
  if (!result.ok) {
    vscode.window.showErrorMessage(
      `AgentSync: Could not complete ${selected.label} (${result.reason || 'unknown reason'}).`
    )
    return
  }
  vscode.window.showInformationMessage(
    `AgentSync: Handoff ${selected.label} moved to ${statusPick.label}.`
  )
}

/**
 * Generate a context capsule JSON for downstream agents.
 * @returns {Promise<void>}
 */
async function contextCapsuleCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }
  const capsule = generateContextCapsule(workspaceFolder)
  const capsulePath = getContextCapsulePath(workspaceFolder)
  const openChoice = await vscode.window.showInformationMessage(
    `AgentSync: Context capsule generated (${capsule.handoffs.openCount} open handoff(s)).`,
    'Open Capsule',
    'Dismiss'
  )
  if (openChoice === 'Open Capsule') {
    const doc = await vscode.workspace.openTextDocument(capsulePath)
    await vscode.window.showTextDocument(doc)
  }
}

/**
 * Sync .agencysync runs/events into AgentSync handoffs.
 * @param {{ silent?: boolean }} [options]
 * @returns {Promise<{ synced:number, created:number, updated:number, errors:string[] } | null>}
 */
async function syncAgencyRunsCommand(options = {}) {
  const workspaceFolder =
    options.workspaceFolder || (await resolveWorkspaceFolder({ allowPick: true }))
  if (!workspaceFolder) {
    if (!options.silent) vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return null
  }
  const result = syncAgencyRunsCore(workspaceFolder)
  if (!options.silent) {
    const errorSuffix = result.errors.length > 0 ? ` (${result.errors.length} error(s))` : ''
    vscode.window.showInformationMessage(
      `AgentSync: Agency sync complete. ${result.synced} candidate(s), ${result.created} created, ${result.updated} updated${errorSuffix}.`
    )
  }
  return result
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

  const result = SessionManager.clearActiveSessionCore(workspaceFolder)
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
async function startSession(context, options = {}) {
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
  const config = readAgentSyncConfig(workspaceFolder)
  if (!config.userProfile || !config.userProfile.role) {
    const role = await promptForRole()
    if (role) applyRolePreset(workspaceFolder, role)
    // reload config after applying preset
    Object.assign(config, readAgentSyncConfig(workspaceFolder))
  }
  const zeroTouchCfg = config.automation?.startSessionZeroTouch || DEFAULT_START_SESSION_ZERO_TOUCH
  const zeroTouchEnabled = zeroTouchCfg.enabled === true

  let goalPreFill = options.goalPreFill || ''
  let agentPreFill = options.agentPreFill || ''
  let claimedHandoff = null

  if (zeroTouchEnabled) {
    // Detect most-likely agent from current state or tracker
    const currentState = readStateFile(workspaceFolder) || {}
    agentPreFill = agentPreFill || currentState?.lastSession?.agent || tracker.agent || ''

    if (agentPreFill) {
      const candidate = findClaimableHandoff(workspaceFolder, agentPreFill)
      if (candidate) {
        if (zeroTouchCfg.autoClaimHandoff) {
          // Fully auto: claim immediately without prompting
          const claimResult = claimHandoffRecord(
            workspaceFolder,
            toSingleLine(candidate.handoff_id),
            agentPreFill
          )
          if (claimResult.ok) syncTrackerHandoffsSection(workspaceFolder)
          goalPreFill = goalPreFill || toSingleLine(candidate.summary)
          claimedHandoff = candidate
          vscode.window.showInformationMessage(
            `AgentSync: Picked up handoff ${candidate.handoff_id}: ${toSingleLine(candidate.summary)}`
          )
        } else if (zeroTouchCfg.promptPreFill) {
          // Semi-auto: pre-fill goal for user confirmation, claim after user accepts
          goalPreFill = goalPreFill || toSingleLine(candidate.summary)
          claimedHandoff = candidate
        }
      }
    }
  }

  const agent = await promptForAgent(agentPreFill || tracker.agent)
  if (!agent) return

  const goal = await vscode.window.showInputBox({
    prompt: 'What are you working on this session?',
    placeHolder: 'Example: Implement auth callback retries',
    value: goalPreFill
  })
  if (goal === undefined) return

  // If user confirmed with a pre-filled handoff (semi-auto), claim it now
  if (zeroTouchEnabled && !zeroTouchCfg.autoClaimHandoff && claimedHandoff) {
    const claimResult = claimHandoffRecord(
      workspaceFolder,
      toSingleLine(claimedHandoff.handoff_id),
      agent
    )
    if (claimResult.ok) {
      syncTrackerHandoffsSection(workspaceFolder)
      vscode.window.showInformationMessage(
        `AgentSync: Claimed handoff ${claimedHandoff.handoff_id}: ${toSingleLine(claimedHandoff.summary)}`
      )
    }
  }

  try {
    const personality = claimedHandoff
      ? resolveHandoffPersonality(workspaceFolder, claimedHandoff)
      : null
    SessionManager.startSessionCore(workspaceFolder, agent, goal, {
      providerId: getExecutionProviderId(agent),
      providerLabel: getExecutionProviderLabel(agent),
      personalityId: personality?.id || utils.getHandoffPersonalityId(claimedHandoff) || null,
      personalityName:
        personality?.name ||
        getPersonalityDisplayName(workspaceFolder, utils.getHandoffPersonalityId(claimedHandoff)) ||
        null
    })
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
  const config = readAgentSyncConfig(workspaceFolder)
  const zeroTouchCfg = config.automation?.endSessionZeroTouch || DEFAULT_END_SESSION_ZERO_TOUCH
  const zeroTouchEnabled = zeroTouchCfg.enabled === true

  let agent = ''
  let summary = ''
  let nextWork = ''
  let handoffData = null
  let summarySource = 'user'
  let automationUsed = false
  let automationContext = null
  let goalHint = null
  let precomputedHotFiles = null
  let precomputedHealth = null
  let precomputedHealthOutputs = null

  if (zeroTouchEnabled) {
    const state = readStateFile(workspaceFolder) || {}
    const activeSessionAgent =
      state?.sessionActive && toSingleLine(state?.activeSession?.agent)
        ? toSingleLine(state.activeSession.agent)
        : ''

    if (activeSessionAgent) {
      agent = activeSessionAgent
    } else {
      agent = await promptForAgent(parsed.agent)
      if (!agent) return
    }

    goalHint = toSingleLine(state?.activeSession?.goal || '') || null
    precomputedHotFiles = getHotFilesCached(workspaceFolder, { force: true })
    const checks = await runHealthChecks(workspaceFolder)
    precomputedHealth = checks.results
    precomputedHealthOutputs = checks.outputs

    const generatedSummary = buildDeterministicSessionSummary({
      goal: goalHint || '',
      hotFiles: precomputedHotFiles,
      health: precomputedHealth,
      maxSummaryLength: zeroTouchCfg.maxSummaryLength
    })

    const summaryInput = await vscode.window.showInputBox({
      prompt: 'One-line session summary (auto-generated; edit if needed)',
      value: generatedSummary,
      ignoreFocusOut: true
    })
    if (summaryInput === undefined) return

    summary = toSingleLine(summaryInput) || generatedSummary
    summarySource = summary === generatedSummary ? 'deterministic' : 'user'
    automationUsed = true

    if (precomputedHotFiles.length > 0) {
      const route = resolveAutomationRoute(config, agent)
      if (route) {
        automationContext = 'default:' + canonicalAgentId(agent)
        handoffData = {
          summary,
          notes: buildAutomationHandoffNotes({
            summary,
            hotFiles: precomputedHotFiles,
            health: precomputedHealth,
            sourceAgent: agent
          }),
          owner_mode: route.owner_mode,
          to_agents: route.to_agents,
          required_capabilities: route.required_capabilities,
          no_handoff_reason: null,
          automation_context: automationContext
        }
      } else {
        const fallback = await promptAutomationFallbackRouting(precomputedHotFiles.length)
        if (!fallback) return
        handoffData = fallback.handoffData
        automationContext = fallback.automationContext || null

        if (!handoffData.no_handoff_reason) {
          handoffData.summary = summary
          handoffData.notes = buildAutomationHandoffNotes({
            summary,
            hotFiles: precomputedHotFiles,
            health: precomputedHealth,
            sourceAgent: agent
          })
          handoffData.automation_context = automationContext
        }
      }
    }
  } else {
    agent = await promptForAgent(parsed.agent)
    if (!agent) return

    const summaryInput = await vscode.window.showInputBox({
      prompt: 'One-line session summary',
      placeHolder: 'Example: Added queue retry logic and fixed race condition'
    })
    if (summaryInput === undefined) return
    summary = summaryInput

    const nextWorkInput = await vscode.window.showInputBox({
      prompt: 'Suggested next work (optional)',
      placeHolder: 'Leave empty to keep existing notes'
    })
    if (nextWorkInput === undefined) return
    nextWork = nextWorkInput

    // Detect hot files early so we can offer handoff prompts
    const hotFiles = getHotFilesCached(workspaceFolder, { force: true })
    if (hotFiles.length > 0) {
      const modeChoice = await vscode.window.showQuickPick(
        [
          { label: 'Single owner', description: 'Hand off to one agent', value: 'single' },
          {
            label: 'Shared owners',
            description: 'Two agents co-own the next step',
            value: 'shared'
          },
          {
            label: 'Auto-route',
            description: 'System picks owner(s) from capabilities',
            value: 'auto'
          },
          {
            label: 'Skip (enter reason)',
            description: 'No handoff - record reason instead',
            value: 'skip'
          }
        ],
        {
          placeHolder: hotFiles.length + ' hot file(s) detected. Add a handoff note?',
          ignoreFocusOut: true
        }
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
              const parts = (v || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
              return parts.length === 2 ? null : 'Enter exactly 2 agent names separated by a comma'
            }
          })
          if (toInput === undefined) return
          toAgents = toInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        } else if (modeChoice.value === 'auto') {
          const capsInput = await vscode.window.showInputBox({
            prompt: 'Required capabilities, comma-separated (e.g. policy_review, pr_review)',
            placeHolder: 'policy_review, pr_review',
            ignoreFocusOut: true,
            validateInput: (v) => {
              const parts = (v || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
              return parts.length > 0 ? null : 'Enter at least one capability'
            }
          })
          if (capsInput === undefined) return
          requiredCapabilities = capsInput
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
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
  }

  let result
  try {
    // M1/C4: endSessionCore is async (non-blocking health checks)
    result = await SessionManager.endSessionCore(
      workspaceFolder,
      agent,
      summary,
      nextWork,
      handoffData,
      {
        hotFiles: precomputedHotFiles,
        healthResults: precomputedHealth,
        healthOutputs: precomputedHealthOutputs,
        summarySource,
        automationUsed,
        automationContext,
        goalHint
      }
    )
  } catch (err) {
    vscode.window.showErrorMessage('AgentSync: ' + err.message)
    return
  }

  let promptCopiedToClipboard = false
  if (
    zeroTouchEnabled &&
    zeroTouchCfg.copyPromptToClipboard &&
    Array.isArray(result.handoffPrompts) &&
    result.handoffPrompts.length > 0
  ) {
    try {
      promptCopiedToClipboard = await copyHandoffPromptToClipboard(result.handoffPrompts)
      if (promptCopiedToClipboard && result.handoff?.handoff_id) {
        updateHandoffPromptCopiedFlag(workspaceFolder, result.handoff.handoff_id, true)
      }
    } catch {
      promptCopiedToClipboard = false
    }
  }

  await openTrackerDocument(workspaceFolder)

  const failedChecks = Object.values(result.health || {}).filter(
    (status) => status === 'Fail'
  ).length
  const handoffMsg = result.handoff
    ? result.handoff.no_handoff_reason
      ? ' Handoff skipped (reason recorded).'
      : ' Handoff note created.'
    : ''

  let summaryMessage =
    failedChecks > 0
      ? 'AgentSync: Session ended. ' + failedChecks + ' health check(s) failed.' + handoffMsg
      : 'AgentSync: Session ended and tracker updated.' + handoffMsg

  // show capability/model recommendation if available
  if (result && result.complexityInfo) {
    const info = result.complexityInfo
    const caps = info.capabilities.length > 0 ? info.capabilities.join(', ') : 'general work'
    const tierLabel = info.tier === 'lead' ? 'lead-tier' : 'worker-tier'
    vscode.window.showInformationMessage(
      `Next task needs ${caps} — suggest a ${tierLabel} model (${info.reason}).`
    )
  }

  if (zeroTouchEnabled) {
    const summarySourceMsg =
      result.summarySource === 'deterministic'
        ? ' Summary auto-generated.'
        : ' Summary confirmed/edited.'
    const promptMsg =
      Array.isArray(result.handoffPrompts) && result.handoffPrompts.length > 0
        ? promptCopiedToClipboard
          ? ' Handoff prompt copied to clipboard.'
          : ' Handoff prompt generated (not copied).'
        : ''
    summaryMessage += summarySourceMsg + promptMsg
  }

  vscode.window.showInformationMessage(summaryMessage)
}
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
  )
    return 'bun'
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
    `AgentSync: Detected scripts in "${workspaceFolder.name}" â€” ${detectedList}. Populate .agentsync.json?`,
    'Yes',
    'Skip'
  )
  if (choice !== 'Yes') return false

  const existing = readAgentSyncConfig(workspaceFolder)
  const updated = { ...existing, commands: { ...existing.commands, ...detected } }
  try {
    writeConfigFile(workspaceFolder, updated)
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
    // M5: use strict ISO parser
    const ageMs = Date.now() - (parseISODate(startedAt) || Date.now())
    const ageHours = Math.floor(ageMs / (60 * 60 * 1000))
    const ageLabel = ageHours >= 1 ? `${ageHours}h ago` : 'recently'
    const goalLabel = goal ? ` â€” "${goal}"` : ''

    const choice = await vscode.window.showInformationMessage(
      `AgentSync: ${agent} has an active session in "${folder.name}" (started ${ageLabel}${goalLabel}).`,
      'Continue',
      'End Session'
    )

    if (choice === 'End Session') {
      // H3: catch so an unexpected executeCommand failure doesn't become an unhandled rejection
      await vscode.commands.executeCommand('agentsync.endSession').catch((err) => {
        console.error('[AgentSync] checkSessionOnStartup executeCommand error:', err)
      })
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

      // M5: use strict ISO parser
      const started = parseISODate(state.activeSession.startedAt)
      if (!Number.isFinite(started)) continue
      const ageMs = Date.now() - started
      const ageHours = ageMs / (60 * 60 * 1000)
      if (ageHours < reminderHours) continue

      reminded.add(sessionKey)

      const ageLabel = Math.floor(ageHours) + 'h'
      vscode.window
        .showWarningMessage(
          `AgentSync: ${getSessionProviderInfo(state.activeSession || null).label}'s session in "${folder.name}" has been running for ${ageLabel}. Time to wrap up?`,
          'End Session',
          'Dismiss'
        )
        .then((choice) => {
          if (choice === 'End Session') {
            // H3: catch so rejection from executeCommand doesn't become unhandled
            vscode.commands.executeCommand('agentsync.endSession').catch((err) => {
              console.error('[AgentSync] reminder timer executeCommand error:', err)
            })
          }
        })
    }
  }, CHECK_INTERVAL_MS)

  context.subscriptions.push({ dispose: () => clearInterval(timer) })
}

// â”€â”€â”€ Extension lifecycle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Provides file decorations (badge + color) for hot files tracked in state.json.
 * Implements vscode.FileDecorationProvider.
 */
class AgentSyncHotFileDecorationProvider {
  constructor() {
    this._emitter = new vscode.EventEmitter()
    this.onDidChangeFileDecorations = this._emitter.event
    /** @type {Set<string>} absolute fsPaths of hot files */
    this._hotFilePaths = new Set()
    /** @type {Map<string, string>} fsPath -> last agent label */
    this._agentByPath = new Map()
  }

  /**
   * @param {vscode.WorkspaceFolder} workspaceFolder
   * @param {string[]} hotFiles workspace-relative paths
   * @param {string} lastAgent agent label for tooltip
   */
  update(workspaceFolder, hotFiles, lastAgent) {
    this._hotFilePaths.clear()
    this._agentByPath.clear()
    const agent = String(lastAgent || 'unknown agent')
    for (const rel of hotFiles || []) {
      const abs = path.join(workspaceFolder.uri.fsPath, rel)
      this._hotFilePaths.add(abs)
      this._agentByPath.set(abs, agent)
    }
    this._emitter.fire(undefined)
  }

  clear() {
    this._hotFilePaths.clear()
    this._agentByPath.clear()
    this._emitter.fire(undefined)
  }

  /**
   * @param {vscode.Uri} uri
   * @returns {vscode.FileDecoration | undefined}
   */
  provideFileDecoration(uri) {
    const p = uri.fsPath
    if (!this._hotFilePaths.has(p)) return undefined
    const agent = this._agentByPath.get(p) || 'another agent'
    return new vscode.FileDecoration(
      '!',
      `Hot file \u2014 last modified by ${agent}. Check AgentTracker.md before editing.`,
      new vscode.ThemeColor('editorWarning.foreground')
    )
  }
}

// ━━━ Agent Catalog ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Initialize or refresh the in-memory agent catalog.
 * Loads bundled agents from templates/agents/ and optionally workspace agents.
 * @param {vscode.WorkspaceFolder | null} workspaceFolder
 */
function loadAgentCatalog(workspaceFolder) {
  const base = _extensionPath || __dirname
  const bundledDir = path.join(base, 'templates', 'agents')
  const rootDirs = [bundledDir]

  if (workspaceFolder) {
    const wsAgentsDir = path.join(workspaceFolder.uri.fsPath, '.agentsync', 'agents')
    if (fs.existsSync(wsAgentsDir)) {
      rootDirs.push(wsAgentsDir)
    }
  }

  _agentCatalog = buildCatalog({ rootDirs })
  return _agentCatalog
}

/**
 * Get the cached agent catalog, loading if needed.
 * @param {vscode.WorkspaceFolder | null} [workspaceFolder]
 * @returns {{ schemaVersion: string, agents: object[], categories: string[], lastIndexedAt: string }}
 */
function getAgentCatalog(workspaceFolder) {
  if (!_agentCatalog) loadAgentCatalog(workspaceFolder || null)
  return _agentCatalog
}

/**
 * Browse agents command -- QuickPick grouped by category.
 */
async function browseAgentsCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  const catalog = getAgentCatalog(workspaceFolder)

  if (!catalog || catalog.agents.length === 0) {
    vscode.window.showInformationMessage('AgentSync: No agents found in catalog.')
    return
  }

  const items = []
  const sortedCategories = [...catalog.categories].sort()
  for (const category of sortedCategories) {
    const categoryAgents = catalog.agents.filter((a) => a.category === category)
    if (categoryAgents.length === 0) continue

    items.push({
      label: category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      kind: vscode.QuickPickItemKind.Separator
    })

    for (const agent of categoryAgents) {
      items.push({
        label: agent.name,
        description: agent.category,
        detail: agent.description,
        agentId: agent.id
      })
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Browse agent personalities (' + catalog.agents.length + ' available)',
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true
  })
  if (!selected || !selected.agentId) return

  // Open agent prompt body in a read-only preview
  const agent = catalog.agents.find((a) => a.id === selected.agentId)
  if (!agent) return

  const doc = await vscode.workspace.openTextDocument({
    content:
      '# ' +
      agent.name +
      '\n\n**Category:** ' +
      agent.category +
      '\n**Description:** ' +
      agent.description +
      '\n**ID:** ' +
      agent.id +
      '\n\n---\n\n' +
      agent.promptBody,
    language: 'markdown'
  })
  await vscode.window.showTextDocument(doc, { preview: true })
}

/**
 * Resolve the best matching personality for a handoff.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {any} handoff
 * @returns {object | null}
 */
function resolveHandoffPersonality(workspaceFolder, handoff) {
  const catalog = getAgentCatalog(workspaceFolder)
  if (!catalog || !Array.isArray(catalog.agents) || catalog.agents.length === 0) return null

  const explicitId = utils.getHandoffPersonalityId(handoff)
  if (explicitId) {
    const direct = catalog.agents.find((agent) => canonicalAgentId(agent.id) === explicitId)
    if (direct) return direct
  }

  const matched = matchAgentsByCapabilities(catalog.agents, handoff?.required_capabilities || [])
  return matched[0] || null
}

function buildHandoffExecutionInstruction(handoff) {
  const lines = [String(handoff?.summary || 'Continue the queued work').trim()]

  if (handoff?.notes) {
    lines.push('', 'Notes:', String(handoff.notes).trim())
  }

  if (Array.isArray(handoff?.files) && handoff.files.length > 0) {
    lines.push('', 'Start with these files:')
    handoff.files.forEach((file) => lines.push('- ' + file))
  }

  if (handoff?.branch || handoff?.commit) {
    lines.push('', `Branch: ${handoff?.branch || PLACEHOLDER}`)
    lines.push(`Commit: ${handoff?.commit || PLACEHOLDER}`)
  }

  return lines.join('\n')
}

async function runHandoffStep(workspaceFolder, handoff, providerLabel, options = {}) {
  const providerId = getExecutionProviderId(providerLabel)
  const providerDisplay =
    getExecutionProviderLabel(providerLabel) || String(providerLabel || 'Unknown')
  const result = claimHandoffRecord(
    workspaceFolder,
    toSingleLine(handoff?.handoff_id),
    providerDisplay
  )
  if (!result.ok) {
    vscode.window.showWarningMessage(
      `AgentSync: Could not claim ${handoff?.handoff_id || 'handoff'} (${result.reason || 'unknown reason'}).`
    )
    return false
  }

  syncTrackerHandoffsSection(workspaceFolder)

  const personality = resolveHandoffPersonality(workspaceFolder, handoff)
  const personalityId = personality?.id || utils.getHandoffPersonalityId(handoff) || null
  const personalityName =
    personality?.name || getPersonalityDisplayName(workspaceFolder, personalityId) || null

  if (personality && !utils.getHandoffPersonalityId(handoff) && toSingleLine(handoff?.handoff_id)) {
    const store = readHandoffs(workspaceFolder)
    const next = store.handoffs.map((entry) => {
      if (toSingleLine(entry?.handoff_id) !== toSingleLine(handoff?.handoff_id)) return entry
      return {
        ...entry,
        suggested_agent_personality_id: personality.id,
        updated_at: new Date().toISOString()
      }
    })
    writeHandoffs(workspaceFolder, { version: 1, handoffs: next })
  }

  if (personality) {
    injectPersonalityToWorkspace(workspaceFolder.uri.fsPath, personality)
  }

  if (options.ensureSession) {
    SessionManager.startSessionCore(
      workspaceFolder,
      providerDisplay,
      toSingleLine(handoff?.summary),
      {
        providerId,
        providerLabel: providerDisplay,
        personalityId,
        personalityName
      }
    )
  } else {
    updateActiveSessionContext(workspaceFolder, {
      ...buildSessionIdentity(workspaceFolder, providerDisplay, {
        providerId,
        providerLabel: providerDisplay,
        personalityId,
        personalityName
      }),
      goal: toSingleLine(handoff?.summary) || 'Continue queued work'
    })
  }

  const instruction = buildHandoffExecutionInstruction(handoff)
  const assembledPrompt = personality
    ? assembleAgentPrompt(personality, instruction, { contextFiles: handoff?.files || [] })
    : ['# Task', '', instruction].join('\n')
  const delivery = await deliverPrompt('clipboard', { vscodeEnv: vscode.env }, assembledPrompt)
  updateHandoffPromptCopiedFlag(workspaceFolder, handoff?.handoff_id, delivery.ok)

  if (delivery.ok) {
    const suffix = personalityName ? ` Personality: ${personalityName}.` : ''
    vscode.window.showInformationMessage(
      `AgentSync: Next step prepared for ${providerDisplay}.${suffix} Prompt copied to clipboard.`
    )
    return true
  }

  vscode.window.showErrorMessage('AgentSync: Failed to copy the next-step prompt to clipboard.')
  return false
}

async function runNextStepCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const state = readStateFile(workspaceFolder) || {}
  const activeProvider = getSessionProviderInfo(state?.activeSession || null)
  const lastProvider = getSessionProviderInfo(state?.lastSession || null)
  const providerId = state?.sessionActive ? activeProvider.id : null
  const candidates = listRunnableQueuedHandoffs(workspaceFolder, providerId)
  if (candidates.length === 0) {
    vscode.window.showInformationMessage('AgentSync: No runnable queued handoffs found.')
    return
  }

  let handoff = candidates[0]
  if (candidates.length > 1) {
    const selection = await vscode.window.showQuickPick(
      candidates.map((item) => {
        const owners = utils.getHandoffOwners(item)
        const personalityName = getPersonalityDisplayName(
          workspaceFolder,
          utils.getHandoffPersonalityId(item)
        )
        return {
          label: toSingleLine(item?.handoff_id) || 'unknown',
          description: toSingleLine(item?.summary) || 'No summary',
          detail:
            (personalityName ? 'Personality: ' + personalityName + ' | ' : '') +
            'Owners: ' +
            (owners.length > 0 ? owners.join(', ') : 'provider-flex'),
          handoff: item
        }
      }),
      {
        placeHolder: 'Select the next runnable handoff',
        ignoreFocusOut: true
      }
    )
    if (!selection?.handoff) return
    handoff = selection.handoff
  }

  let providerLabel = activeProvider.label
  if (!state?.sessionActive) {
    const ownerDefaults = utils.getHandoffOwners(handoff)
    const defaultProvider = ownerDefaults[0] || lastProvider.label || 'Codex'
    providerLabel = await promptForAgent(defaultProvider)
    if (!providerLabel) return
  }

  await runHandoffStep(workspaceFolder, handoff, providerLabel, {
    ensureSession: !state?.sessionActive
  })
}

/**
 * Run with personality command -- select a personality, enter instruction, copy prompt to clipboard.
 */
async function runWithAgentCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  const catalog = getAgentCatalog(workspaceFolder)

  if (!catalog || catalog.agents.length === 0) {
    vscode.window.showInformationMessage('AgentSync: No agents found in catalog.')
    return
  }

  // Step 1: Select agent
  const items = catalog.agents.map((agent) => ({
    label: agent.name,
    description: agent.category,
    detail: agent.description,
    agentId: agent.id
  }))

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select an agent personality',
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true
  })
  if (!selected || !selected.agentId) return

  const agent = catalog.agents.find((a) => a.id === selected.agentId)
  if (!agent) return

  // Step 2: Enter instruction
  const instruction = await vscode.window.showInputBox({
    prompt: 'Enter your instruction for ' + agent.name,
    placeHolder: 'Example: Refactor the authentication module to use JWT tokens',
    ignoreFocusOut: true
  })
  if (instruction === undefined || !instruction.trim()) return

  // Step 3: Assemble and deliver prompt
  const assembledPrompt = assembleAgentPrompt(agent, instruction.trim())
  const result = await deliverPrompt('clipboard', { vscodeEnv: vscode.env }, assembledPrompt)

  if (result.ok) {
    vscode.window.showInformationMessage(
      'AgentSync: Personality prompt copied to clipboard \u2014 paste into your AI tool. Personality: ' +
        agent.name
    )
  } else {
    vscode.window.showErrorMessage('AgentSync: Failed to copy the personality prompt to clipboard.')
  }
}

/**
 * Create a pipeline (chain) of agents for sequential execution.
 */
async function createPipelineCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const catalog = getAgentCatalog(workspaceFolder)
  if (!catalog || catalog.agents.length === 0) {
    vscode.window.showInformationMessage('AgentSync: No agents found in catalog.')
    return
  }

  // Step 1: Enter pipeline goal
  const goalInput = await vscode.window.showInputBox({
    prompt: 'Enter the pipeline goal / instruction',
    placeHolder: 'Example: Design, implement, and test a new REST endpoint',
    ignoreFocusOut: true
  })
  if (goalInput === undefined || !goalInput.trim()) return
  const goal = goalInput.trim()

  // Step 2: Select agents in sequence
  const selectedAgents = []
  let pipelineBuilding = true
  while (pipelineBuilding) {
    const agentItems = [
      { label: '$(check) Done', description: 'Finish building the pipeline', agentId: null },
      ...catalog.agents.map((agent) => ({
        label: agent.name,
        description: agent.category + (selectedAgents.length > 0 ? '' : ' (first step)'),
        detail: agent.description,
        agentId: agent.id
      }))
    ]

    const stepLabel =
      selectedAgents.length === 0
        ? 'Select the first personality in the pipeline'
        : 'Select step ' +
          (selectedAgents.length + 1) +
          ' (or Done to finish). Current: ' +
          selectedAgents.map((a) => a.name).join(' -> ')

    const pick = await vscode.window.showQuickPick(agentItems, {
      placeHolder: stepLabel,
      matchOnDescription: true,
      matchOnDetail: true,
      ignoreFocusOut: true
    })
    if (!pick) return // cancelled

    if (!pick.agentId) {
      if (selectedAgents.length < 2) {
        vscode.window.showWarningMessage('AgentSync: Pipeline needs at least 2 agents.')
        continue
      }
      pipelineBuilding = false
      continue
    }

    const agent = catalog.agents.find((a) => a.id === pick.agentId)
    if (agent) selectedAgents.push(agent)
  }

  // Step 3: Create linked handoff chain
  const store = readHandoffs(workspaceFolder)
  const allHandoffs = store.handoffs
  const now = new Date().toISOString()
  const chainId =
    'CHAIN-' + now.slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 8)

  const state = readStateFile(workspaceFolder) || {}
  const currentAgent = canonicalAgentId(
    state?.activeSession?.agent || state?.lastSession?.agent || 'user'
  )

  const chainHandoffs = selectedAgents.map((agent, index) => {
    const dateStr = now.slice(0, 10).replace(/-/g, '')
    const seq = String(allHandoffs.length + index + 1).padStart(3, '0')
    const handoffId = 'HO-' + dateStr + '-' + seq

    const isFirst = index === 0
    const isLast = index === selectedAgents.length - 1
    const nextAgent = isLast ? null : selectedAgents[index + 1]

    return {
      handoff_id: handoffId,
      task_id: null,
      from_agent: isFirst ? currentAgent : selectedAgents[index - 1].id,
      to_agents: [],
      owner_mode: 'auto',
      status: isFirst ? 'queued' : 'blocked',
      required_capabilities: mapAgentToCapabilities(agent),
      summary: 'Pipeline step ' + (index + 1) + '/' + selectedAgents.length + ': ' + goal,
      notes: 'Personality: ' + agent.name + ' (' + agent.category + ')',
      no_handoff_reason: null,
      files: [],
      branch: runGit(workspaceFolder, ['rev-parse', '--abbrev-ref', 'HEAD']) || PLACEHOLDER,
      commit: runGit(workspaceFolder, ['rev-parse', '--short', 'HEAD']) || PLACEHOLDER,
      prior_attempts: 0,
      agent_personality_id: agent.id,
      chain_id: chainId,
      chain_step: index + 1,
      chain_total: selectedAgents.length,
      next_chain_agent_id: nextAgent ? nextAgent.id : null,
      created_at: now,
      updated_at: now,
      state_history: [
        {
          status: isFirst ? 'queued' : 'blocked',
          agent: currentAgent,
          timestamp: now,
          reason: 'pipeline created'
        }
      ]
    }
  })

  // Validate each handoff
  for (const handoff of chainHandoffs) {
    const { valid, errors } = validateHandoff(handoff)
    if (!valid) {
      vscode.window.showErrorMessage('AgentSync: Invalid pipeline handoff: ' + errors.join('; '))
      return
    }
  }

  const updatedHandoffs = [...allHandoffs, ...chainHandoffs]
  writeHandoffs(workspaceFolder, { version: 1, handoffs: updatedHandoffs })
  syncTrackerHandoffsSection(workspaceFolder)

  vscode.window.showInformationMessage(
    'AgentSync: Pipeline created with ' + selectedAgents.length + ' steps. Chain ID: ' + chainId
  )
}

/**
 * When a chain handoff is completed, auto-advance the next step.
 * Call this after completeHandoffRecord.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} completedHandoffId
 */

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  _extensionPath = context.extensionPath
  // â”€â”€ Status bar â”€â”€
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  statusItem.command = 'agentsync.openDashboard'
  updateStatusBar(statusItem)

  // ── Agent Catalog initialization ──
  try {
    const wsFolder = getActiveWorkspaceFolder()
    loadAgentCatalog(wsFolder)
  } catch {
    // Non-fatal -- catalog will be loaded on first use
  }

  const dashboardProvider = new AgentSyncDashboardViewProvider(context)
  const dashboardView = vscode.window.registerWebviewViewProvider(
    'agentsync.dashboard',
    dashboardProvider,
    {
      webviewOptions: { retainContextWhenHidden: true }
    }
  )

  // â”€â”€ Tree view â”€â”€
  const treeProvider = new AgentSyncTreeDataProvider()
  const treeView = vscode.window.createTreeView('agentsync.panel', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  })

  // ── Hot file decoration provider ──
  const hotFileDecorationProvider = new AgentSyncHotFileDecorationProvider()
  const decorationProviderDisposable =
    vscode.window.registerFileDecorationProvider(hotFileDecorationProvider)

  const refreshHotFileDecorations = () => {
    const folder = getActiveWorkspaceFolder()
    if (!folder) {
      hotFileDecorationProvider.clear()
      return
    }
    const snapshot = getWorkspaceSnapshot(folder)
    const state = snapshot.state
    const hotFiles = Array.isArray(state?.hotFiles) ? state.hotFiles : []
    if (hotFiles.length > 0) {
      const agent = state?.activeSession?.agent || state?.lastSession?.agent || 'unknown'
      hotFileDecorationProvider.update(folder, hotFiles, agent)
    } else {
      hotFileDecorationProvider.clear()
    }
  }

  const refresh = () => {
    updateStatusBar(statusItem)
    treeProvider.refresh()
    dashboardProvider.refresh()
    refreshHotFileDecorations()
  }

  let refreshTimer = null
  let refreshInFlight = false
  let refreshQueued = false

  const runRefresh = () => {
    if (refreshInFlight) {
      refreshQueued = true
      return
    }
    refreshInFlight = true
    try {
      refresh()
    } finally {
      refreshInFlight = false
      if (refreshQueued) {
        refreshQueued = false
        setTimeout(runRefresh, 0)
      }
    }
  }

  const scheduleRefresh = (workspaceFolder = null, delayMs = 120) => {
    if (workspaceFolder) invalidateWorkspaceCaches(workspaceFolder)
    else invalidateWorkspaceCaches(null)
    if (refreshTimer) clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => {
      refreshTimer = null
      runRefresh()
    }, delayMs)
  }

  const metricDebounceTimers = new Map()
  const queueSessionMetricFileChange = (workspaceFolder, changedPath) => {
    if (!workspaceFolder || !changedPath) return
    const rootPath = workspaceFolder.uri.fsPath
    const relPath = normalizeRepoRelativePath(path.relative(rootPath, changedPath))
    if (!relPath || relPath.startsWith('..') || relPath.includes('.agentsync/')) return

    const timerKey = `${rootPath}::${relPath.toLowerCase()}`
    const existingTimer = metricDebounceTimers.get(timerKey)
    if (existingTimer) clearTimeout(existingTimer)

    const timer = setTimeout(() => {
      metricDebounceTimers.delete(timerKey)
      const state = readStateFile(workspaceFolder)
      if (!state?.sessionActive || !state?.sessionMetrics) return
      state.sessionMetrics.filesModified = (state.sessionMetrics.filesModified || 0) + 1
      writeStateFile(workspaceFolder, state)
    }, 350)

    metricDebounceTimers.set(timerKey, timer)
  }

  // â”€â”€ File watchers â”€â”€
  const trackerWatcher = vscode.workspace.createFileSystemWatcher('**/AgentTracker.md')
  trackerWatcher.onDidChange((uri) => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
    if (workspaceFolder) queueSessionMetricFileChange(workspaceFolder, uri.fsPath)
    scheduleRefresh(workspaceFolder)
  })
  trackerWatcher.onDidCreate((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))
  trackerWatcher.onDidDelete((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))

  const configWatcher = vscode.workspace.createFileSystemWatcher('**/.agentsync.json')
  configWatcher.onDidChange((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))
  configWatcher.onDidCreate((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))
  configWatcher.onDidDelete((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))

  const handoffsWatcher = vscode.workspace.createFileSystemWatcher('**/.agentsync/handoffs.json')
  handoffsWatcher.onDidChange((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))
  handoffsWatcher.onDidCreate((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))
  handoffsWatcher.onDidDelete((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))

  // state.json is written after AgentTracker.md on session changes, but the
  // drop-zone API writes it independently â€” watch it to keep the panel live.
  const stateWatcher = vscode.workspace.createFileSystemWatcher('**/.agentsync/state.json')
  stateWatcher.onDidChange((uri) => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri)
    if (workspaceFolder) queueSessionMetricFileChange(workspaceFolder, uri.fsPath)
    scheduleRefresh(workspaceFolder)
  })
  stateWatcher.onDidCreate((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)))

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

  const agencySyncTimers = new Map()
  const queueAgencySync = (workspaceFolder) => {
    if (!workspaceFolder) return
    const key = workspaceFolder.uri.fsPath
    const existingTimer = agencySyncTimers.get(key)
    if (existingTimer) clearTimeout(existingTimer)
    const timer = setTimeout(async () => {
      agencySyncTimers.delete(key)
      await syncAgencyRunsCommand({ workspaceFolder, silent: true })
      scheduleRefresh(workspaceFolder)
    }, 500)
    agencySyncTimers.set(key, timer)
  }

  const agencyEventsWatcher = vscode.workspace.createFileSystemWatcher(
    '**/.agencysync/events/**/*.json'
  )
  agencyEventsWatcher.onDidChange((uri) =>
    queueAgencySync(vscode.workspace.getWorkspaceFolder(uri))
  )
  agencyEventsWatcher.onDidCreate((uri) =>
    queueAgencySync(vscode.workspace.getWorkspaceFolder(uri))
  )
  agencyEventsWatcher.onDidDelete((uri) =>
    queueAgencySync(vscode.workspace.getWorkspaceFolder(uri))
  )

  const agencyRunsWatcher = vscode.workspace.createFileSystemWatcher('**/.agencysync/runs.json')
  agencyRunsWatcher.onDidChange((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)))
  agencyRunsWatcher.onDidCreate((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)))
  agencyRunsWatcher.onDidDelete((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)))

  // Refresh the panel when the active editor changes (workspace folder may differ)
  const onEditorChange = vscode.window.onDidChangeActiveTextEditor(() => scheduleRefresh())
  const onWorkspaceChange = vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleRefresh())

  // Warn when a hot file is opened during an active session
  const onOpenDoc = vscode.workspace.onDidOpenTextDocument((doc) => {
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri)
    if (!folder) return
    const state = getWorkspaceSnapshot(folder).state
    if (!state?.sessionActive) return
    const hotFiles = Array.isArray(state?.hotFiles) ? state.hotFiles : []
    if (hotFiles.length === 0) return
    const rel = path.relative(folder.uri.fsPath, doc.uri.fsPath).replace(/\\/g, '/')
    if (!hotFiles.includes(rel)) return
    const agent = state?.activeSession?.agent || state?.lastSession?.agent || 'another agent'
    vscode.window
      .showWarningMessage(
        `AgentSync: "${rel}" is a hot file currently being modified by ${agent}. Check AgentTracker.md before editing.`,
        'Open AgentTracker'
      )
      .then((choice) => {
        if (choice === 'Open AgentTracker') {
          vscode.commands.executeCommand('agentsync.openTracker')
        }
      })
  })

  // Tick the elapsed-time display every 60 seconds while a session is active
  const elapsedTimer = setInterval(() => {
    const folder = getActiveWorkspaceFolder()
    if (!folder) return
    const statePath = getStatePath(folder)
    if (!fs.existsSync(statePath)) return
    try {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
      if (state.sessionActive) scheduleRefresh(folder, 0)
    } catch {}
  }, 60 * 1000)

  // â”€â”€ Commands â”€â”€
  const initCmd = vscode.commands.registerCommand('agentsync.init', () => initWorkspace(context))
  const openCmd = vscode.commands.registerCommand('agentsync.openTracker', () =>
    openTracker(context)
  )
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
        'AgentSync: Could not open the walkthrough. Open "Getting Started" and select AgentSync.'
      )
    }
  })
  const openDocsCmd = vscode.commands.registerCommand('agentsync.openDocs', async () => {
    const opened = await openAgentSyncDocs(context)
    if (!opened) {
      vscode.window.showWarningMessage('AgentSync: Could not open the documentation URL.')
    }
  })
  const openHandoffsCmd = vscode.commands.registerCommand('agentsync.openHandoffs', () =>
    openHandoffs()
  )
  const openConfigCmd = vscode.commands.registerCommand('agentsync.openConfig', () =>
    openConfigFile()
  )
  const listHandoffsCmd = vscode.commands.registerCommand('agentsync.listHandoffs', () =>
    listHandoffsCommand()
  )
  const claimHandoffCmd = vscode.commands.registerCommand('agentsync.claimHandoff', () =>
    claimHandoffCommand()
  )
  const completeHandoffCmd = vscode.commands.registerCommand('agentsync.completeHandoff', () =>
    completeHandoffCommand()
  )
  const contextCapsuleCmd = vscode.commands.registerCommand('agentsync.contextCapsule', () =>
    contextCapsuleCommand()
  )
  const syncAgencyRunsCmd = vscode.commands.registerCommand('agentsync.syncAgencyRuns', () =>
    syncAgencyRunsCommand()
  )
  const clearActiveSessionCmd = vscode.commands.registerCommand(
    'agentsync.clearActiveSession',
    () => clearActiveSession()
  )
  const startCmd = vscode.commands.registerCommand('agentsync.startSession', () =>
    startSession(context)
  )
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
  const contextStatusCmd = vscode.commands.registerCommand('agentsync.contextStatus', async () => {
    const workspaceFolder = await resolveWorkspaceFolder()
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('AgentSync: No workspace folder is open.')
      return
    }

    const snapshot = getWorkspaceSnapshot(workspaceFolder)
    const state = snapshot.state
    const handoffInfo = snapshot.handoffInfo
    const hotFiles = getHotFilesCached(workspaceFolder, { force: true })
    const inProgressLines = snapshot.inProgressLines || []

    const openHandoffs = handoffInfo.handoffs.filter((h) =>
      OPEN_HANDOFF_STATUSES.has(String(h?.status || '').toLowerCase())
    ).length

    // Estimate complexity from diff size
    const diffOutput = runGit(workspaceFolder, ['diff', '--shortstat']) || ''
    const diffMatch = diffOutput.match(
      /(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/
    )
    const filesChanged = diffMatch ? parseInt(diffMatch[1], 10) : 0
    const insertions = diffMatch && diffMatch[2] ? parseInt(diffMatch[2], 10) : 0
    const deletions = diffMatch && diffMatch[3] ? parseInt(diffMatch[3], 10) : 0
    const totalChanges = insertions + deletions

    let complexity = 'Low'
    if (totalChanges > 500 || filesChanged > 10) complexity = 'High'
    else if (totalChanges > 100 || filesChanged > 5) complexity = 'Medium'

    // Session duration
    let sessionDuration = 'No active session'
    const sessionProvider = getSessionProviderInfo(
      state?.activeSession || state?.lastSession || null
    )
    const sessionPersonality = getSessionPersonalityInfo(
      workspaceFolder,
      state?.activeSession || null
    )
    if (state?.sessionActive && state?.activeSession?.startedAt) {
      const started = parseISODate(state.activeSession.startedAt)
      if (Number.isFinite(started)) {
        sessionDuration = formatElapsed(Date.now() - started)
      }
    }

    const lines = [
      `Session: ${state?.sessionActive ? 'Active (' + sessionDuration + ')' : 'Inactive'}`,
      `Provider: ${sessionProvider.label || 'Unknown'}`,
      `Personality: ${state?.sessionActive ? sessionPersonality.name : 'None'}`,
      `Hot files: ${hotFiles.length}`,
      `In-progress items: ${inProgressLines.length}`,
      `Open handoffs: ${openHandoffs}`,
      `Diff: ${filesChanged} file(s), +${insertions} -${deletions}`,
      `Estimated complexity: ${complexity}`
    ]

    const missingHealthChecks = ['Build', 'Tests', 'Deploy'].filter((label) => {
      const entry = state?.health?.[label]
      return String(entry?.status ?? entry ?? 'Not configured') === 'Not configured'
    })
    if (missingHealthChecks.length > 0) {
      lines.push(`Setup needed: ${missingHealthChecks.join(', ')} health checks are not configured`)
    }

    if (state?.sessionMetrics) {
      lines.push(`Files modified this session: ${state.sessionMetrics.filesModified || 0}`)
      lines.push(`Commands run: ${state.sessionMetrics.commandsRun || 0}`)
    }

    if (complexity === 'High') {
      lines.push('', 'Consider ending this session and handing off to reduce context size.')
    }

    vscode.window.showInformationMessage('AgentSync Context Status', {
      modal: true,
      detail: lines.join('\n')
    })
  })
  const setRoleCmd = vscode.commands.registerCommand('agentsync.setRole', async () => {
    const folder = await resolveWorkspaceFolder({ allowPick: true })
    if (!folder) return
    const existing = readAgentSyncConfig(folder)?.userProfile?.role || undefined
    const role = await promptForRole(existing)
    if (role) {
      applyRolePreset(folder, role)
      vscode.window.showInformationMessage(`AgentSync: role set to ${role.replace(/_/g, ' ')}`)
    }
  })

  const refreshCmd = vscode.commands.registerCommand('agentsync.refreshPanel', () => {
    scheduleRefresh()
  })

  // ── Agent Catalog commands ──
  const browseAgentsCmd = vscode.commands.registerCommand('agentsync.browseAgents', () =>
    browseAgentsCommand()
  )
  const runNextStepCmd = vscode.commands.registerCommand('agentsync.runNextStep', () =>
    runNextStepCommand()
  )
  const runWithAgentCmd = vscode.commands.registerCommand('agentsync.runWithAgent', () =>
    runWithAgentCommand()
  )
  const createPipelineCmd = vscode.commands.registerCommand('agentsync.createPipeline', () =>
    createPipelineCommand()
  )

  // â”€â”€ Startup automation â”€â”€
  setTimeout(() => checkSessionOnStartup(context), 3000)
  startSessionReminderTimer(context)

  context.subscriptions.push(
    statusItem,
    dashboardView,
    treeView,
    decorationProviderDisposable,
    trackerWatcher,
    configWatcher,
    handoffsWatcher,
    stateWatcher,
    requestWatcher,
    agencyEventsWatcher,
    agencyRunsWatcher,
    onEditorChange,
    onWorkspaceChange,
    onOpenDoc,
    {
      dispose: () => {
        for (const timer of metricDebounceTimers.values()) {
          clearTimeout(timer)
        }
        metricDebounceTimers.clear()
      }
    },
    {
      dispose: () => {
        if (refreshTimer) clearTimeout(refreshTimer)
      }
    },
    {
      dispose: () => {
        for (const timer of agencySyncTimers.values()) {
          clearTimeout(timer)
        }
        agencySyncTimers.clear()
      }
    },
    { dispose: () => clearInterval(elapsedTimer) },
    initCmd,
    openCmd,
    openDashboardCmd,
    openPanelCmd,
    openTutorialCmd,
    openDocsCmd,
    openHandoffsCmd,
    openConfigCmd,
    listHandoffsCmd,
    claimHandoffCmd,
    completeHandoffCmd,
    contextCapsuleCmd,
    syncAgencyRunsCmd,
    clearActiveSessionCmd,
    startCmd,
    endCmd,
    detectCmd,
    contextStatusCmd,
    setRoleCmd,
    refreshCmd,
    browseAgentsCmd,
    runNextStepCmd,
    runWithAgentCmd,
    createPipelineCmd
  )
}

function deactivate() {}

module.exports = { activate, deactivate }

// Exported only for unit testing — not part of the public extension API.
// Jest sets NODE_ENV=test automatically; VS Code does not.
if (process.env.NODE_ENV === 'test') {
  module.exports._testExports = {
    isEmptyValue,
    parseTracker,
    escapeRegExp,
    getSectionBody,
    setSectionBody,
    canonicalAgentId,
    parseISODate,
    parseCommandArgv,
    resolveHealthCheckProgram,
    validateHandoff,
    getOperationalState,
    formatElapsed,
    buildSessionIdentity,
    getSessionProviderInfo,
    getHandoffOwners,
    scoreNextTaskCapabilities,
    normalizeHandoffStatus,
    createHandoffRecord,
    claimHandoffRecord,
    completeHandoffRecord,
    listHandoffRecords,
    startSessionCore: (ws, agent, goal, opts) =>
      SessionManager.startSessionCore(ws, agent, goal, opts),
    listRunnableQueuedHandoffs,
    syncAgencyRunsCore,
    generateContextCapsule,
    processDropZoneRequest
  }
}
