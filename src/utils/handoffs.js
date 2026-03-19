const {
  OPEN_HANDOFF_STATUSES,
} = require('./constants')
const {
  canonicalAgentId,
  toSingleLine
} = require('./text')
const {
  readHandoffs,
  writeHandoffs,
  readTracker,
  writeTracker
} = require('./storage')
const { setSectionBody } = require('./text')

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
 * Open statuses that still need action.
 */
function isOpenHandoff(handoff) {
  return OPEN_HANDOFF_STATUSES.has(String(handoff?.status || '').toLowerCase())
}

/**
 * Validate a handoff record against internal integrity rules.
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
    if (toAgents.length !== 2) {
      errors.push('owner_mode "shared" requires exactly 2 to_agents entries')
    }
  } else if (mode === 'auto') {
    const caps = Array.isArray(handoff.required_capabilities) ? handoff.required_capabilities : []
    if (caps.length === 0) {
      errors.push('owner_mode "auto" requires at least one required_capabilities entry')
    }
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
 * Normalize a handoff status.
 */
function normalizeHandoffStatus(status, fallback = 'queued') {
  const normalized = String(status || '').toLowerCase().trim()
  if (HANDOFF_ALLOWED_STATUSES.has(normalized)) return normalized
  return fallback
}

/**
 * Build a unique HO-YYYYMMDD-### id.
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
 * Create and persist a handoff record.
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

  // Auto-advance chain if this handoff is part of a pipeline
  advanceChainOnCompletion(workspaceFolder, normalizedId)

  return { ok: true, handoffId: normalizedId, status: nextStatus }
}

/**
 * Auto-advance the chain when a handoff is completed.
 */
function advanceChainOnCompletion(workspaceFolder, completedHandoffId) {
  const store = readHandoffs(workspaceFolder)
  const completed = store.handoffs.find(
    (h) => toSingleLine(h?.handoff_id) === toSingleLine(completedHandoffId)
  )
  if (!completed || !completed.chain_id) return

  const completedStatus = String(completed.status || '').toLowerCase()
  const isTerminal = completedStatus === 'merged' || completedStatus === 'approved' ||
    completedStatus === 'ready_for_review'
  if (!isTerminal) return

  const nextStep = completed.chain_step + 1
  const nextHandoff = store.handoffs.find(
    (h) =>
      h.chain_id === completed.chain_id &&
      h.chain_step === nextStep &&
      String(h.status || '').toLowerCase() === 'blocked'
  )
  if (!nextHandoff) return

  const now = new Date().toISOString()
  nextHandoff.status = 'queued'
  nextHandoff.updated_at = now
  nextHandoff.notes = (nextHandoff.notes || '') +
    ' | Previous step completed: ' + toSingleLine(completed.summary || '')
  if (!Array.isArray(nextHandoff.state_history)) nextHandoff.state_history = []
  nextHandoff.state_history.push({
    status: 'queued',
    agent: 'system',
    timestamp: now,
    reason: 'chain auto-advance from ' + completedHandoffId
  })

  writeHandoffs(workspaceFolder, { version: 1, handoffs: store.handoffs })
  syncTrackerHandoffsSection(workspaceFolder)
}

/**
 * Claim an unassigned handoff for the current provider identity.
 */
function claimHandoffRecord(workspaceFolder, handoffId, agentId) {
  const store = readHandoffs(workspaceFolder)
  const now = new Date().toISOString()
  const normalizedId = toSingleLine(handoffId)
  const canonical = canonicalAgentId(agentId)
  if (!normalizedId) return { ok: false, success: false, reason: 'missing_handoff_id' }
  if (!canonical) return { ok: false, success: false, reason: 'missing_agent' }

  let result = { ok: false, success: false, reason: 'not_found' }
  const updated = store.handoffs.map((handoff) => {
    if (toSingleLine(handoff?.handoff_id) !== normalizedId) return handoff

    const currentStatus = String(handoff?.status || '').toLowerCase()
    const owners = getHandoffOwners(handoff)
    const lastClaim =
      Array.isArray(handoff?.state_history) && handoff.state_history.length > 0
        ? handoff.state_history[handoff.state_history.length - 1]
        : null
    const claimedBy = lastClaim?.agent ? canonicalAgentId(lastClaim.agent) : null

    if (currentStatus === 'in_progress') {
      result = { ok: false, success: false, reason: 'already_claimed', claimedBy }
      return handoff
    }
    if (currentStatus !== 'queued') {
      result = {
        ok: false,
        success: false,
        reason: 'not_claimable',
        status: currentStatus || 'unknown'
      }
      return handoff
    }
    if (owners.length > 0 && !owners.includes(canonical)) {
      result = { ok: false, success: false, reason: 'not_assigned' }
      return handoff
    }

    result = { ok: true, success: true, handoffId: normalizedId }
    return {
      ...handoff,
      status: 'in_progress',
      updated_at: now,
      state_history: [
        ...(Array.isArray(handoff.state_history) ? handoff.state_history : []),
        {
          status: 'in_progress',
          agent: canonical,
          timestamp: now,
          reason: 'claimed via agentsync'
        }
      ]
    }
  })

  if (!result.ok) return result

  const claimedRecord = updated.find((handoff) => toSingleLine(handoff?.handoff_id) === normalizedId)
  if (claimedRecord) {
    const validation = validateHandoff(claimedRecord)
    if (!validation.valid) {
      return { ok: false, success: false, reason: 'invalid_handoff', errors: validation.errors }
    }
  }

  writeHandoffs(workspaceFolder, { version: 1, handoffs: updated })
  return result
}

/**
 * Synchronize the tracker file's handoff section with current store state.
 */
function syncTrackerHandoffsSection(workspaceFolder) {
  const content = readTracker(workspaceFolder)
  if (!content) return

  const { handoffs } = readHandoffs(workspaceFolder)
  const updated = setSectionBody(
    content,
    'Agent Handoffs',
    renderTrackerHandoffsSection(handoffs)
  )
  writeTracker(workspaceFolder, updated)
}

/**
 * Render the ## Agent Handoffs section body for AgentTracker.md.
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

/**
 * Read all handoff records.
 */
function listHandoffRecords(workspaceFolder) {
  const store = readHandoffs(workspaceFolder)
  return store.handoffs
}

/**
 * Group handoffs into actionable buckets for UI.
 */
function getHandoffOwners(handoff) {
  const owners = Array.isArray(handoff?.to_agents)
    ? handoff.to_agents.map((agent) => canonicalAgentId(agent)).filter(Boolean)
    : []
  const personalityId = canonicalAgentId(
    handoff?.agent_personality_id || handoff?.suggested_agent_personality_id || ''
  )
  const isLegacyPipelineAssignment =
    Boolean(handoff?.chain_id) &&
    Boolean(personalityId) &&
    owners.length === 1 &&
    owners[0] === personalityId
  if (isLegacyPipelineAssignment) return []
  return owners
}

function isProviderFlexHandoff(handoff) {
  return getHandoffOwners(handoff).length === 0
}

function getHandoffPersonalityId(handoff) {
  return canonicalAgentId(
    handoff?.agent_personality_id || handoff?.suggested_agent_personality_id || ''
  )
}

function getHandoffBuckets(handoffs, currentAgentId, staleAfterHours) {
  const now = Date.now()
  const staleMs = staleAfterHours * 60 * 60 * 1000
  const isMine = (h) => {
    const owners = getHandoffOwners(h)
    return owners.includes(currentAgentId)
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
  const runnable = open.filter((h) => {
    if (String(h?.status || '').toLowerCase() !== 'queued') return false
    return isProviderFlexHandoff(h) || !currentAgentId || isMine(h)
  })
  const blockedOrStale = open.filter(
    (h) => String(h?.status || '').toLowerCase() === 'blocked' || isStale(h)
  )

  return { open, assignedToMe, sharedWithMe, blockedOrStale, runnable }
}

/**
 * Helper for commands that need to suggest an immediate next task.
 */
function listRunnableQueuedHandoffs(workspaceFolder, currentAgentId, staleHours = 24) {
  const { handoffs } = readHandoffs(workspaceFolder)
  if (!Array.isArray(handoffs)) return []

  const buckets = getHandoffBuckets(handoffs, currentAgentId, staleHours)
  return buckets.runnable
}

module.exports = {
  isOpenHandoff,
  validateHandoff,
  normalizeHandoffStatus,
  buildHandoffId,
  createHandoffRecord,
  completeHandoffRecord,
  claimHandoffRecord,
  advanceChainOnCompletion,
  syncTrackerHandoffsSection,
  renderTrackerHandoffsSection,
  listHandoffRecords,
  getHandoffOwners,
  isProviderFlexHandoff,
  getHandoffPersonalityId,
  getHandoffBuckets,
  listRunnableQueuedHandoffs
}
