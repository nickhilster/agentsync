'use strict'

const {
  readTracker,
  writeTracker,
  readStateFile,
  writeStateFile,
  readHandoffs,
  writeHandoffs,
  readAgentSyncConfig,
  runGit,
  detectSignatureChanges,
  scoreNextTaskCapabilities,
  PLACEHOLDER,
  DEFAULT_END_SESSION_ZERO_TOUCH,
  getHotFilesCached,
  toSingleLine,
  parseISODate,
  isEmptyValue,
  parseTracker,
  getSectionBody,
  setSectionBody,
  canonicalAgentId,
  getAgentCatalog,
  matchAgentsByCapabilities,
  buildHandoffPromptLines,
  renderTrackerHandoffsSection,
  removePersonalityFromWorkspace,
  formatHealthTable,
  isOpenHandoff,
  buildSessionIdentity,
  validateHandoff,
  runHealthChecks,
  buildDeterministicSessionSummary,
  resolveAutomationRoute,
  buildAutomationHandoffNotes
} = require('../utils')

/**
 * Persist an active session in AgentTracker.md and write state.json.
 */
function startSessionCore(workspaceFolder, agent, goal, options = {}) {
  const content = readTracker(workspaceFolder)
  if (!content) throw new Error('Could not read AgentTracker.md')

  const existingTracker = parseTracker(content)
  const normalizedGoal = (goal || '').trim() || 'Session started'
  const startedAt = new Date().toISOString()
  const sessionIdentity = buildSessionIdentity(workspaceFolder, agent, options)
  const entry = `- [ ] ${sessionIdentity.provider_label} (${startedAt}): ${normalizedGoal}`

  const currentBody = getSectionBody(content, 'In Progress')
  const currentLines = currentBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('<!--'))
    .filter((line) => line && line.toLowerCase() !== '*nothing active*')

  const updatedBody = [...currentLines, entry].join('\n')
  const updated = setSectionBody(content, 'In Progress', updatedBody || '*Nothing active*')
  writeTracker(workspaceFolder, updated)

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
    lastUpdated: startedAt,
    activeSession: {
      ...sessionIdentity,
      goal: normalizedGoal,
      startedAt
    },
    sessionMetrics: {
      filesOpened: 0,
      filesModified: 0,
      commandsRun: 0,
      startedAt
    },
    lastSession,
    hotFiles: [],
    inProgress: updatedInProgressLines
  })

  return { agent: sessionIdentity.provider_label, goal: normalizedGoal }
}

/**
 * Record a session end in AgentTracker.md and write state.json.
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

  let handoffRecord = null
  let generatedPromptLines = []
  if (handoffData !== null) {
    const existingHandoffs = readHandoffs(workspaceFolder)
    const allHandoffs = existingHandoffs.handoffs
    const dateStr = now.slice(0, 10).replace(/-/g, '')
    const seq = String(allHandoffs.length + 1).padStart(3, '0')
    const handoffId = 'HO-' + dateStr + '-' + seq

    if (handoffData.no_handoff_reason) {
      const skipReason = String(handoffData.no_handoff_reason).trim()
      if (!skipReason) throw new Error('no_handoff_reason must be a non-empty string')

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
      const modelTier = handoffData.recommended_model_tier || null
      const modelJustification = handoffData.model_justification || null
      const contextHints = handoffData.context_hints || null

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
        agent_personality_id: handoffData.agent_personality_id || null,
        suggested_agent_personality_id: null,
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

    if (handoffRecord && !handoffRecord.suggested_agent_personality_id && !handoffRecord.no_handoff_reason) {
      try {
        const catalog = getAgentCatalog(workspaceFolder)
        if (catalog && catalog.agents.length > 0) {
          const caps = handoffRecord.required_capabilities || complexityInfo.capabilities || []
          const matched = matchAgentsByCapabilities(catalog.agents, caps)
          if (matched.length > 0) {
            handoffRecord.suggested_agent_personality_id = matched[0].id
          }
        }
      } catch {
        // Non-fatal
      }
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
    const existingHandoffs = readHandoffs(workspaceFolder)
    if (existingHandoffs.handoffs.length > 0) {
      content = setSectionBody(
        content,
        'Agent Handoffs',
        renderTrackerHandoffsSection(existingHandoffs.handoffs)
      )
    }
  }

  writeTracker(workspaceFolder, content)

  const currentHandoffs = readHandoffs(workspaceFolder)
  const openHandoffs = currentHandoffs.handoffs.filter(isOpenHandoff)
  const shouldWriteAutomationState =
    automationFeatureEnabled &&
    (automationUsed || summarySource === 'deterministic' || generatedPromptLines.length > 0)
  const existingMetrics = readStateFile(workspaceFolder)?.sessionMetrics || {}
  const existingState = readStateFile(workspaceFolder) || {}
  const activeSessionIdentity = buildSessionIdentity(
    workspaceFolder,
    agent,
    existingState?.activeSession || {}
  )
  const stateLastSession = {
    ...activeSessionIdentity,
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

  try {
    removePersonalityFromWorkspace(workspaceFolder.uri.fsPath)
  } catch {
    // Non-fatal
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
 */
function clearActiveSessionCore(workspaceFolder) {
  const existingState = readStateFile(workspaceFolder)
  if (!existingState?.sessionActive || !existingState?.activeSession) {
    return { cleared: false, agent: null }
  }

  const agent = String(existingState.activeSession.agent || '').trim() || null
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
    ...existingState,
    sessionActive: false,
    activeSession: null,
    lastUpdated: new Date().toISOString()
  })

  return { cleared: true, agent }
}

module.exports = {
  startSessionCore,
  endSessionCore,
  clearActiveSessionCore
}
