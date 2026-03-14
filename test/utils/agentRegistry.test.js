const { canonicalAgentId, getAgentConfig } = require('../../src/utils/agentRegistry')

describe('agentRegistry', () => {
  test('canonicalAgentId normalizes aliases', () => {
    expect(canonicalAgentId('Claude')).toBe('claude')
    expect(canonicalAgentId('github-copilot')).toBe('copilot')
    expect(canonicalAgentId('unknown-agent')).toBe(null)
  })

  test('getAgentConfig returns config for known agents', () => {
    expect(getAgentConfig('claude').instructionsFile).toBe('CLAUDE.md')
    expect(getAgentConfig('github-copilot').instructionsFile).toBe(
      '.github/copilot-instructions.md'
    )
    expect(getAgentConfig('missing')).toBe(null)
  })
})
