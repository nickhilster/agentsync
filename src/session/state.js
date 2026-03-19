'use strict'

const {
  OPEN_HANDOFF_STATUSES,
  canonicalAgentId,
  parseISODate,
  formatElapsed
} = require('../utils')

/**
 * Determine if a session is stale.
 */
function getSessionStaleInfo(state, autoStaleSessionMinutes = 0) {
  if (!state?.sessionActive || !state?.activeSession?.startedAt) {
    return { isStale: false, ageMs: null, thresholdMs: null }
  }

  if (!Number.isFinite(autoStaleSessionMinutes) || autoStaleSessionMinutes <= 0) {
    return { isStale: false, ageMs: null, thresholdMs: null }
  }

  const started = parseISODate(state.activeSession.startedAt)
  if (!Number.isFinite(started)) {
    return { isStale: false, ageMs: null, thresholdMs: autoStaleSessionMinutes * 60 * 1000 }
  }

  const ageMs = Date.now() - started
  const thresholdMs = autoStaleSessionMinutes * 60 * 1000
  return { isStale: ageMs >= thresholdMs, ageMs, thresholdMs }
}

/**
 * Determine operational state for panel/status presentation.
 */
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
 */
function isOpenHandoff(handoff) {
  return OPEN_HANDOFF_STATUSES.has(String(handoff?.status || '').toLowerCase())
}

/**
 * Get owners defined on a handoff record.
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

/**
 * Determine if handoff has no explicit owners.
 */
function isProviderFlexHandoff(handoff) {
  return getHandoffOwners(handoff).length === 0
}

/**
 * Extract personality ID from handoff record.
 */
function getHandoffPersonalityId(handoff) {
  return canonicalAgentId(
    handoff?.agent_personality_id || handoff?.suggested_agent_personality_id || ''
  )
}

/**
 * Group handoffs into actionable buckets for UI.
 */
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

module.exports = {
  getSessionStaleInfo,
  getOperationalState,
  getStatePulseFrame,
  isOpenHandoff,
  getHandoffOwners,
  isProviderFlexHandoff,
  getHandoffPersonalityId,
  getHandoffBuckets
}
