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

// Roles available for workspace user
const ROLE_LIST = [
  'founder_pm',
  'ux_designer',
  'software_developer',
  'non_technical',
  'systems_designer'
]

module.exports = {
  PLACEHOLDER,
  EM_DASH,
  DEFAULT_STALE_HOURS,
  OPEN_HANDOFF_STATUSES,
  DEFAULT_END_SESSION_ZERO_TOUCH,
  DEFAULT_START_SESSION_ZERO_TOUCH,
  DEFAULT_HANDOFF_ROUTING_DEFAULTS,
  ROLE_LIST
}
