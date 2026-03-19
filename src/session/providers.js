'use strict'

const { canonicalAgentId } = require('../utils')

const EXECUTION_PROVIDER_DEFS = Object.freeze([
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'copilot', label: 'Copilot' }
])

const EXECUTION_PROVIDER_BY_ID = Object.freeze(
  Object.fromEntries(EXECUTION_PROVIDER_DEFS.map((provider) => [provider.id, provider]))
)

function getExecutionProvider(value) {
  const norm = String(value || '').trim().toLowerCase()
  if (!norm) return null
  const byId = EXECUTION_PROVIDER_BY_ID[norm]
  if (byId) return byId
  return EXECUTION_PROVIDER_DEFS.find((p) => p.label.toLowerCase() === norm) || null
}

function getExecutionProviderId(value) {
  return getExecutionProvider(value)?.id || null
}

function getExecutionProviderLabel(value) {
  return getExecutionProvider(value)?.label || null
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

module.exports = {
  EXECUTION_PROVIDER_DEFS,
  EXECUTION_PROVIDER_BY_ID,
  getExecutionProvider,
  getExecutionProviderId,
  getExecutionProviderLabel,
  getSessionProviderInfo
}
