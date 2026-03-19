'use strict'

const fs = require('fs')
const { workspace, window } = require('vscode')
const { getConfigPath } = require('./paths')
const {
  canonicalAgentId,
  DEFAULT_STALE_HOURS,
  DEFAULT_END_SESSION_ZERO_TOUCH,
  DEFAULT_HANDOFF_ROUTING_DEFAULTS,
  DEFAULT_EXECUTION_CHANNELS_CONFIG
} = require('./constants')
const { atomicWriteFileSync } = require('./io')

/**
 * Get active workspace folder without showing prompts.
 */
function getActiveWorkspaceFolder() {
  const activeUri = window.activeTextEditor?.document?.uri
  if (activeUri) {
    const activeFolder = workspace.getWorkspaceFolder(activeUri)
    if (activeFolder) return activeFolder
  }

  return workspace.workspaceFolders?.[0] ?? null
}

/**
 * Resolve a workspace folder for a command invocation.
 */
async function resolveWorkspaceFolder(options = {}) {
  const { allowPick = true } = options
  const folders = workspace.workspaceFolders
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

  const selected = await window.showQuickPick(picks, {
    placeHolder: 'Select a workspace folder for AgentSync'
  })

  return selected?.folder ?? null
}

/**
 * Format text prefix for multi-root workspaces.
 */
function getWorkspaceLabelPrefix(workspaceFolder) {
  const folders = workspace.workspaceFolders
  if (!folders || folders.length <= 1) return ''
  return `[${workspaceFolder.name}] `
}

/**
 * Read optional AgentSync configuration merged from VS Code settings and defaults.
 */
function readAgentSyncConfig(workspaceFolder) {
  const settings = workspace.getConfiguration('agentsync', workspaceFolder?.uri)
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
      ? route.to_agents.map((agent) => canonicalAgentId(agent)).filter(Boolean)
      : []
    const requiredCapabilities = Array.isArray(route.required_capabilities)
      ? route.required_capabilities.map((cap) => String(cap || '').trim()).filter(Boolean)
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
          ? def.models.map((model) => String(model).trim()).filter(Boolean)
          : [],
        useCases: Array.isArray(def?.useCases)
          ? def.useCases.map((useCase) => String(useCase).trim()).filter(Boolean)
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
    sessionDurationWarningMinutes: 0,
    executionChannels: { ...DEFAULT_EXECUTION_CHANNELS_CONFIG },
    agentCatalog: null
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
      sessionDurationWarningMinutes: toNumber(parsed.sessionDurationWarningMinutes, 0),
      executionChannels:
        parsed.executionChannels && typeof parsed.executionChannels === 'object'
          ? parsed.executionChannels
          : { ...DEFAULT_EXECUTION_CHANNELS_CONFIG },
      agentCatalog:
        parsed.agentCatalog && typeof parsed.agentCatalog === 'object'
          ? parsed.agentCatalog
          : null
    }
  } catch {
    return defaults
  }
}

/**
 * Persist structured configuration to .agentsync.json.
 */
function writeConfigFile(workspaceFolder, data) {
  const configPath = getConfigPath(workspaceFolder)
  atomicWriteFileSync(configPath, JSON.stringify(data, null, 2))
}

module.exports = {
  getActiveWorkspaceFolder,
  resolveWorkspaceFolder,
  getWorkspaceLabelPrefix,
  readAgentSyncConfig,
  writeConfigFile
}
