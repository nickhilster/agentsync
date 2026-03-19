'use strict'

const PLACEHOLDER = '-'
const EM_DASH = '\u2014'
const DEFAULT_STALE_HOURS = 24
const OPEN_HANDOFF_STATUSES = new Set([
  'queued',
  'in_progress',
  'blocked',
  'ready_for_review',
  'approved'
])
const DEFAULT_END_SESSION_ZERO_TOUCH = Object.freeze({
  enabled: false,
  autonomy: 'mostly_full_auto',
  copyPromptToClipboard: true,
  maxSummaryLength: 180
})
const DEFAULT_START_SESSION_ZERO_TOUCH = Object.freeze({
  enabled: false,
  autoClaimHandoff: false,
  promptPreFill: true
})
const DEFAULT_HANDOFF_ROUTING_DEFAULTS = Object.freeze({
  claude: { owner_mode: 'single', to_agents: ['codex'], required_capabilities: [] },
  codex: { owner_mode: 'single', to_agents: ['claude'], required_capabilities: [] },
  copilot: { owner_mode: 'single', to_agents: ['codex'], required_capabilities: [] }
})

const EXECUTION_PROVIDER_DEFS = Object.freeze([
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'copilot', label: 'Copilot' }
])
const EXECUTION_PROVIDER_BY_ID = Object.freeze(
  Object.fromEntries(EXECUTION_PROVIDER_DEFS.map((provider) => [provider.id, provider]))
)

// Roles available for workspace user
const ROLE_LIST = [
  'founder_pm',
  'ux_designer',
  'software_developer',
  'non_technical',
  'systems_designer'
]

// ━━━ Agent Catalog constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const AGENT_CATEGORY_COLORS = Object.freeze({
  engineering: '#00d4aa',
  design: '#a855f7',
  marketing: '#3b82f6',
  product: '#22c55e',
  'project-management': '#eab308',
  support: '#14b8a6',
  testing: '#f97316',
  specialized: '#6366f1',
  'spatial-computing': '#06ffd0',
  strategy: '#10b981'
})

const DEFAULT_EXECUTION_CHANNELS_CONFIG = Object.freeze({
  preferred: 'clipboard',
  fallback: 'clipboard'
})

// ━━━ Pipeline / Chain constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CHAIN_STATUSES = Object.freeze({
  BLOCKED: 'blocked',
  QUEUED: 'queued',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'merged'
})

module.exports = {
  PLACEHOLDER,
  EM_DASH,
  DEFAULT_STALE_HOURS,
  OPEN_HANDOFF_STATUSES,
  DEFAULT_END_SESSION_ZERO_TOUCH,
  DEFAULT_START_SESSION_ZERO_TOUCH,
  DEFAULT_HANDOFF_ROUTING_DEFAULTS,
  EXECUTION_PROVIDER_DEFS,
  EXECUTION_PROVIDER_BY_ID,
  ROLE_LIST,
  AGENT_CATEGORY_COLORS,
  DEFAULT_EXECUTION_CHANNELS_CONFIG,
  CHAIN_STATUSES
}
