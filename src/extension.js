const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

// ——— Modular utility imports ———————————————————————————————————————————
const {
  // constants
  PLACEHOLDER, DEFAULT_STALE_HOURS, OPEN_HANDOFF_STATUSES,
  DEFAULT_END_SESSION_ZERO_TOUCH, DEFAULT_START_SESSION_ZERO_TOUCH,
  DEFAULT_HANDOFF_ROUTING_DEFAULTS, ROLE_LIST,
  // paths
  getTemplatesDir, getTrackerPath, getConfigPath, getAgentSyncDir,
  getStatePath, getRequestPath, getResultPath, getHandoffsPath, getContextCapsulePath,
  // text
  isEmptyValue, escapeRegExp, parseTracker, getSectionBody, setSectionBody,
  canonicalAgentId, toSingleLine, truncateSingleLine, formatElapsed,
  // io
  atomicWriteFileSync, parseISODate, parseCommandArgv, createNonce,
  // git
  runGit, runGitExitCode, detectHotFiles, normalizeRepoRelativePath,
  scoreNextTaskCapabilities, detectSignatureChanges,
  // workspace
  getActiveWorkspaceFolder, resolveWorkspaceFolder, getWorkspaceLabelPrefix,
  // snapshot
  WorkspaceSnapshotService
} = require('./utils')

const HOT_FILES_CACHE_TTL_MS = 4000
const _hotFilesCache = new Map()
let _snapshotService = null
// ━━━ Config reader ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Read optional AgentSync configuration.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function readAgentSyncConfig(workspaceFolder) {
  const settings = vscode.workspace.getConfiguration('agentsync', workspaceFolder?.uri)
  const settingsAutoStale = Number(settings.get('autoStaleSessionMinutes', 0))
  const toNumber = (value, fallback) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  const normalizeStartSessionAutomation = (value = {}) => ({
    enabled: value.enabled === true,
    autoClaimHandoff: value.autoClaimHandoff === true,
    promptPreFill: value.promptPreFill === undefined ? true : value.promptPreFill === true
  })
  const normalizeEndSessionAutomation = (value = {}) => {
    const maxSummaryLength = Math.max(
      60,
      Math.min(
        260,
        Math.round(
          toNumber(value.maxSummaryLength, DEFAULT_END_SESSION_ZERO_TOUCH.maxSummaryLength)
        )
      )
    )
    return {
      enabled: value.enabled === true,
      autonomy:
        String(value.autonomy || DEFAULT_END_SESSION_ZERO_TOUCH.autonomy).trim() ||
        DEFAULT_END_SESSION_ZERO_TOUCH.autonomy,
      copyPromptToClipboard:
        value.copyPromptToClipboard === undefined
          ? DEFAULT_END_SESSION_ZERO_TOUCH.copyPromptToClipboard
          : value.copyPromptToClipboard === true,
      maxSummaryLength
    }
  }
  const normalizeRoute = (route = {}) => {
    const ownerMode = String(route.owner_mode || '').toLowerCase()
    const toAgents = Array.isArray(route.to_agents)
      ? route.to_agents.map((a) => canonicalAgentId(a)).filter(Boolean)
      : []
    const requiredCapabilities = Array.isArray(route.required_capabilities)
      ? route.required_capabilities.map((c) => String(c || '').trim()).filter(Boolean)
      : []
    if (ownerMode === 'single' && toAgents.length === 1) {
      return { owner_mode: ownerMode, to_agents: toAgents, required_capabilities: [] }
    }
    if (ownerMode === 'shared' && toAgents.length === 2) {
      return { owner_mode: ownerMode, to_agents: toAgents, required_capabilities: [] }
    }
    if (ownerMode === 'auto' && requiredCapabilities.length > 0) {
      return { owner_mode: ownerMode, to_agents: [], required_capabilities: requiredCapabilities }
    }
    return null
  }
  const defaultRoutes = Object.fromEntries(
    Object.entries(DEFAULT_HANDOFF_ROUTING_DEFAULTS).map(([agentId, route]) => [
      agentId,
      { ...route }
    ])
  )
  const normalizeAutomation = (automation = {}) => {
    const endSessionZeroTouch = normalizeEndSessionAutomation(automation.endSessionZeroTouch || {})
    const startSessionZeroTouch = normalizeStartSessionAutomation(
      automation.startSessionZeroTouch || {}
    )
    const configured = automation.handoffRoutingDefaults || {}
    const handoffRoutingDefaults = { ...defaultRoutes }
    if (configured && typeof configured === 'object') {
      for (const [rawAgentId, route] of Object.entries(configured)) {
        const agentId = canonicalAgentId(rawAgentId)
        if (!agentId) continue
        const normalizedRoute = normalizeRoute(route)
        if (normalizedRoute) handoffRoutingDefaults[agentId] = normalizedRoute
      }
    }
    return { endSessionZeroTouch, startSessionZeroTouch, handoffRoutingDefaults }
  }
  const DEFAULT_TOKEN_BUDGET = Object.freeze({
    maxTokensDefault: 4000,
    batchSimilarTasks: true,
    enableCaching: true,
    sessionDurationWarningMinutes: 0
  })
  const normalizeTokenBudget = (value = {}) => ({
    maxTokensDefault: toNumber(value.maxTokensDefault, DEFAULT_TOKEN_BUDGET.maxTokensDefault),
    batchSimilarTasks:
      value.batchSimilarTasks === undefined ? true : value.batchSimilarTasks === true,
    enableCaching: value.enableCaching === undefined ? true : value.enableCaching === true,
    sessionDurationWarningMinutes: Math.max(
      0,
      Math.round(
        toNumber(
          value.sessionDurationWarningMinutes,
          DEFAULT_TOKEN_BUDGET.sessionDurationWarningMinutes
        )
      )
    )
  })
  const normalizeModelTiers = (value = {}) => {
    const result = {}
    for (const [tier, def] of Object.entries(value)) {
      if (tier !== 'worker' && tier !== 'lead') continue
      result[tier] = {
        models: Array.isArray(def?.models)
          ? def.models.map((m) => String(m).trim()).filter(Boolean)
          : [],
        useCases: Array.isArray(def?.useCases)
          ? def.useCases.map((u) => String(u).trim()).filter(Boolean)
          : []
      }
    }
    return Object.keys(result).length > 0 ? result : null
  }
  const defaults = {
    staleAfterHours: DEFAULT_STALE_HOURS,
    autoStaleSessionMinutes:
      Number.isFinite(settingsAutoStale) && settingsAutoStale >= 0 ? settingsAutoStale : 0,
    commands: {},
    requireHandoffOnEndSession: false,
    automation: normalizeAutomation({}),
    modelTiers: null,
    tokenBudget: normalizeTokenBudget({}),
    userProfile: null,
    dashboardShortcuts: null,
    sessionDurationWarningMinutes: 0
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
        Number.isFinite(staleAfterHours) && staleAfterHours >= 0
          ? staleAfterHours
          : DEFAULT_STALE_HOURS,
      autoStaleSessionMinutes:
        Number.isFinite(autoStaleSessionMinutes) && autoStaleSessionMinutes >= 0
          ? autoStaleSessionMinutes
          : 0,
      commands: parsed.commands && typeof parsed.commands === 'object' ? parsed.commands : {},
      requireHandoffOnEndSession: parsed.requireHandoffOnEndSession === true,
      automation: normalizeAutomation(parsed.automation || {}),
      modelTiers: normalizeModelTiers(parsed.modelTiers || {}),
      tokenBudget: normalizeTokenBudget(parsed.tokenBudget || {}),
      userProfile:
        parsed.userProfile && typeof parsed.userProfile === 'object' ? parsed.userProfile : null,
      dashboardShortcuts: Array.isArray(parsed.dashboardShortcuts)
        ? parsed.dashboardShortcuts
        : null,
      sessionDurationWarningMinutes: toNumber(parsed.sessionDurationWarningMinutes, 0)
    }
  } catch {
    return defaults
  }
}

/**
 * Write the agentsync config file with pretty JSON.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {any} data
 */
function writeConfigFile(workspaceFolder, data) {
  const configPath = getConfigPath(workspaceFolder)
  try {
    atomicWriteFileSync(configPath, JSON.stringify(data, null, 2))
    invalidateWorkspaceCaches(workspaceFolder)
  } catch {}
}

/**
 * Read .agentsync/state.json if present.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {any | null}
 */
function readStateFile(workspaceFolder) {
  const statePath = getStatePath(workspaceFolder)
  if (!fs.existsSync(statePath)) return null
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Lazily create and return the shared workspace snapshot service.
 * @returns {WorkspaceSnapshotService}
 */
function getWorkspaceSnapshotService() {
  if (_snapshotService) return _snapshotService

  _snapshotService = new WorkspaceSnapshotService({
    readTracker,
    parseTracker,
    readStateFile,
    readConfig: readAgentSyncConfig,
    readHandoffs,
    getInProgressLines,
    placeholder: PLACEHOLDER
  })
  return _snapshotService
}

/**
 * Read a cached workspace snapshot.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {{ force?: boolean }} [options]
 */
function getWorkspaceSnapshot(workspaceFolder, options = {}) {
  return getWorkspaceSnapshotService().getSnapshot(workspaceFolder, options)
}

/**
 * Invalidate per-workspace caches.
 * @param {vscode.WorkspaceFolder | null | undefined} workspaceFolder
 */
function invalidateWorkspaceCaches(workspaceFolder) {
  if (!workspaceFolder) {
    _hotFilesCache.clear()
    getWorkspaceSnapshotService().invalidateAll()
    return
  }
  _hotFilesCache.delete(workspaceFolder.uri.fsPath)
  getWorkspaceSnapshotService().invalidate(workspaceFolder)
}

/**
 * Cache hot-file detection to avoid repeated git churn during UI refresh bursts.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {{ force?: boolean }} [options]
 * @returns {string[]}
 */
function getHotFilesCached(workspaceFolder, options = {}) {
  const { force = false } = options
  const key = workspaceFolder.uri.fsPath
  const cached = _hotFilesCache.get(key)
  const now = Date.now()
  if (
    !force &&
    cached &&
    now - cached.fetchedAt <= HOT_FILES_CACHE_TTL_MS &&
    Array.isArray(cached.files)
  ) {
    return cached.files
  }
  const files = detectHotFiles(workspaceFolder)
  _hotFilesCache.set(key, { files, fetchedAt: now })
  return files
}

/**
 * Normalize agent names/ids for comparisons.
 * @param {string | undefined | null} value
 * @returns {string}
 */

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
      invalidateWorkspaceCaches(workspaceFolder)
    }
  } catch (err) {
    // M4: only silently ignore ENOENT; log unexpected errors
    if (err && err.code !== 'ENOENT') console.error('[AgentSync] ensureHandoffsFile error:', err)
  }
}

/**
 * Write the handoffs store to .agentsync/handoffs.json.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {{ version: number, handoffs: any[] }} data
 */
function writeHandoffs(workspaceFolder, data) {
  fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
  const handoffsPath = getHandoffsPath(workspaceFolder)
  // C3: atomic write prevents partial-write corruption
  atomicWriteFileSync(handoffsPath, JSON.stringify(data, null, 2))
  invalidateWorkspaceCaches(workspaceFolder)
}

/**
 * Validate a handoff record before persisting.
 * @param {any} handoff
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateHandoff(handoff) {
  const errors = []
  const skipReason =
    handoff.no_handoff_reason !== null && handoff.no_handoff_reason !== undefined
      ? String(handoff.no_handoff_reason || '').trim()
      : null
  const isSkip = Boolean(skipReason)

  if (!handoff.from_agent) errors.push('from_agent is required')
  if (!handoff.summary && !isSkip) errors.push('summary is required')
  if (!handoff.owner_mode) errors.push('owner_mode is required')
  if (!handoff.status) errors.push('status is required')

  const mode = String(handoff.owner_mode || '').toLowerCase()
  const toAgents = Array.isArray(handoff.to_agents) ? handoff.to_agents : []

  if (mode === 'single') {
    if (toAgents.length !== 1) errors.push('owner_mode "single" requires exactly 1 to_agents entry')
  } else if (mode === 'shared') {
    if (toAgents.length !== 2)
      errors.push('owner_mode "shared" requires exactly 2 to_agents entries')
  } else if (mode === 'auto') {
    const caps = Array.isArray(handoff.required_capabilities) ? handoff.required_capabilities : []
    if (caps.length === 0)
      errors.push('owner_mode "auto" requires at least one required_capabilities entry')
  } else if (mode !== '') {
    errors.push(`owner_mode must be "single", "shared", or "auto" (got "${mode}")`)
  }

  if (handoff.no_handoff_reason !== null && handoff.no_handoff_reason !== undefined) {
    if (typeof handoff.no_handoff_reason !== 'string' || !handoff.no_handoff_reason.trim()) {
      errors.push('no_handoff_reason must be a non-empty string when provided')
    } else {
      if (mode !== 'auto') {
        errors.push('skip/no_handoff records must use owner_mode "auto"')
      }
      if (toAgents.length > 0) {
        errors.push('skip/no_handoff records must not set to_agents')
      }
    }
  }

  // M3: created_at is required for audit integrity
  if (!handoff.created_at) {
    errors.push('created_at is required')
  } else if (
    typeof handoff.created_at !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T/.test(handoff.created_at)
  ) {
    errors.push('created_at must be an ISO 8601 timestamp')
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



// â”€â”€â”€ Git helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


// â”€â”€â”€ Safe file I/O helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
 * Does NOT support shell operators (&&, ||, ;, |, $(), backticks) â€” use a


// â”€â”€â”€ Health checks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Run a health-check command safely and asynchronously.
 * C1: command is tokenised via parseCommandArgv â€” shell:true is never used,
 *     preventing injection via user-controlled .agentsync.json values.
 * M1: uses cp.spawn (async) with a 60-second timeout so the extension host
 *     is never blocked.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} command
 * @returns {Promise<{ ok: boolean, output: string }>}
 */
function runCheckCommand(workspaceFolder, command) {
  if (!command || !command.trim()) return Promise.resolve({ ok: false, output: '' })

  const argv = parseCommandArgv(command.trim())
  if (argv.length === 0) return Promise.resolve({ ok: false, output: '' })
  const [program, ...args] = argv

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const proc = cp.spawn(program, args, { cwd: workspaceFolder.uri.fsPath })

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        proc.kill('SIGTERM')
      } catch {}
      setTimeout(() => {
        try {
          proc.kill('SIGKILL')
        } catch {}
      }, 2000)
      resolve({ ok: false, output: 'Health check timed out (60s limit).' })
    }, 60 * 1000)

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    proc.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const output = [stdout, stderr].filter(Boolean).join('\n').trim()
      resolve({ ok: code === 0, output })
    })

    proc.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ ok: false, output: err.message })
    })
  })
}



/**
 * Execute configured health checks and return per-check status and output.
 * M1: async so runCheckCommand's non-blocking spawn is properly awaited.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {Promise<{ results: Record<string, string>, outputs: Record<string, string> }>}
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
    const to =
      Array.isArray(h.to_agents) && h.to_agents.length > 0 ? h.to_agents.join(',') : '(none)'
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

// â”€â”€â”€ Tracker I/O â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  // C3: atomic write prevents partial-write corruption
  atomicWriteFileSync(getTrackerPath(workspaceFolder), content)
  invalidateWorkspaceCaches(workspaceFolder)
}

// â”€â”€â”€ State file I/O â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Write structured session state to .agentsync/state.json.
 * Agents can read this instead of parsing AgentTracker.md.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {object} data
 */
function writeStateFile(workspaceFolder, data) {
  try {
    fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
    const existingState = readStateFile(workspaceFolder) || {}
    const existingIntegration =
      existingState.integration && typeof existingState.integration === 'object'
        ? existingState.integration
        : {}
    const snapshotMeta = getWorkspaceSnapshotService().getMetadata(workspaceFolder)
    const previousVersion = Math.max(
      0,
      Number(existingIntegration?.snapshot?.version || 0)
    )
    const snapshotVersion = Math.max(previousVersion + 1, Number(snapshotMeta.version || 0), 1)
    const snapshotHash =
      snapshotMeta.hash ||
      getWorkspaceSnapshotService().computeHash(JSON.stringify(data || {}))
    const integration = {
      ...existingIntegration,
      ...(data?.integration && typeof data.integration === 'object' ? data.integration : {}),
      snapshot: {
        version: snapshotVersion,
        hash: snapshotHash || null
      }
    }
    const payload = {
      ...data,
      integration
    }
    // C3: atomic write prevents partial-write corruption
    atomicWriteFileSync(getStatePath(workspaceFolder), JSON.stringify(payload, null, 2))
    invalidateWorkspaceCaches(workspaceFolder)
  } catch (err) {
    // M4: log unexpected errors rather than silently swallowing them
    if (err && err.code !== 'ENOENT') console.error('[AgentSync] writeStateFile error:', err)
  }
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

// â”€â”€â”€ Tracker warnings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Prompt helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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



/**
 * Count health check outcomes for summary text.
 * @param {Record<string, string>} health
 */
function summarizeHealthCounts(health) {
  const counts = { pass: 0, fail: 0, notConfigured: 0, total: 0 }
  for (const status of Object.values(health || {})) {
    const normalized = toSingleLine(status).toLowerCase()
    if (normalized === 'pass') counts.pass += 1
    else if (normalized === 'fail') counts.fail += 1
    else counts.notConfigured += 1
    counts.total += 1
  }
  return counts
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
function buildDeterministicSessionSummary(params) {
  const goal = toSingleLine(params.goal) || 'Session update'
  const hotFiles = Array.isArray(params.hotFiles) ? params.hotFiles : []
  const topFiles = hotFiles.slice(0, 2)
  const filesText =
    topFiles.length > 0
      ? `${hotFiles.length} hot file${hotFiles.length === 1 ? '' : 's'} (${topFiles.join(', ')})`
      : '0 hot files'
  const healthCounts = summarizeHealthCounts(params.health || {})
  const healthText = `health pass:${healthCounts.pass} fail:${healthCounts.fail} n/a:${healthCounts.notConfigured}`
  return truncateSingleLine(`${goal}; ${filesText}; ${healthText}.`, params.maxSummaryLength)
}

/**
 * Resolve deterministic routing defaults for a source agent.
 * @param {ReturnType<typeof readAgentSyncConfig>} config
 * @param {string} agent
 * @returns {{ owner_mode: 'single' | 'shared' | 'auto', to_agents: string[], required_capabilities: string[] } | null}
 */
function resolveAutomationRoute(config, agent) {
  const agentId = canonicalAgentId(agent)
  if (!agentId) return null
  const route = config?.automation?.handoffRoutingDefaults?.[agentId]
  if (!route || typeof route !== 'object') return null

  const ownerMode = String(route.owner_mode || '').toLowerCase()
  const toAgents = Array.isArray(route.to_agents)
    ? route.to_agents.map((a) => canonicalAgentId(a)).filter(Boolean)
    : []
  const requiredCapabilities = Array.isArray(route.required_capabilities)
    ? route.required_capabilities.map((c) => toSingleLine(c)).filter(Boolean)
    : []

  if (ownerMode === 'single' && toAgents.length === 1) {
    return { owner_mode: ownerMode, to_agents: toAgents, required_capabilities: [] }
  }
  if (ownerMode === 'shared' && toAgents.length === 2) {
    return { owner_mode: ownerMode, to_agents: toAgents, required_capabilities: [] }
  }
  if (ownerMode === 'auto' && requiredCapabilities.length > 0) {
    return { owner_mode: ownerMode, to_agents: [], required_capabilities: requiredCapabilities }
  }
  return null
}

/**
 * Build deterministic automation notes for handoff records.
 * @param {{
 *  summary: string,
 *  hotFiles: string[],
 *  health: Record<string, string>,
 *  sourceAgent: string
 * }} params
 * @returns {string}
 */
function buildAutomationHandoffNotes(params) {
  const summary = toSingleLine(params.summary)
  const sourceAgent = canonicalAgentId(params.sourceAgent) || 'unknown'
  const hotFiles = Array.isArray(params.hotFiles) ? params.hotFiles : []
  const topFiles = hotFiles.slice(0, 2).join(', ') || 'none'
  const healthCounts = summarizeHealthCounts(params.health || {})
  return toSingleLine(
    `Auto-drafted from ${sourceAgent}. Goal: ${summary}. Start with files: ${topFiles}. Health pass:${healthCounts.pass} fail:${healthCounts.fail} n/a:${healthCounts.notConfigured}.`
  )
}

/**
 * Build one-line handoff prompts for downstream agents.
 * @param {any} handoffRecord
 * @returns {string[]}
 */
function buildHandoffPromptLines(handoffRecord) {
  if (!handoffRecord || handoffRecord.no_handoff_reason) return []

  const handoffId = toSingleLine(handoffRecord.handoff_id) || 'HO-UNKNOWN'
  const branch = toSingleLine(handoffRecord.branch) || PLACEHOLDER
  const commit = toSingleLine(handoffRecord.commit) || PLACEHOLDER
  const files = Array.isArray(handoffRecord.files) ? handoffRecord.files.filter(Boolean) : []
  const startFiles = files.slice(0, 2).join(', ') || 'AgentTracker.md'
  const summary = toSingleLine(handoffRecord.summary) || 'continue the current work'
  const mode = String(handoffRecord.owner_mode || '').toLowerCase()

  // Model tier recommendation suffix
  const modelTier = handoffRecord.recommended_model_tier || null
  const modelJustification = toSingleLine(handoffRecord.model_justification || '')
  let modelSuffix = ''
  if (modelTier === 'worker') {
    modelSuffix = ' [Worker-tier task: use a lighter model]'
  } else if (modelTier === 'lead') {
    modelSuffix = ' [Lead-tier task: use a capable model'
    if (modelJustification) modelSuffix += ' \u2014 ' + modelJustification
    modelSuffix += ']'
  }

  // Context hints suffix
  const hints = handoffRecord.context_hints || null
  let contextSuffix = ''
  if (hints) {
    const parts = []
    if (Array.isArray(hints.entry_points) && hints.entry_points.length > 0) {
      parts.push('entry points: ' + hints.entry_points.slice(0, 3).join(', '))
    }
    if (Array.isArray(hints.relevant_symbols) && hints.relevant_symbols.length > 0) {
      parts.push('key symbols: ' + hints.relevant_symbols.slice(0, 5).join(', '))
    }
    if (parts.length > 0) contextSuffix = ' Context: ' + parts.join('; ') + '.'
  }

  const buildLine = (targetLabel) =>
    `[AgentSync] Pick up ${handoffId} on ${branch} (${commit}) for ${targetLabel}: start in ${startFiles}; goal: ${summary}; check AgentTracker.md + .agentsync/handoffs.json + .agentsync/context-capsule.json.${modelSuffix}${contextSuffix}`

  if (mode === 'auto') {
    const caps = Array.isArray(handoffRecord.required_capabilities)
      ? handoffRecord.required_capabilities.map((c) => toSingleLine(c)).filter(Boolean)
      : []
    const capabilityLabel =
      caps.length > 0 ? `capabilities ${caps.join(', ')}` : 'required capabilities'
    return [buildLine(capabilityLabel)]
  }

  const targets = Array.isArray(handoffRecord.to_agents)
    ? handoffRecord.to_agents.map((a) => canonicalAgentId(a)).filter(Boolean)
    : []
  if (targets.length === 0) return [buildLine('next owner')]
  return targets.map((target) => buildLine(target))
}

/**
 * Prompt once for fallback routing when automation defaults are unavailable.
 * @param {number} hotFileCount
 * @returns {Promise<{ handoffData: any, automationContext: string } | null>}
 */
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
      const owners = Array.isArray(h?.to_agents) ? h.to_agents.map((a) => canonicalAgentId(a)) : []
      return owners.includes(canonical)
    }) || null
  )
}

/**
 * Claim a handoff record — set status to in_progress and append a state_history entry.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} handoffId
 * @param {string} agentId
 */
function claimHandoffRecord(workspaceFolder, handoffId, agentId) {
  const store = readHandoffs(workspaceFolder)
  const now = new Date().toISOString()
  const normalizedId = toSingleLine(handoffId)
  const canonical = canonicalAgentId(agentId)
  if (!normalizedId) return { ok: false, reason: 'missing_handoff_id' }
  if (!canonical) return { ok: false, reason: 'missing_agent' }

  let result = { ok: false, reason: 'not_found' }
  const updated = store.handoffs.map((h) => {
    if (toSingleLine(h?.handoff_id) !== normalizedId) return h

    const currentStatus = String(h?.status || '').toLowerCase()
    const owners = Array.isArray(h?.to_agents) ? h.to_agents.map((a) => canonicalAgentId(a)) : []
    const lastClaim =
      Array.isArray(h?.state_history) && h.state_history.length > 0
        ? h.state_history[h.state_history.length - 1]
        : null
    const claimedBy = lastClaim?.agent ? canonicalAgentId(lastClaim.agent) : null

    if (currentStatus === 'in_progress') {
      result = { ok: false, reason: 'already_claimed', claimedBy }
      return h
    }
    if (currentStatus !== 'queued') {
      result = { ok: false, reason: 'not_claimable', status: currentStatus || 'unknown' }
      return h
    }
    if (owners.length > 0 && !owners.includes(canonical)) {
      result = { ok: false, reason: 'not_assigned' }
      return h
    }

    result = { ok: true, handoffId: normalizedId }
    return {
      ...h,
      status: 'in_progress',
      updated_at: now,
      state_history: [
        ...(Array.isArray(h.state_history) ? h.state_history : []),
        { status: 'in_progress', agent: canonical, timestamp: now, reason: 'claimed via agentsync' }
      ]
    }
  })
  if (!result.ok) return result
  const claimedRecord = updated.find((h) => toSingleLine(h?.handoff_id) === normalizedId)
  if (claimedRecord) {
    const validation = validateHandoff(claimedRecord)
    if (!validation.valid) {
      return { ok: false, reason: 'invalid_handoff', errors: validation.errors }
    }
  }
  writeHandoffs(workspaceFolder, { version: 1, handoffs: updated })
  return result
}

const HANDOFF_ALLOWED_STATUSES = new Set([
  'queued',
  'in_progress',
  'blocked',
  'ready_for_review',
  'approved',
  'merged',
  'escalated'
])

/**
 * Normalize an input status to a supported handoff state.
 * @param {string | null | undefined} status
 * @param {string} fallback
 * @returns {string}
 */
function normalizeHandoffStatus(status, fallback = 'queued') {
  const normalized = String(status || '').toLowerCase().trim()
  if (HANDOFF_ALLOWED_STATUSES.has(normalized)) return normalized
  return fallback
}

/**
 * Build a unique HO-YYYYMMDD-### id.
 * @param {any[]} handoffs
 * @param {string} now
 * @returns {string}
 */
function buildHandoffId(handoffs, now) {
  const dateStr = now.slice(0, 10).replace(/-/g, '')
  const existing = new Set((handoffs || []).map((h) => toSingleLine(h?.handoff_id)))
  let seq = Math.max(1, (handoffs || []).length + 1)
  while (seq < 10000) {
    const id = `HO-${dateStr}-${String(seq).padStart(3, '0')}`
    if (!existing.has(id)) return id
    seq += 1
  }
  return `HO-${dateStr}-${Date.now().toString().slice(-6)}`
}

/**
 * Keep AgentTracker.md "Agent Handoffs" section in sync with the JSON source of truth.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function syncTrackerHandoffsSection(workspaceFolder) {
  const content = readTracker(workspaceFolder)
  if (!content) return
  const { handoffs } = readHandoffs(workspaceFolder)
  const updated = setSectionBody(
    content,
    'Agent Handoffs',
    handoffs.length > 0 ? renderTrackerHandoffsSection(handoffs) : 'No open handoffs.'
  )
  writeTracker(workspaceFolder, updated)
}

/**
 * Create and persist a handoff record.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {any} input
 */
function createHandoffRecord(workspaceFolder, input = {}) {
  const store = readHandoffs(workspaceFolder)
  const now = new Date().toISOString()
  const fromAgent = canonicalAgentId(input.from_agent || input.agent || 'agency')
  const toAgents = Array.isArray(input.to_agents)
    ? input.to_agents.map((a) => canonicalAgentId(a)).filter(Boolean)
    : []
  const requiredCaps = Array.isArray(input.required_capabilities)
    ? input.required_capabilities.map((c) => toSingleLine(c)).filter(Boolean)
    : []
  const skipReason =
    input.no_handoff_reason !== null && input.no_handoff_reason !== undefined
      ? toSingleLine(input.no_handoff_reason)
      : null
  const modeInput = String(input.owner_mode || '').toLowerCase()
  let ownerMode = modeInput
  if (!ownerMode) {
    ownerMode = toAgents.length >= 2 ? 'shared' : toAgents.length === 1 ? 'single' : 'auto'
  }

  const record = {
    handoff_id: toSingleLine(input.handoff_id) || buildHandoffId(store.handoffs, now),
    task_id: toSingleLine(input.task_id) || null,
    from_agent: fromAgent || 'agency',
    to_agents: toAgents,
    owner_mode: ownerMode,
    status: normalizeHandoffStatus(input.status, 'queued'),
    required_capabilities: requiredCaps,
    summary: toSingleLine(input.summary) || (skipReason ? 'Handoff skipped by agent' : 'Agency handoff'),
    notes: toSingleLine(input.notes || ''),
    no_handoff_reason: skipReason || null,
    files: Array.isArray(input.files) ? input.files.map((f) => toSingleLine(f)).filter(Boolean) : [],
    branch: toSingleLine(input.branch) || null,
    commit: toSingleLine(input.commit) || null,
    prior_attempts: Number.isFinite(Number(input.prior_attempts))
      ? Math.max(0, Math.round(Number(input.prior_attempts)))
      : 0,
    recommended_model_tier:
      input.recommended_model_tier === 'lead' || input.recommended_model_tier === 'worker'
        ? input.recommended_model_tier
        : null,
    model_justification: toSingleLine(input.model_justification) || null,
    context_hints:
      input.context_hints && typeof input.context_hints === 'object' ? input.context_hints : null,
    source_system: toSingleLine(input.source_system) || null,
    source_run_id: toSingleLine(input.source_run_id) || null,
    source_event_id: toSingleLine(input.source_event_id) || null,
    created_at: now,
    updated_at: now,
    state_history: [
      {
        status: normalizeHandoffStatus(input.status, 'queued'),
        agent: fromAgent || 'agency',
        timestamp: now,
        reason: skipReason ? 'created (skip)' : 'created'
      }
    ]
  }

  if (skipReason) {
    record.owner_mode = 'auto'
    record.to_agents = []
    if (!record.required_capabilities.length) {
      record.required_capabilities = ['skip-handoff']
    }
  } else if (record.owner_mode === 'single' && record.to_agents.length !== 1) {
    record.owner_mode = 'auto'
    record.to_agents = []
    if (record.required_capabilities.length === 0) record.required_capabilities = ['handoff']
  } else if (record.owner_mode === 'shared' && record.to_agents.length !== 2) {
    record.owner_mode = 'auto'
    record.to_agents = []
    if (record.required_capabilities.length === 0) record.required_capabilities = ['handoff']
  } else if (record.owner_mode === 'auto' && record.required_capabilities.length === 0) {
    record.required_capabilities = ['handoff']
  }

  const { valid, errors } = validateHandoff(record)
  if (!valid) throw new Error('Invalid handoff: ' + errors.join('; '))

  writeHandoffs(workspaceFolder, { version: 1, handoffs: [...store.handoffs, record] })
  syncTrackerHandoffsSection(workspaceFolder)
  return record
}

/**
 * Transition an existing handoff to a new status.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} handoffId
 * @param {string} status
 * @param {string} agentId
 * @param {string | null} reason
 */
function completeHandoffRecord(workspaceFolder, handoffId, status, agentId, reason = null) {
  const normalizedId = toSingleLine(handoffId)
  const nextStatus = normalizeHandoffStatus(status, 'merged')
  const actor = canonicalAgentId(agentId)
  if (!normalizedId) return { ok: false, reason: 'missing_handoff_id' }
  if (!actor) return { ok: false, reason: 'missing_agent' }

  const store = readHandoffs(workspaceFolder)
  const now = new Date().toISOString()
  let found = false
  const updated = store.handoffs.map((h) => {
    if (toSingleLine(h?.handoff_id) !== normalizedId) return h
    found = true
    return {
      ...h,
      status: nextStatus,
      updated_at: now,
      state_history: [
        ...(Array.isArray(h.state_history) ? h.state_history : []),
        {
          status: nextStatus,
          agent: actor,
          timestamp: now,
          reason: toSingleLine(reason) || 'completed via agentsync'
        }
      ]
    }
  })
  if (!found) return { ok: false, reason: 'not_found' }
  const completedRecord = updated.find((h) => toSingleLine(h?.handoff_id) === normalizedId)
  if (completedRecord) {
    const validation = validateHandoff(completedRecord)
    if (!validation.valid) {
      return { ok: false, reason: 'invalid_handoff', errors: validation.errors }
    }
  }

  writeHandoffs(workspaceFolder, { version: 1, handoffs: updated })
  syncTrackerHandoffsSection(workspaceFolder)
  return { ok: true, handoffId: normalizedId, status: nextStatus }
}

/**
 * Read all handoff records.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function listHandoffRecords(workspaceFolder) {
  const store = readHandoffs(workspaceFolder)
  return store.handoffs
}

/**
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
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
    ? (raw.to_agents || raw.owners || raw.assignees)
    : []
  const requiredCaps = Array.isArray(raw.required_capabilities || raw.capabilities)
    ? (raw.required_capabilities || raw.capabilities)
    : []
  const sourceRunId = toSingleLine(raw.run_id || raw.runId || meta.sourceRunId || '') || null
  const sourceEventId = toSingleLine(raw.event_id || raw.eventId || meta.sourceEventId || '') || null

  const modeInput = String(raw.owner_mode || '').toLowerCase()
  const ownerMode = modeInput || (toAgents.length >= 2 ? 'shared' : toAgents.length === 1 ? 'single' : 'auto')
  const normalizedMode = ownerMode === 'single' || ownerMode === 'shared' || ownerMode === 'auto' ? ownerMode : 'auto'

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
    writeStateFile(workspaceFolder, { ...state, integration, lastUpdated: new Date().toISOString() })
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
      const byEvent = next.findIndex((h) => toSingleLine(h?.source_event_id) === candidate.source_event_id)
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
          handoff_id: toSingleLine(existing.handoff_id || candidate.handoff_id || '') || buildHandoffId(next, now),
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
            Array.isArray(candidate.required_capabilities) && candidate.required_capabilities.length > 0
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
          if (!Array.isArray(merged.required_capabilities) || merged.required_capabilities.length === 0) {
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
        const createdRecord = createHandoffRecord(workspaceFolder, {
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

  // Prefer lastSession from existing state.json so structured data survives across sessions.
  // Fall back to parsing the tracker for workspaces that haven't written state.json yet.
  const existingState = readStateFile(workspaceFolder) || {}
  const lastSessionFromState = existingState.lastSession || null
  const lastSessionFromTracker = isEmptyValue(existingTracker.agent)
    ? null
    : {
        agent: existingTracker.agent,
        date: existingTracker.date,
        summary: existingTracker.summary,
        branch: existingTracker.branch,
        commit: existingTracker.commit
      }
  const lastSession = lastSessionFromState || lastSessionFromTracker

  const updatedInProgressLines = [...currentLines, entry]

  writeStateFile(workspaceFolder, {
    sessionActive: true,
    lastUpdated: new Date().toISOString(),
    activeSession: {
      agent,
      goal: normalizedGoal,
      startedAt: new Date().toISOString()
    },
    sessionMetrics: {
      filesOpened: 0,
      filesModified: 0,
      commandsRun: 0,
      startedAt: new Date().toISOString()
    },
    lastSession,
    hotFiles: [],
    inProgress: updatedInProgressLines
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
 * @param {{ summary?: string, notes?: string, owner_mode?: string, to_agents?: string[], required_capabilities?: string[], no_handoff_reason?: string, automation_context?: string | null, task_id?: string | null } | null} [handoffData]
 * @param {{ hotFiles?: string[], healthResults?: Record<string, string>, healthOutputs?: Record<string, string>, summarySource?: 'user' | 'deterministic', automationUsed?: boolean, automationContext?: string | null, goalHint?: string | null }} [options]
 * @returns {{ health: Record<string, string>, healthOutputs: Record<string, string>, hotFiles: string[], handoff: object | null, generatedSummary: string, summarySource: 'user' | 'deterministic', handoffPrompts: string[], promptCopiedToClipboard: boolean }}
 */
async function endSessionCore(
  workspaceFolder,
  agent,
  summary,
  nextWork,
  handoffData = null,
  options = {}
) {
  let content = readTracker(workspaceFolder)
  if (!content) throw new Error('Could not read AgentTracker.md')

  const config = readAgentSyncConfig(workspaceFolder)
  const zeroTouchCfg = config.automation?.endSessionZeroTouch || DEFAULT_END_SESSION_ZERO_TOUCH
  const state = readStateFile(workspaceFolder) || {}
  const now = new Date().toISOString()
  const branch = runGit(workspaceFolder, ['rev-parse', '--abbrev-ref', 'HEAD']) || PLACEHOLDER
  const commit = runGit(workspaceFolder, ['rev-parse', '--short', 'HEAD']) || PLACEHOLDER
  const hotFiles = Array.isArray(options.hotFiles)
    ? options.hotFiles
    : getHotFilesCached(workspaceFolder, { force: true })
  const signatureChanges = detectSignatureChanges(workspaceFolder, hotFiles)
  const complexityInfo = scoreNextTaskCapabilities(
    hotFiles,
    signatureChanges,
    state?.sessionMetrics || {},
    state?.priorAttempts || 0
  )

  // M1: await the now-async health checks so the host is not blocked
  let health = options.healthResults
  let healthOutputs = options.healthOutputs
  if (!health || !healthOutputs) {
    const checks = await runHealthChecks(workspaceFolder)
    health = checks.results
    healthOutputs = checks.outputs
  }
  if (!health || typeof health !== 'object') health = {}
  if (!healthOutputs || typeof healthOutputs !== 'object') healthOutputs = {}

  const goalHint = toSingleLine(options.goalHint || state?.activeSession?.goal || '')
  let normalizedSummary = toSingleLine(summary)
  let summarySource = options.summarySource === 'deterministic' ? 'deterministic' : 'user'
  let automationUsed = options.automationUsed === true
  const automationFeatureEnabled = zeroTouchCfg.enabled || options.automationUsed === true

  if (!normalizedSummary && zeroTouchCfg.enabled) {
    normalizedSummary = buildDeterministicSessionSummary({
      goal: goalHint,
      hotFiles,
      health,
      maxSummaryLength: zeroTouchCfg.maxSummaryLength
    })
    summarySource = 'deterministic'
    automationUsed = true
  }

  const persistedSummary = normalizedSummary || PLACEHOLDER

  let automationContext =
    toSingleLine(
      options.automationContext || (handoffData && handoffData.automation_context) || ''
    ) || null

  // Auto-route handoff for headless/automated paths when hot files exist and routing defaults are known.
  if (hotFiles.length > 0 && handoffData === null && zeroTouchCfg.enabled) {
    const autoRoute = resolveAutomationRoute(config, agent)
    if (autoRoute) {
      handoffData = {
        summary: normalizedSummary || 'Session update',
        notes: buildAutomationHandoffNotes({
          summary: normalizedSummary || 'Session update',
          hotFiles,
          health,
          sourceAgent: agent
        }),
        owner_mode: autoRoute.owner_mode,
        to_agents: autoRoute.to_agents,
        required_capabilities: autoRoute.required_capabilities,
        no_handoff_reason: null,
        automation_context: 'default:' + canonicalAgentId(agent)
      }
      automationContext = handoffData.automation_context
      automationUsed = true
    }
  }

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
      '- **Agent:** ' + agent,
      '- **Date:** ' + now,
      '- **Summary:** ' + persistedSummary,
      '- **Branch:** ' + branch,
      '- **Commit:** ' + commit
    ].join('\n')
  )

  content = setSectionBody(content, 'Current Health', formatHealthTable(health, healthOutputs))
  content = setSectionBody(
    content,
    'Hot Files',
    hotFiles.length > 0 ? hotFiles.map((file) => '- `' + file + '`').join('\n') : '*None*'
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

  const normalizedNextWork = toSingleLine(nextWork)
  if (normalizedNextWork) {
    const existingNext = getSectionBody(content, 'Suggested Next Work')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => !line.startsWith('<!--'))
      .filter((line) => line)

    content = setSectionBody(
      content,
      'Suggested Next Work',
      [...existingNext, '- ' + normalizedNextWork].join('\n')
    )
  }

  if (signatureChanges.length > 0) {
    const existingGotchas = getSectionBody(content, 'Known Issues & Gotchas')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => !line.startsWith('<!--'))
      .filter((line) => line)
    const sigLines = signatureChanges.map(
      ({ file, change }) =>
        `- ⚠ Signature change in \`${file}\`: \`${change.trim().slice(0, 120)}\``
    )
    content = setSectionBody(
      content,
      'Known Issues & Gotchas',
      [...existingGotchas, ...sigLines].join('\n')
    )
  }
  // Persist handoff record if provided
  let handoffRecord = null
  let generatedPromptLines = []
  if (handoffData !== null) {
    const existingHandoffs = readHandoffs(workspaceFolder)
    const allHandoffs = existingHandoffs.handoffs
    const dateStr = now.slice(0, 10).replace(/-/g, '')
    const seq = String(allHandoffs.length + 1).padStart(3, '0')
    const handoffId = 'HO-' + dateStr + '-' + seq

    if (handoffData.no_handoff_reason) {
      // H5: validate skip reason before writing - previously bypassed validateHandoff()
      const skipReason = String(handoffData.no_handoff_reason).trim()
      if (!skipReason) throw new Error('no_handoff_reason must be a non-empty string')

      // Skip record - agent opted out with an explicit reason
      handoffRecord = {
        handoff_id: handoffId,
        task_id: null,
        from_agent: canonicalAgentId(agent),
        to_agents: [],
        owner_mode: 'auto',
        status: 'queued',
        required_capabilities: ['skip-handoff'],
        summary: 'Handoff skipped by agent',
        notes: toSingleLine(handoffData.notes || ''),
        no_handoff_reason: skipReason,
        files: hotFiles,
        branch,
        commit,
        prior_attempts: 0,
        generated_prompt_lines: [],
        prompt_copied_to_clipboard: false,
        summary_source: summarySource,
        automation_context: automationContext,
        created_at: now,
        updated_at: now,
        state_history: [
          { status: 'queued', agent: canonicalAgentId(agent), timestamp: now, reason: 'skipped' }
        ]
      }
      const { valid, errors } = validateHandoff(handoffRecord)
      if (!valid) throw new Error('Invalid handoff: ' + errors.join('; '))
    } else {
      // Determine model tier recommendation based on task complexity
      const modelTier = handoffData.recommended_model_tier || null
      const modelJustification = handoffData.model_justification || null
      const contextHints = handoffData.context_hints || null

      // Full handoff record
      handoffRecord = {
        handoff_id: handoffId,
        task_id: handoffData.task_id || null,
        from_agent: canonicalAgentId(agent),
        to_agents: (handoffData.to_agents || []).map((a) => canonicalAgentId(a)),
        owner_mode: String(handoffData.owner_mode || 'single').toLowerCase(),
        status: 'queued',
        required_capabilities: handoffData.required_capabilities || [],
        summary: toSingleLine(handoffData.summary || normalizedSummary || 'Session update'),
        notes: toSingleLine(handoffData.notes || ''),
        no_handoff_reason: null,
        recommended_model_tier: modelTier,
        model_justification: modelJustification ? toSingleLine(modelJustification) : null,
        context_hints: contextHints,
        files: hotFiles,
        branch,
        commit,
        prior_attempts: 0,
        generated_prompt_lines: [],
        prompt_copied_to_clipboard: false,
        summary_source: summarySource,
        automation_context:
          toSingleLine(handoffData.automation_context || automationContext || '') || null,
        created_at: now,
        updated_at: now,
        state_history: [
          {
            status: 'queued',
            agent: canonicalAgentId(agent),
            timestamp: now,
            reason: 'session ended with hot files'
          }
        ]
      }

      const { valid, errors } = validateHandoff(handoffRecord)
      if (!valid) throw new Error('Invalid handoff: ' + errors.join('; '))
    }

    if (automationFeatureEnabled) {
      generatedPromptLines = buildHandoffPromptLines(handoffRecord)
      handoffRecord.generated_prompt_lines = generatedPromptLines
    } else {
      delete handoffRecord.generated_prompt_lines
      delete handoffRecord.prompt_copied_to_clipboard
      delete handoffRecord.summary_source
      delete handoffRecord.automation_context
    }

    const updatedHandoffs = [...allHandoffs, handoffRecord]
    writeHandoffs(workspaceFolder, { version: 1, handoffs: updatedHandoffs })
    content = setSectionBody(
      content,
      'Agent Handoffs',
      renderTrackerHandoffsSection(updatedHandoffs)
    )
  } else {
    // Re-render the handoffs section from current store (in case handoffs changed externally)
    const existingHandoffs = readHandoffs(workspaceFolder)
    if (existingHandoffs.handoffs.length > 0) {
      content = setSectionBody(
        content,
        'Agent Handoffs',
        renderTrackerHandoffsSection(existingHandoffs.handoffs)
      )
    }
  }

  // C4: write tracker before state.json so that if state write fails, the session
  // remains "Busy" in the UI (recoverable via Clear Active Session) rather than
  // falsely appearing "Ready" while the tracker still shows the old session.
  writeTracker(workspaceFolder, content)

  // Compute open handoff summary for state.json so the panel can read it without opening handoffs.json
  const currentHandoffs = readHandoffs(workspaceFolder)
  const openHandoffs = currentHandoffs.handoffs.filter(isOpenHandoff)
  const shouldWriteAutomationState =
    automationFeatureEnabled &&
    (automationUsed || summarySource === 'deterministic' || generatedPromptLines.length > 0)
  const existingMetrics = readStateFile(workspaceFolder)?.sessionMetrics || {}
  const stateLastSession = {
    agent,
    date: now,
    summary: persistedSummary,
    branch,
    commit,
    sessionMetrics: {
      filesModified: existingMetrics.filesModified || 0,
      commandsRun: existingMetrics.commandsRun || 0,
      durationMs: Date.now() - (parseISODate(existingMetrics.startedAt) || Date.now())
    }
  }

  if (shouldWriteAutomationState) {
    stateLastSession.generatedSummary = normalizedSummary || persistedSummary
    stateLastSession.summarySource = summarySource
    stateLastSession.automationUsed = automationUsed
    stateLastSession.generatedPrompts = generatedPromptLines
  }

  writeStateFile(workspaceFolder, {
    sessionActive: false,
    lastUpdated: now,
    activeSession: null,
    lastSession: stateLastSession,
    health: Object.fromEntries(
      Object.entries(health).map(([label, status]) => [
        label,
        { status, output: healthOutputs[label] || '' }
      ])
    ),
    hotFiles,
    inProgress: remainingInProgress,
    openHandoffCount: openHandoffs.length,
    activeHandoffIds: openHandoffs.map((h) => String(h.handoff_id || h.task_id || ''))
  })

  return {
    health,
    healthOutputs,
    hotFiles,
    handoff: handoffRecord,
    generatedSummary: normalizedSummary || persistedSummary,
    summarySource,
    handoffPrompts: generatedPromptLines,
    promptCopiedToClipboard: false,
    signatureChanges,
    complexityInfo
  }
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
        startSessionCore(workspaceFolder, agent, goal || 'Session started')
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
        } = await endSessionCore(
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
        const handoffs = listHandoffRecords(workspaceFolder)
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
        const result = completeHandoffRecord(workspaceFolder, handoffId, status, agent, reason)
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
        const created = createHandoffRecord(workspaceFolder, handoff)
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



/**
 * Build a normalized snapshot for the live webview dashboard.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function getDashboardModel(workspaceFolder, viewMode = 'compact') {
  const snapshot = getWorkspaceSnapshot(workspaceFolder)
  const trackerContent = snapshot.trackerContent
  const tracker = snapshot.tracker
  const state = snapshot.state
  const config = snapshot.config
  const handoffInfo = snapshot.handoffInfo
  const inProgressLines = snapshot.inProgressLines
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

  // Session duration warning from tokenBudget config
  const sessionWarnMinutes = config.tokenBudget?.sessionDurationWarningMinutes || 0
  if (sessionWarnMinutes > 0 && state?.sessionActive && state?.activeSession?.startedAt) {
    const started = parseISODate(state.activeSession.startedAt)
    if (Number.isFinite(started)) {
      const ageMinutes = (Date.now() - started) / 60000
      if (ageMinutes >= sessionWarnMinutes) {
        warnings.push(
          `Session running ${formatElapsed(Date.now() - started)} \u2014 consider ending and handing off to reduce context size.`
        )
      }
    }
  }
  const hotFiles = new Set(getHotFilesCached(workspaceFolder).map(normalizeRepoRelativePath))
  const getSuggestedNextStep = () => {
    if (!trackerContent) return 'Run "Initialize Workspace" to set up AgentSync files.'
    if (state?.sessionActive)
      return 'Use "End Session" when you are done, or "Clear Active Session" if stale.'
    if (inProgressLines.length > 0)
      return 'Review in-progress items, then start a new session to continue.'
    if (handoffBuckets.open.length > 0)
      return 'Open Handoffs JSON and pick the highest-priority open handoff.'
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
  // Full card data for interactive dashboard actions (Claim / Start / Skip)
  const summarizeHandoffCard = (h, stale = false) => {
    const files = Array.isArray(h?.files) ? h.files : []
    const toAgents = Array.isArray(h?.to_agents) ? h.to_agents : []
    return {
      id: String(h?.handoff_id || h?.task_id || 'unknown'),
      summary: String(h?.summary || 'No summary'),
      from_agent: String(h?.from_agent || 'unknown'),
      to_agents_display: toAgents.join(', ') || 'any',
      files_display:
        files.length > 3
          ? files.slice(0, 3).join(', ') + ' (+' + (files.length - 3) + ' more)'
          : files.join(', ') || 'none',
      status: String(h?.status || 'queued'),
      notes: String(h?.notes || ''),
      recommended_model_tier: h?.recommended_model_tier || null,
      model_justification: String(h?.model_justification || ''),
      stale_observation: stale
    }
  }
  const compactTasks = inProgressLines.slice(0, 2)
  const compactExtraTaskCount = Math.max(0, inProgressLines.length - compactTasks.length)
  const rawSessionGoal = String(state?.activeSession?.goal || '').trim()
  const rawFirstInProgress = String(inProgressLines[0] || '').trim()
  // Prefer state.json last session summary over parsing tracker markdown.
  const rawTrackerSummary = String(state?.lastSession?.summary || tracker.summary || '').trim()
  let focusText = 'No active goal'
  if (!isEmptyValue(rawSessionGoal)) {
    focusText = rawSessionGoal
  } else if (!isEmptyValue(rawFirstInProgress)) {
    focusText = rawFirstInProgress
  } else if (!isEmptyValue(rawTrackerSummary)) {
    focusText = rawTrackerSummary
  }
  const normalizedViewMode = viewMode === 'full' ? 'full' : 'compact'

  const defaultShortcuts = [
    'agentsync.startSession',
    'agentsync.endSession',
    'agentsync.openTracker',
    'agentsync.contextStatus'
  ]
  const shortcuts =
    Array.isArray(config.dashboardShortcuts) && config.dashboardShortcuts.length > 0
      ? config.dashboardShortcuts
      : defaultShortcuts

  return {
    hasWorkspace: true,
    workspace: workspaceFolder.name,
    ui: {
      viewMode: normalizedViewMode
    },
    shortcuts,
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
      lastAgent: state?.lastSession?.agent || tracker.agent,
      lastDate: state?.lastSession?.date || tracker.date,
      lastSummary: state?.lastSession?.summary || tracker.summary,
      branch: state?.lastSession?.branch || tracker.branch,
      commit: state?.lastSession?.commit || tracker.commit
    },
    warnings,
    inProgress: inProgressLines,
    compact: {
      focusText,
      tasks: compactTasks,
      extraTaskCount: compactExtraTaskCount
    },
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
      blockedOrStale: handoffBuckets.blockedOrStale.slice(0, 8).map(summarizeHandoff),
      queued: handoffBuckets.assignedToMe
        .filter((h) => String(h?.status || '').toLowerCase() === 'queued')
        .slice(0, 10)
        .map((h) => {
          const isStale = (h.files || []).some((file) =>
            hotFiles.has(normalizeRepoRelativePath(file))
          )
          return summarizeHandoffCard(h, isStale)
        })
    }
  }
}

/**
 * Build and persist a deterministic context capsule for downstream agents.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {any}
 */
function generateContextCapsule(workspaceFolder) {
  const snapshot = getWorkspaceSnapshot(workspaceFolder, { force: true })
  const state = snapshot.state || null
  const tracker = snapshot.tracker || {
    agent: PLACEHOLDER,
    date: PLACEHOLDER,
    summary: PLACEHOLDER,
    branch: PLACEHOLDER,
    commit: PLACEHOLDER
  }
  const handoffInfo = snapshot.handoffInfo || { handoffs: [] }
  const config = snapshot.config || {}
  const staleAfterHours = Number(config.staleAfterHours) || DEFAULT_STALE_HOURS
  const currentAgentId = canonicalAgentId(
    state?.activeSession?.agent || state?.lastSession?.agent || tracker.agent
  )
  const handoffBuckets = getHandoffBuckets(handoffInfo.handoffs, currentAgentId, staleAfterHours)
  const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0
  const opsState = getOperationalState(
    state,
    snapshot.inProgressLines || [],
    handoffInfo.handoffs || [],
    autoStaleSessionMinutes
  )
  const hotFiles = getHotFilesCached(workspaceFolder, { force: true })
  const capsule = {
    version: 1,
    generatedAt: new Date().toISOString(),
    workspace: workspaceFolder.name,
    state: opsState,
    session: {
      active: Boolean(state?.sessionActive),
      activeSession: state?.activeSession || null,
      lastSession: state?.lastSession || null,
      metrics: state?.sessionMetrics || null
    },
    tracker: {
      agent: tracker.agent,
      date: tracker.date,
      summary: tracker.summary,
      branch: tracker.branch,
      commit: tracker.commit
    },
    hotFiles,
    inProgress: snapshot.inProgressLines || [],
    handoffs: {
      openCount: handoffBuckets.open.length,
      assignedToMe: handoffBuckets.assignedToMe.slice(0, 20),
      sharedWithMe: handoffBuckets.sharedWithMe.slice(0, 20),
      blockedOrStale: handoffBuckets.blockedOrStale.slice(0, 20)
    },
    warnings: getTrackerWarnings(workspaceFolder, tracker)
  }
  fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
  atomicWriteFileSync(getContextCapsulePath(workspaceFolder), JSON.stringify(capsule, null, 2))
  invalidateWorkspaceCaches(workspaceFolder)
  return capsule
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
    .mode-toggle {
      margin-left: auto;
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.85);
      color: var(--text);
      border-radius: 7px;
      padding: 4px 8px;
      font: inherit;
      font-size: 11px;
      cursor: pointer;
    }
    .mode-toggle:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: 7px;
      margin-bottom: 10px;
    }
    .actions.busy button.action,
    .compact-actions.busy button.action,
    .compact-more-actions.busy button.action {
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
    button.action.active-command,
    button.recovery-action.active-command {
      border-color: var(--active-command-color, #c8d2d8);
      background: var(--active-command-bg, rgba(19, 33, 24, 0.92));
      box-shadow:
        0 0 0 1px var(--active-command-color, #c8d2d8),
        0 0 12px -2px var(--active-command-color, #c8d2d8);
    }
    .compact-panel {
      margin-bottom: 10px;
      padding: 8px;
    }
    .compact-focus {
      margin-bottom: 6px;
      font-weight: 700;
      color: #c0f0d3;
    }
    .compact-task-list {
      margin: 0;
      padding-left: 16px;
      max-height: 90px;
      overflow: auto;
    }
    .compact-task-list li {
      margin: 3px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .compact-task-list li.empty {
      list-style: none;
      margin-left: -16px;
      color: var(--muted);
    }
    .compact-more-count {
      min-height: 16px;
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
    }
    .compact-actions {
      margin-top: 6px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 5px;
    }
    .compact-more-actions {
      margin-top: 5px;
      display: none;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 5px;
    }
    .compact-more-actions.open {
      display: grid;
    }
    button.action.compact-action {
      font-size: 11px;
      padding: 4px 6px;
      min-height: 28px;
      border-radius: 7px;
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
    .handoff-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 9px;
      margin-bottom: 6px;
    }
    .handoff-card-summary {
      font-size: 12px;
      font-weight: 600;
    }
    .handoff-card-meta {
      color: var(--muted);
      font-size: 11px;
      margin-top: 3px;
    }
    .handoff-card-actions {
      display: flex;
      gap: 5px;
      margin-top: 6px;
    }
    .handoff-card-actions button {
      font-size: 11px;
      padding: 3px 7px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      cursor: pointer;
    }
    .handoff-card-actions button:hover {
      border-color: #6adf9a;
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
    body[data-view-mode="compact"] .full-panel {
      display: none;
    }
    body[data-view-mode="full"] .compact-panel {
      display: none;
    }
  </style>
</head>
<body data-state="ready" data-view-mode="compact">
  <canvas id="matrix"></canvas>
  <div class="backdrop"></div>
  <div class="app">
    <div class="top">
      <div class="title">AgentSync Live</div>
      <span id="stateBadge" class="badge ready">READY</span>
      <span id="statePulse" class="pulse">[idle]</span>
      <span id="workspaceName" class="pulse"></span>
      <button id="modeToggle" class="mode-toggle" data-role="mode-toggle">Show Full</button>
    </div>

    <section id="compactPanel" class="card compact-panel">
      <h3>Current Focus</h3>
      <div id="compactFocus" class="compact-focus">No active goal</div>
      <ul id="compactTasks" class="compact-task-list"></ul>
      <div id="compactMoreCount" class="compact-more-count"></div>
      <div class="compact-actions">
        <button class="action compact-action" data-command="agentsync.startSession">Start Session</button>
        <button class="action compact-action" data-command="agentsync.endSession">End Session</button>
        <button class="action compact-action" data-command="agentsync.clearActiveSession">Clear Active Session</button>
        <button class="action compact-action" data-command="agentsync.openTracker">Open AgentTracker</button>
        <button class="action compact-action" data-role="compact-more-toggle">More</button>
      </div>
      <div id="compactMoreActions" class="compact-more-actions">
        <button class="action compact-action" data-command="agentsync.init">Initialize Workspace</button>
        <button class="action compact-action" data-command="agentsync.openHandoffs">Open Handoffs JSON</button>
        <button class="action compact-action" data-command="agentsync.contextCapsule">Generate Context Capsule</button>
        <button class="action compact-action" data-command="agentsync.syncAgencyRuns">Sync Agency Runs</button>
        <button class="action compact-action" data-command="agentsync.contextStatus">Context Status</button>
        <button class="action compact-action" data-command="agentsync.openTutorial">Open Interactive Tutorial</button>
        <button class="action compact-action" data-command="agentsync.refreshPanel">Refresh</button>
      </div>
    </section>

    <div id="fullPanel" class="full-panel">
      <div class="actions">
        <button class="action" data-command="agentsync.init">Initialize Workspace</button>
        <button class="action" data-command="agentsync.startSession">Start Session</button>
        <button class="action" data-command="agentsync.endSession">End Session</button>
        <button class="action" data-command="agentsync.clearActiveSession">Clear Active Session</button>
        <button class="action" data-command="agentsync.openTracker">Open AgentTracker</button>
        <button class="action" data-command="agentsync.openHandoffs">Open Handoffs JSON</button>
        <button class="action" data-command="agentsync.contextCapsule">Generate Context Capsule</button>
        <button class="action" data-command="agentsync.syncAgencyRuns">Sync Agency Runs</button>
        <button class="action" data-command="agentsync.contextStatus">Context Status</button>
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

        <section class="card" id="queuedHandoffsSection">
          <h3>Queued Handoffs</h3>
          <div id="queuedHandoffsList"></div>
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
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let pendingCommand = null;
    let lastActionAt = null;
    let currentViewMode = 'compact';
    let compactMoreOpen = false;

    const commandLabels = {
      'agentsync.init': 'Initialize Workspace',
      'agentsync.startSession': 'Start Session',
      'agentsync.endSession': 'End Session',
      'agentsync.clearActiveSession': 'Clear Active Session',
      'agentsync.openTracker': 'Open AgentTracker',
      'agentsync.openHandoffs': 'Open Handoffs JSON',
      'agentsync.contextCapsule': 'Generate Context Capsule',
      'agentsync.syncAgencyRuns': 'Sync Agency Runs',
      'agentsync.contextStatus': 'Context Status',
      'agentsync.openTutorial': 'Open Interactive Tutorial',
      'agentsync.refreshPanel': 'Refresh'
    };
    const commandColors = {
      'agentsync.init': '#4fb3ff',
      'agentsync.startSession': '#1fd678',
      'agentsync.endSession': '#ffb347',
      'agentsync.clearActiveSession': '#ff6c74',
      'agentsync.openTracker': '#8ab4ff',
      'agentsync.openHandoffs': '#8ab4ff',
      'agentsync.contextCapsule': '#7fd8ff',
      'agentsync.syncAgencyRuns': '#7ccf8a',
      'agentsync.contextStatus': '#c59cff',
      'agentsync.openTutorial': '#8ab4ff',
      'agentsync.refreshPanel': '#3dd6d0'
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

    function normalizeMode(mode) {
      return mode === 'full' ? 'full' : 'compact';
    }

    function setViewMode(mode) {
      currentViewMode = normalizeMode(mode);
      document.body.dataset.viewMode = currentViewMode;
      const toggle = byId('modeToggle');
      if (toggle) {
        toggle.textContent = currentViewMode === 'compact' ? 'Show Full' : 'Show Compact';
      }
    }

    function setCompactMoreOpen(nextOpen) {
      compactMoreOpen = Boolean(nextOpen);
      const moreActions = byId('compactMoreActions');
      if (moreActions) {
        moreActions.classList.toggle('open', compactMoreOpen);
      }
      const toggle = document.querySelector('[data-role="compact-more-toggle"]');
      if (toggle) {
        toggle.textContent = compactMoreOpen ? 'Less' : 'More';
      }
    }

    function toRgba(hex, alpha) {
      const normalized = String(hex || '').trim().replace('#', '');
      if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) {
        return 'rgba(200, 210, 216, ' + alpha + ')';
      }
      const expanded = normalized.length === 3
        ? normalized.split('').map((c) => c + c).join('')
        : normalized;
      const r = parseInt(expanded.slice(0, 2), 16);
      const g = parseInt(expanded.slice(2, 4), 16);
      const b = parseInt(expanded.slice(4, 6), 16);
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    function getCommandColor(command) {
      return commandColors[command] || '#c8d2d8';
    }

    function renderShortcuts(shortcuts) {
      const makeButton = (cmd) => {
        const btn = document.createElement('button');
        btn.className = 'action';
        btn.setAttribute('data-command', cmd);
        const fallbackLabel = cmd.includes('.') ? cmd.slice(cmd.lastIndexOf('.') + 1) : cmd;
        btn.textContent = commandLabels[cmd] || fallbackLabel;
        const color = getCommandColor(cmd);
        btn.style.setProperty('--button-color', color);
        return btn;
      };
      const compactContainer = document.querySelector('.compact-actions');
      const fullContainer = document.querySelector('.actions');
      [compactContainer, fullContainer].forEach((container) => {
        if (!container) return;
        container.innerHTML = '';
        shortcuts.forEach((cmd) => {
          const btn = makeButton(cmd);
          container.appendChild(btn);
        });
      });
    }

    function clearActiveCommandHighlight() {
      const highlighted = document.querySelectorAll('button.action.active-command, button.recovery-action.active-command');
      highlighted.forEach((button) => {
        button.classList.remove('active-command');
        button.style.removeProperty('--active-command-color');
        button.style.removeProperty('--active-command-bg');
      });
    }

    function setActiveCommandHighlight(command) {
      clearActiveCommandHighlight();
      const color = getCommandColor(command);
      const tint = toRgba(color, 0.18);
      const targets = document.querySelectorAll('[data-command="' + command + '"]');
      targets.forEach((target) => {
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('button.action, button.recovery-action')) return;
        target.classList.add('active-command');
        target.style.setProperty('--active-command-color', color);
        target.style.setProperty('--active-command-bg', tint);
      });
    }

    function formatCompactTask(value) {
      const text = String(value || '').replace(/\\s+/g, ' ').trim();
      if (!text) return '-';
      if (text.length <= 90) return text;
      return text.slice(0, 89) + '...';
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
      const actionContainers = document.querySelectorAll('.actions, .compact-actions, .compact-more-actions');
      actionContainers.forEach((container) => {
        container.classList.toggle('busy', Boolean(isBusy));
      });

      const buttons = document.querySelectorAll('button.action[data-command], button.recovery-action[data-command]');
      buttons.forEach((button) => {
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

    function renderQueuedHandoffs(handoffs) {
      const container = byId('queuedHandoffsList');
      if (!container) return;
      container.innerHTML = '';
      if (!handoffs || handoffs.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.style.cssText = 'color:var(--muted);font-size:12px;margin:4px 0;';
        empty.textContent = 'No queued handoffs assigned to you.';
        container.appendChild(empty);
        return;
      }
      handoffs.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'handoff-card';

        const summaryEl = document.createElement('div');
        summaryEl.className = 'handoff-card-summary';
        summaryEl.textContent = item.summary;
        card.appendChild(summaryEl);

        const metaEl = document.createElement('div');
        metaEl.className = 'handoff-card-meta';
        metaEl.textContent = 'From: ' + item.from_agent + ' | To: ' + item.to_agents_display + ' | Files: ' + item.files_display;
        card.appendChild(metaEl);

        if (item.recommended_model_tier) {
          const tierEl = document.createElement('span');
          tierEl.style.cssText = 'display:inline-block;padding:1px 6px;border-radius:3px;font-size:0.75em;margin-top:4px;' +
            (item.recommended_model_tier === 'lead' ? 'background:#ffb347;color:#1a1a1a;' : 'background:#3dd6d0;color:#1a1a1a;');
          tierEl.textContent = item.recommended_model_tier === 'lead' ? 'Lead Model' : 'Worker Model';
          if (item.model_justification) tierEl.title = item.model_justification;
          card.appendChild(tierEl);
        }

        if (item.stale_observation) {
          const staleEl = document.createElement('div');
          staleEl.style.cssText = 'background: #ffb347; color: #1a1a1a; padding: 2px 6px; border-radius: 3px; font-size: 0.75em; margin-top: 4px;';
          staleEl.textContent = '⚠ Context may be outdated — re-read these files';
          card.appendChild(staleEl);
        }

        if (item.notes) {
          const notesEl = document.createElement('div');
          notesEl.className = 'handoff-card-meta';
          notesEl.textContent = 'Notes: ' + item.notes;
          card.appendChild(notesEl);
        }

        const actions = document.createElement('div');
        actions.className = 'handoff-card-actions';

        const claimBtn = document.createElement('button');
        claimBtn.textContent = 'Claim';
        claimBtn.setAttribute('data-handoff-action', 'claim');
        claimBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(claimBtn);

        const startBtn = document.createElement('button');
        startBtn.textContent = 'Start';
        startBtn.setAttribute('data-handoff-action', 'start');
        startBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(startBtn);

        const skipBtn = document.createElement('button');
        skipBtn.textContent = 'Skip';
        skipBtn.setAttribute('data-handoff-action', 'skip');
        skipBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(skipBtn);

        card.appendChild(actions);
        container.appendChild(card);
      });
    }

    function renderCompactSummary(compactModel) {
      setText('compactFocus', compactModel.focusText || 'No active goal');
      const compactTasks = Array.isArray(compactModel.tasks) ? compactModel.tasks : [];
      renderList('compactTasks', compactTasks, (item) => formatCompactTask(item), 'No in-progress tasks');
      const count = Number(compactModel.extraTaskCount) || 0;
      const countEl = byId('compactMoreCount');
      if (countEl) {
        countEl.textContent = count > 0 ? '+' + count + ' more task' + (count === 1 ? '' : 's') : '';
      }
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
        setViewMode('compact');
        setCompactMoreOpen(false);
        clearActiveCommandHighlight();
        setActionsBusy(false);
        renderShortcuts([]);
        setText('stateText', 'No workspace open');
        setText('nextStep', 'Open a folder/workspace to use AgentSync.');
        setText('compactFocus', 'No workspace open');
        renderList('compactTasks', [], (item) => formatCompactTask(item), 'No in-progress tasks');
        setText('compactMoreCount', '');
        return;
      }

      setViewMode(model.ui && model.ui.viewMode);
      renderShortcuts(model.shortcuts || []);

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
      renderCompactSummary(model.compact || {});

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
      renderQueuedHandoffs(model.handoffs.queued || []);
      renderList('warningsList', model.warnings, (w) => w, 'No warnings');

      if (!pendingCommand) {
        clearActiveCommandHighlight();
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
          setActiveCommandHighlight(command);
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
          clearActiveCommandHighlight();
          setActionVisual('ok', 'Completed: ' + label, 'Action finished successfully.');
          setRecoveryVisible(false);
          return;
        }

        if (stage === 'failed') {
          pendingCommand = null;
          setActionsBusy(false);
          clearActiveCommandHighlight();
          setActionVisual('error', 'Failed: ' + label, getFailureHint(command, msg.error || ''));
          setRecoveryVisible(true);
        }
      }
    });

    document.addEventListener('click', (event) => {
      const modeToggle = event.target.closest('[data-role="mode-toggle"]');
      if (modeToggle) {
        const next = currentViewMode === 'compact' ? 'full' : 'compact';
        vscode.postMessage({ type: 'ui', action: 'setMode', mode: next });
        return;
      }

      const moreToggle = event.target.closest('[data-role="compact-more-toggle"]');
      if (moreToggle) {
        setCompactMoreOpen(!compactMoreOpen);
        return;
      }

      // Handoff card action buttons (Claim / Start / Skip)
      const handoffBtn = event.target.closest('[data-handoff-action]');
      if (handoffBtn) {
        const action = handoffBtn.getAttribute('data-handoff-action');
        const handoffId = handoffBtn.getAttribute('data-handoff-id');
        if (action && handoffId) {
          vscode.postMessage({ type: 'handoff-action', action, handoffId });
        }
        return;
      }

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

    setViewMode('compact');
    setCompactMoreOpen(false);
    vscode.postMessage({ command: 'agentsync.refreshPanel' });
  </script>
</body>
</html>`
}
/**
 * Webview provider for the animated AgentSync Live dashboard.
 */
class AgentSyncDashboardViewProvider {
  /**
   * @param {vscode.ExtensionContext} context
   */
  constructor(context) {
    this.context = context
    this.view = null
  }

  /**
   * @param {vscode.WorkspaceFolder} workspaceFolder
   * @returns {string}
   */
  getViewModeKey(workspaceFolder) {
    return `agentsync.dashboard.viewMode::${workspaceFolder.uri.fsPath}`
  }

  /**
   * @param {vscode.WorkspaceFolder} workspaceFolder
   * @returns {'compact' | 'full'}
   */
  getViewMode(workspaceFolder) {
    const key = this.getViewModeKey(workspaceFolder)
    const stored = String(this.context.workspaceState.get(key, 'compact'))
    return stored === 'full' ? 'full' : 'compact'
  }

  /**
   * @param {vscode.WorkspaceFolder} workspaceFolder
   * @param {string} mode
   * @returns {Promise<void>}
   */
  async setViewMode(workspaceFolder, mode) {
    const normalized = mode === 'full' ? 'full' : 'compact'
    const key = this.getViewModeKey(workspaceFolder)
    await this.context.workspaceState.update(key, normalized)
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
    const viewMode = this.getViewMode(workspaceFolder)
    this.view.webview.postMessage({
      type: 'model',
      model: getDashboardModel(workspaceFolder, viewMode)
    })
  }

  /**
   * @param {vscode.WebviewView} webviewView
   */
  resolveWebviewView(webviewView) {
    this.view = webviewView
    webviewView.webview.options = { enableScripts: true }
    webviewView.webview.html = getDashboardHtml()

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message?.type === 'ui' && message?.action === 'setMode') {
        const workspaceFolder = getActiveWorkspaceFolder()
        if (!workspaceFolder) return
        const mode = String(message?.mode || '')
        if (mode === 'compact' || mode === 'full') {
          await this.setViewMode(workspaceFolder, mode)
          this.refresh()
        }
        return
      }

      if (message?.type === 'handoff-action') {
        const workspaceFolder = getActiveWorkspaceFolder()
        if (!workspaceFolder) return
        await handleHandoffAction(workspaceFolder, message.action, message.handoffId, this.context)
        this.refresh()
        return
      }

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
 * Handle a handoff action (claim / start / skip) triggered from the dashboard webview.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} action
 * @param {string} handoffId
 * @param {vscode.ExtensionContext} context
 */
async function handleHandoffAction(workspaceFolder, action, handoffId, context) {
  const normalizedId = toSingleLine(handoffId)
  if (!normalizedId) return

  const state = readStateFile(workspaceFolder) || {}
  const currentAgent = state?.activeSession?.agent || state?.lastSession?.agent || ''

  if (action === 'claim') {
    const result = claimHandoffRecord(workspaceFolder, normalizedId, currentAgent)
    if (result.ok) {
      syncTrackerHandoffsSection(workspaceFolder)
      vscode.window.showInformationMessage(`AgentSync: Claimed handoff ${normalizedId}.`)
    } else {
      vscode.window.showWarningMessage(
        `AgentSync: Could not claim ${normalizedId} (${result.reason || 'unknown reason'}).`
      )
    }
  } else if (action === 'start') {
    const { handoffs } = readHandoffs(workspaceFolder)
    const handoff = handoffs.find((h) => toSingleLine(h?.handoff_id) === normalizedId)
    const goalPreFill = handoff ? toSingleLine(handoff.summary) : ''
    const result = claimHandoffRecord(workspaceFolder, normalizedId, currentAgent)
    if (result.ok) syncTrackerHandoffsSection(workspaceFolder)
    await startSession(context, { goalPreFill, agentPreFill: currentAgent })
  } else if (action === 'skip') {
    const store = readHandoffs(workspaceFolder)
    const now = new Date().toISOString()
    const updated = store.handoffs.map((h) => {
      if (toSingleLine(h?.handoff_id) !== normalizedId) return h
      return {
        ...h,
        status: 'blocked',
        updated_at: now,
        state_history: [
          ...(Array.isArray(h.state_history) ? h.state_history : []),
          {
            status: 'blocked',
            agent: canonicalAgentId(currentAgent),
            timestamp: now,
            reason: 'skipped via dashboard'
          }
        ]
      }
    })
    writeHandoffs(workspaceFolder, { version: 1, handoffs: updated })
    syncTrackerHandoffsSection(workspaceFolder)
    vscode.window.showInformationMessage(`AgentSync: Handoff ${normalizedId} marked as skipped.`)
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
    const currentAgentId = canonicalAgentId(
      state?.activeSession?.agent || state?.lastSession?.agent
    )

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
        `Active session: ${state?.sessionActive ? state?.activeSession?.agent || 'Unknown' : 'None'}`,
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
          'Open Interactive Tutorial',
          'agentsync.openTutorial',
          'mortar-board',
          'Open guided onboarding in Getting Started'
        )
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
        tooltip: [`owners: ${owners || '(none)'}`, `mode: ${h?.owner_mode || 'unknown'}`].join(
          '\n'
        ),
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
    // Prefer state.json lastSession fields for display; fall back to parsed tracker.
    const displayAgent = state?.lastSession?.agent || tracker.agent
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
  const handoffs = listHandoffRecords(workspaceFolder)
  const openCount = handoffs.filter((h) => isOpenHandoff(h)).length
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

  const queued = listHandoffRecords(workspaceFolder).filter(
    (h) => String(h?.status || '').toLowerCase() === 'queued'
  )
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

  const candidates = listHandoffRecords(workspaceFolder).filter((h) =>
    OPEN_HANDOFF_STATUSES.has(String(h?.status || '').toLowerCase())
  )
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

  const result = completeHandoffRecord(
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
    result = await endSessionCore(workspaceFolder, agent, summary, nextWork, handoffData, {
      hotFiles: precomputedHotFiles,
      healthResults: precomputedHealth,
      healthOutputs: precomputedHealthOutputs,
      summarySource,
      automationUsed,
      automationContext,
      goalHint
    })
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
          `AgentSync: ${state.activeSession.agent}'s session in "${folder.name}" has been running for ${ageLabel}. Time to wrap up?`,
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

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // â”€â”€ Status bar â”€â”€
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  statusItem.command = 'agentsync.openDashboard'
  updateStatusBar(statusItem)

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
  agencyEventsWatcher.onDidChange((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)))
  agencyEventsWatcher.onDidCreate((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)))
  agencyEventsWatcher.onDidDelete((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)))

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
        'AgentSync: Could not open the interactive tutorial. Open "Getting Started" and select AgentSync.'
      )
    }
  })
  const openHandoffsCmd = vscode.commands.registerCommand('agentsync.openHandoffs', () =>
    openHandoffs()
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
    if (state?.sessionActive && state?.activeSession?.startedAt) {
      const started = parseISODate(state.activeSession.startedAt)
      if (Number.isFinite(started)) {
        sessionDuration = formatElapsed(Date.now() - started)
      }
    }

    const lines = [
      `Session: ${state?.sessionActive ? 'Active (' + sessionDuration + ')' : 'Inactive'}`,
      `Hot files: ${hotFiles.length}`,
      `In-progress items: ${inProgressLines.length}`,
      `Open handoffs: ${openHandoffs}`,
      `Diff: ${filesChanged} file(s), +${insertions} -${deletions}`,
      `Estimated complexity: ${complexity}`
    ]

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
    openHandoffsCmd,
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
    refreshCmd
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
    validateHandoff,
    getOperationalState,
    formatElapsed,
    scoreNextTaskCapabilities,
    normalizeHandoffStatus,
    createHandoffRecord,
    claimHandoffRecord,
    completeHandoffRecord,
    listHandoffRecords,
    syncAgencyRunsCore,
    generateContextCapsule,
    processDropZoneRequest
  }
}
