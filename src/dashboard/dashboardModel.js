'use strict'

// â”€â”€â”€ Imports â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const {
  getWorkspaceSnapshot,
  getHotFilesCached,
  getTrackerWarnings,
  normalizeRepoRelativePath,
  isEmptyValue,
  parseISODate,
  formatElapsed,
  getAgentCatalog,
  AGENT_CATEGORY_COLORS,
  DEFAULT_STALE_HOURS
} = require('../utils')

const {
  getSessionProviderInfo
} = require('../session/providers')

const {
  getSessionPersonalityInfo,
  getPersonalityDisplayName
} = require('../session/personalities')

const {
  getHandoffBuckets,
  getOperationalState,
  getStatePulseFrame,
  getHandoffOwners,
  getHandoffPersonalityId
} = require('../session/state')

/**
 * Build the data model for the AgentSync Live dashboard.
 */
function getDashboardModel(workspaceFolder, viewMode = 'compact') {
  const snapshot = getWorkspaceSnapshot(workspaceFolder)
  const trackerContent = snapshot.trackerContent
  const tracker = snapshot.tracker
  const state = snapshot.state
  const config = snapshot.config
  const handoffInfo = snapshot.handoffInfo
  const inProgressLines = snapshot.inProgressLines
  const currentProvider = getSessionProviderInfo(
    state?.activeSession || state?.lastSession || null,
    tracker.agent
  )
  const activePersonality = getSessionPersonalityInfo(workspaceFolder, state?.activeSession || null)
  const staleAfterHours = Number(config.staleAfterHours) || DEFAULT_STALE_HOURS
  const handoffBuckets = getHandoffBuckets(handoffInfo.handoffs, currentProvider.id, staleAfterHours)
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
  const health = state?.health || {}
  const healthLabels = ['Build', 'Tests', 'Deploy']
  const missingHealthChecks = healthLabels.filter((label) => {
    const status = String(health?.[label]?.status ?? health?.[label] ?? 'Not configured')
    return status === 'Not configured'
  })
  if (missingHealthChecks.length > 0) {
    warnings.push(
      `Setup needed: ${missingHealthChecks.join(', ')} checks are not configured.`
    )
  }
  const hotFiles = new Set(getHotFilesCached(workspaceFolder).map(normalizeRepoRelativePath))
  const getSuggestedNextStep = () => {
    if (!trackerContent) return 'Run "Initialize Workspace" to set up AgentSync files.'
    if (state?.sessionActive)
      return 'Use "End Session" when you are done, or "Clear Active Session" if stale.'
    if (handoffBuckets.runnable.length > 0)
      return 'Use "Run Next Step" to claim the next runnable handoff and prepare its prompt.'
    if (inProgressLines.length > 0)
      return 'Review in-progress items, then start a new session to continue.'
    if (handoffBuckets.open.length > 0)
      return 'Review blocked or provider-specific handoffs, then unblock or complete the earlier step.'
    if (missingHealthChecks.length > 0)
      return 'Configure build/test/deploy commands to unlock health reporting on End Session.'
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

  const summarizeHandoff = (h) => ({
    id: String(h?.handoff_id || h?.task_id || 'unknown'),
    summary: String(h?.summary || h?.task_id || 'No summary'),
    status: String(h?.status || 'queued'),
    mode: String(h?.owner_mode || 'unknown'),
    owners: getHandoffOwners(h)
  })
  // Full card data for interactive dashboard actions (Claim / Start / Skip)
  const summarizeHandoffCard = (h, stale = false) => {
    const files = Array.isArray(h?.files) ? h.files : []
    const toAgents = getHandoffOwners(h)
    const personalityId = getHandoffPersonalityId(h)
    const personalityName = getPersonalityDisplayName(workspaceFolder, personalityId)
    return {
      id: String(h?.handoff_id || h?.task_id || 'unknown'),
      summary: String(h?.summary || 'No summary'),
      from_agent: String(h?.from_agent || 'unknown'),
      to_agents_display: toAgents.join(', ') || 'provider-flex',
      files_display:
        files.length > 3
          ? files.slice(0, 3).join(', ') + ' (+' + (files.length - 3) + ' more)'
          : files.join(', ') || 'none',
      status: String(h?.status || 'queued'),
      notes: String(h?.notes || ''),
      personality: personalityName || personalityId || 'Auto',
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
    'agentsync.runNextStep',
    'agentsync.endSession',
    'agentsync.openTracker',
    'agentsync.contextStatus'
  ]
  const shortcutsBase =
    Array.isArray(config.dashboardShortcuts) && config.dashboardShortcuts.length > 0
      ? config.dashboardShortcuts
      : defaultShortcuts
  const shortcuts = shortcutsBase.includes('agentsync.runNextStep')
    ? shortcutsBase
    : [shortcutsBase[0] || 'agentsync.startSession', 'agentsync.runNextStep', ...shortcutsBase.slice(1)]

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
      provider: state?.sessionActive ? currentProvider.label : 'None',
      personality: state?.sessionActive ? activePersonality.name : 'None',
      goal: state?.activeSession?.goal || 'No active goal',
      startedAt: state?.activeSession?.startedAt || null
    },
    tracker: {
      lastAgent: state?.lastSession?.provider_label || state?.lastSession?.agent || tracker.agent,
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
      queued: handoffBuckets.runnable
        .slice(0, 10)
        .map((h) => {
          const isStale = (h.files || []).some((file) =>
            hotFiles.has(normalizeRepoRelativePath(file))
          )
          return summarizeHandoffCard(h, isStale)
        })
    },
    agentCatalog: (() => {
      try {
        const catalog = getAgentCatalog(workspaceFolder)
        if (!catalog) return { loaded: false, totalAgents: 0, categories: [] }
        const catSummary = catalog.categories.map((cat) => ({
          name: cat,
          color: AGENT_CATEGORY_COLORS[cat] || '#888',
          count: catalog.agents.filter((a) => a.category === cat).length
        }))
        return { loaded: true, totalAgents: catalog.agents.length, categories: catSummary }
      } catch {
        return { loaded: false, totalAgents: 0, categories: [] }
      }
    })(),
    pipelines: (() => {
      const chains = new Map()
      for (const h of handoffInfo.handoffs) {
        if (!h.chain_id) continue
        if (!chains.has(h.chain_id)) chains.set(h.chain_id, [])
        chains.get(h.chain_id).push(h)
      }
      return Array.from(chains.entries()).map(([chainId, steps]) => {
          steps.sort((a, b) => (a.chain_step || 0) - (b.chain_step || 0))
          return {
            chainId,
            total: steps[0]?.chain_total || steps.length,
            steps: steps.map((s) => ({
              step: s.chain_step || 0,
              agentName:
                getPersonalityDisplayName(workspaceFolder, getHandoffPersonalityId(s)) ||
                getHandoffPersonalityId(s) ||
                'Auto',
              status: String(s.status || 'blocked'),
              handoffId: String(s.handoff_id || ''),
              summary: String(s.summary || '')
            }))
          }
      })
    })()
  }
}

module.exports = { getDashboardModel }
