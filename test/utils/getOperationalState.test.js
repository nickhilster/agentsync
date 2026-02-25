'use strict'

const { _testExports } = require('../../extension')
const { getOperationalState } = _testExports

describe('getOperationalState', () => {
  test('returns "ready" when no active session and no pending work', () => {
    const result = getOperationalState(null, [], [], 0)
    expect(result.key).toBe('ready')
    expect(result.label).toBe('Ready')
  })

  test('returns "busy" when a session is active', () => {
    const state = { sessionActive: true, activeSession: { startedAt: new Date().toISOString() } }
    const result = getOperationalState(state, [], [], 0)
    expect(result.key).toBe('busy')
    expect(result.label).toBe('Busy')
  })

  test('returns "waiting" when in-progress lines exist (no active session)', () => {
    const result = getOperationalState(null, ['- Working on feature X'], [], 0)
    expect(result.key).toBe('waiting')
    expect(result.label).toBe('Waiting')
    expect(result.reason).toMatch(/pending/)
  })

  test('returns "waiting" when open handoffs exist (no active session)', () => {
    const handoffs = [{ status: 'queued', from_agent: 'claude', summary: 'Build feature Y' }]
    const result = getOperationalState(null, [], handoffs, 0)
    expect(result.key).toBe('waiting')
    expect(result.label).toBe('Waiting')
  })

  test('does not count closed handoffs as open', () => {
    const handoffs = [{ status: 'done', from_agent: 'claude', summary: 'Already done' }]
    const result = getOperationalState(null, [], handoffs, 0)
    expect(result.key).toBe('ready')
  })

  test('counts "in_progress" handoff status as open', () => {
    const handoffs = [{ status: 'in_progress', from_agent: 'codex', summary: 'In flight' }]
    const result = getOperationalState(null, [], handoffs, 0)
    expect(result.key).toBe('waiting')
  })

  test('returns "waiting" for stale session when autoStaleSessionMinutes is configured', () => {
    // Session started 2 hours ago
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const state = { sessionActive: true, activeSession: { startedAt: twoHoursAgo } }
    // Set stale threshold to 60 minutes
    const result = getOperationalState(state, [], [], 60)
    expect(result.key).toBe('waiting')
    expect(result.reason).toMatch(/stale/)
  })

  test('returns "busy" for fresh session even when autoStaleSessionMinutes is set', () => {
    const justNow = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const state = { sessionActive: true, activeSession: { startedAt: justNow } }
    // Stale threshold is 60 minutes, session is only 5 minutes old
    const result = getOperationalState(state, [], [], 60)
    expect(result.key).toBe('busy')
  })
})
