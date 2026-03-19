'use strict'

const { canonicalAgentId } = require('../utils/text')
const { getAgentCatalog } = require('../utils/agentCatalog')

function getPersonalityDisplayName(workspaceFolder, personalityId) {
  const normalized = canonicalAgentId(personalityId)
  if (!normalized) return null
  try {
    const catalog = getAgentCatalog(workspaceFolder)
    const match = catalog?.agents?.find((agent) => canonicalAgentId(agent.id) === normalized)
    return match?.name || null
  } catch {
    return null
  }
}

function getSessionPersonalityInfo(workspaceFolder, session) {
  const personalityId =
    canonicalAgentId(session?.personality_id || '') ||
    canonicalAgentId(session?.agent_personality_id || '') ||
    null
  const personalityName =
    String(session?.personality_name || '').trim() ||
    getPersonalityDisplayName(workspaceFolder, personalityId) ||
    'None'
  return { id: personalityId, name: personalityName }
}

module.exports = {
  getPersonalityDisplayName,
  getSessionPersonalityInfo
}
