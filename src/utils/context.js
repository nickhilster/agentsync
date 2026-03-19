'use strict'

const fs = require('fs')
const { getHotFilesCached } = require('./git')
const { getAgentSyncDir, getContextCapsulePath } = require('./paths')
const { atomicWriteFileSync } = require('./io')
const { getWorkspaceSnapshot, invalidateWorkspaceCaches } = require('./workspaceSnapshot')
const { getTrackerWarnings } = require('./trackerWarnings')
const { PLACEHOLDER, DEFAULT_STALE_HOURS } = require('./constants')
const { getSessionProviderInfo } = require('../session/providers')
const { getHandoffBuckets, getOperationalState } = require('../session/state')

/**
 * Build and persist a deterministic context capsule for downstream agents.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
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
  const currentProviderId = getSessionProviderInfo(
    state?.activeSession || state?.lastSession || null,
    tracker.agent
  ).id
  const handoffBuckets = getHandoffBuckets(handoffInfo.handoffs, currentProviderId, staleAfterHours)
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

module.exports = { generateContextCapsule }
