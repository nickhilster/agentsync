'use strict'

const { PLACEHOLDER, DEFAULT_HANDOFF_ROUTING_DEFAULTS } = require('./constants')
const { toSingleLine, canonicalAgentId } = require('./text')

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
 * Generate a concise, objective summary of session work based on system state.
 */
function buildDeterministicSessionSummary({ goal, hotFiles, health, maxSummaryLength }) {
  const normalizedGoal = toSingleLine(goal) || 'session update'
  const filePart = hotFiles.length > 0 ? `mod ${hotFiles.length} files` : 'no file changes'
  const passCount = Object.values(health).filter((status) => status === 'Pass').length
  const failCount = Object.values(health).filter((status) => status === 'Fail').length
  const healthPart = failCount > 0 ? `(${failCount} fails)` : `(${passCount} pass)`

  const summary = `Goal: ${normalizedGoal} | ${filePart} | health: ${healthPart}`
  if (maxSummaryLength && summary.length > maxSummaryLength) {
    return summary.slice(0, maxSummaryLength - 3) + '...'
  }
  return summary
}

/**
 * Map source agent activity to default handoff routing logic from config.
 */
function resolveAutomationRoute(config, sourceAgentLabel) {
  const agentId = canonicalAgentId(sourceAgentLabel)
  if (!agentId) return null

  const route = config?.automation?.handoffRoutingDefaults?.[agentId]
  const candidate = route && typeof route === 'object' ? route : DEFAULT_HANDOFF_ROUTING_DEFAULTS[agentId]
  if (!candidate || typeof candidate !== 'object') return null

  const ownerMode = String(candidate.owner_mode || '').toLowerCase()
  const toAgents = Array.isArray(candidate.to_agents)
    ? candidate.to_agents.map((agent) => canonicalAgentId(agent)).filter(Boolean)
    : []
  const requiredCapabilities = Array.isArray(candidate.required_capabilities)
    ? candidate.required_capabilities.map((cap) => toSingleLine(cap)).filter(Boolean)
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
 * Build concise notes for automated handoffs.
 */
function buildAutomationHandoffNotes({ summary, hotFiles, health, sourceAgent }) {
  const normalizedSummary = toSingleLine(summary)
  const normalizedSourceAgent = canonicalAgentId(sourceAgent) || 'unknown'
  const topFiles = Array.isArray(hotFiles) ? hotFiles.slice(0, 2).join(', ') || 'none' : 'none'
  const healthCounts = summarizeHealthCounts(health || {})
  return toSingleLine(
    `Auto-drafted from ${normalizedSourceAgent}. Goal: ${normalizedSummary}. Start with files: ${topFiles}. Health pass:${healthCounts.pass} fail:${healthCounts.fail} n/a:${healthCounts.notConfigured}.`
  )
}

/**
 * Build one-line handoff prompts for downstream agents.
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

  const modelTier = handoffRecord.recommended_model_tier || null
  const modelJustification = toSingleLine(handoffRecord.model_justification || '')
  let modelSuffix = ''
  if (modelTier === 'worker') {
    modelSuffix = ' [Worker-tier task: use a lighter model]'
  } else if (modelTier === 'lead') {
    modelSuffix = ' [Lead-tier task: use a capable model'
    if (modelJustification) modelSuffix += ' - ' + modelJustification
    modelSuffix += ']'
  }

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
      ? handoffRecord.required_capabilities.map((cap) => toSingleLine(cap)).filter(Boolean)
      : []
    const capabilityLabel =
      caps.length > 0 ? `capabilities ${caps.join(', ')}` : 'required capabilities'
    return [buildLine(capabilityLabel)]
  }

  const targets = Array.isArray(handoffRecord.to_agents)
    ? handoffRecord.to_agents.map((agent) => canonicalAgentId(agent)).filter(Boolean)
    : []
  if (targets.length === 0) return [buildLine('next owner')]
  return targets.map((target) => buildLine(target))
}

module.exports = {
  buildDeterministicSessionSummary,
  resolveAutomationRoute,
  buildAutomationHandoffNotes,
  buildHandoffPromptLines
}
