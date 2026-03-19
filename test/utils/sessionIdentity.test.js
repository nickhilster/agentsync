'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const { _testExports } = require('../../src/extension')
const { startSessionCore, getSessionProviderInfo } = _testExports

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsync-session-'))
  fs.mkdirSync(path.join(root, '.agentsync'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'AgentTracker.md'),
    [
      '# AgentTracker',
      '',
      '## Last Session',
      '',
      '- **Agent:** -',
      '- **Date:** -',
      '- **Summary:** -',
      '- **Branch:** -',
      '- **Commit:** -',
      '',
      '## In Progress',
      '',
      '*Nothing active*'
    ].join('\n'),
    'utf8'
  )
  return {
    root,
    folder: { name: 'tmp', uri: { fsPath: root } }
  }
}

describe('session identity model', () => {
  test('writes provider and personality fields while preserving legacy agent', () => {
    const { root, folder } = makeWorkspace()
    try {
      startSessionCore(folder, 'Gemini', 'Verify rollout plan', {
        providerId: 'gemini',
        providerLabel: 'Gemini',
        personalityId: 'testing/testing-api-tester',
        personalityName: 'API Tester'
      })

      const state = JSON.parse(
        fs.readFileSync(path.join(root, '.agentsync', 'state.json'), 'utf8')
      )

      expect(state.sessionActive).toBe(true)
      expect(state.activeSession.provider_id).toBe('gemini')
      expect(state.activeSession.provider_label).toBe('Gemini')
      expect(state.activeSession.personality_id).toBe('testing/testing-api-tester')
      expect(state.activeSession.personality_name).toBe('API Tester')
      expect(state.activeSession.agent).toBe('Gemini')
      expect(state.activeSession.goal).toBe('Verify rollout plan')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('falls back to legacy agent field when provider fields are absent', () => {
    const info = getSessionProviderInfo({ agent: 'Codex' })
    expect(info.id).toBe('codex')
    expect(info.label).toBe('Codex')
  })
})
