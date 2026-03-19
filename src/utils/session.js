'use strict'

const { canonicalAgentId } = require('./text')
const { getExecutionProviderId, getExecutionProviderLabel } = require('../session/providers')
const { getPersonalityDisplayName } = require('../session/personalities')

/**
 * Determine deterministic identity for a session based on folder or explicit label.
 */
function buildSessionIdentity(workspaceFolder, providerLabel, options = {}) {
  const providerId = getExecutionProviderId(options.providerId || providerLabel)
  const providerDisplay =
    getExecutionProviderLabel(options.providerLabel || providerLabel) || 'Unknown'
  const personalityId = canonicalAgentId(options.personalityId || '')
  const personalityName =
    String(options.personalityName || '').trim() ||
    getPersonalityDisplayName(workspaceFolder, personalityId) ||
    null

  return {
    provider_id: providerId,
    provider_label: providerDisplay,
    personality_id: personalityId,
    personality_name: personalityName,
    // Legacy field retained for backward-compatible readers.
    agent: providerDisplay
  }
}

/**
 * Identify workspace health checks from config to populate tracker Current Health.
 */
function detectWorkspaceHealth(config) {
  return {
    Build: config.commands?.build ? 'Pending' : 'Not configured',
    Tests: (config.commands?.test || config.commands?.tests) ? 'Pending' : 'Not configured',
    Deploy: config.commands?.deploy ? 'Pending' : 'Not configured'
  }
}

module.exports = {
  buildSessionIdentity,
  detectWorkspaceHealth
}
