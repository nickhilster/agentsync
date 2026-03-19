'use strict'

const AGENT_ALIASES = {
  claude: ['claude', 'claude-code'],
  copilot: ['copilot', 'github-copilot'],
  codex: ['codex', 'openai-codex'],
  gemini: ['gemini']
}

const AGENT_CONFIGS = {
  claude: { id: 'claude', instructionsFile: 'CLAUDE.md' },
  copilot: { id: 'copilot', instructionsFile: '.github/copilot-instructions.md' },
  codex: { id: 'codex', instructionsFile: 'AGENTS.md' },
  gemini: { id: 'gemini', instructionsFile: 'GEMINI.md' }
}

function canonicalAgentId(raw) {
  if (!raw || typeof raw !== 'string') return null
  const n = raw.trim().toLowerCase()
  for (const [canonical, aliases] of Object.entries(AGENT_ALIASES)) {
    if (aliases.includes(n) || canonical === n) return canonical
  }
  return null
}

function getAgentConfig(id) {
  const cid = canonicalAgentId(id) || id
  return AGENT_CONFIGS[cid] || null
}

module.exports = { canonicalAgentId, getAgentConfig, AGENT_CONFIGS }
