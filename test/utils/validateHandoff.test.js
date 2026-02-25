'use strict'

const { _testExports } = require('../../extension')
const { validateHandoff } = _testExports

const VALID_HANDOFF = {
  from_agent: 'claude',
  summary: 'Implement feature X',
  owner_mode: 'single',
  to_agents: ['codex'],
  status: 'queued',
  created_at: '2026-02-25T10:00:00Z'
}

describe('validateHandoff', () => {
  test('accepts a valid single-owner handoff', () => {
    const result = validateHandoff(VALID_HANDOFF)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('rejects handoff missing from_agent', () => {
    const { from_agent: _, ...rest } = VALID_HANDOFF
    const result = validateHandoff(rest)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('from_agent is required')
  })

  test('rejects handoff missing summary', () => {
    const { summary: _, ...rest } = VALID_HANDOFF
    const result = validateHandoff(rest)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('summary is required')
  })

  test('rejects handoff missing status', () => {
    const { status: _, ...rest } = VALID_HANDOFF
    const result = validateHandoff(rest)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('status is required')
  })

  test('rejects handoff missing created_at (M3 audit fix)', () => {
    const { created_at: _, ...rest } = VALID_HANDOFF
    const result = validateHandoff(rest)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('created_at is required')
  })

  test('rejects created_at that is not ISO format', () => {
    const result = validateHandoff({ ...VALID_HANDOFF, created_at: 'February 25, 2026' })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/ISO 8601/)
  })

  test('rejects single mode with zero to_agents', () => {
    const result = validateHandoff({ ...VALID_HANDOFF, to_agents: [] })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/exactly 1/)
  })

  test('rejects single mode with two to_agents', () => {
    const result = validateHandoff({ ...VALID_HANDOFF, to_agents: ['codex', 'copilot'] })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/exactly 1/)
  })

  test('rejects shared mode with only one to_agent', () => {
    const result = validateHandoff({ ...VALID_HANDOFF, owner_mode: 'shared', to_agents: ['codex'] })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/exactly 2/)
  })

  test('accepts shared mode with exactly two to_agents', () => {
    const result = validateHandoff({
      ...VALID_HANDOFF,
      owner_mode: 'shared',
      to_agents: ['codex', 'copilot']
    })
    expect(result.valid).toBe(true)
  })

  test('rejects auto mode with no required_capabilities', () => {
    const result = validateHandoff({
      ...VALID_HANDOFF,
      owner_mode: 'auto',
      to_agents: [],
      required_capabilities: []
    })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/required_capabilities/)
  })

  test('accepts auto mode with required_capabilities', () => {
    const result = validateHandoff({
      ...VALID_HANDOFF,
      owner_mode: 'auto',
      to_agents: [],
      required_capabilities: ['code_generation']
    })
    expect(result.valid).toBe(true)
  })

  test('rejects empty string no_handoff_reason (H5 fix)', () => {
    const result = validateHandoff({ ...VALID_HANDOFF, no_handoff_reason: '   ' })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toMatch(/non-empty/)
  })

  test('accepts null no_handoff_reason', () => {
    const result = validateHandoff({ ...VALID_HANDOFF, no_handoff_reason: null })
    expect(result.valid).toBe(true)
  })

  test('accepts undefined no_handoff_reason', () => {
    const result = validateHandoff({ ...VALID_HANDOFF })
    expect(result.valid).toBe(true)
  })

  test('accepts a valid non-empty no_handoff_reason string', () => {
    const result = validateHandoff({
      ...VALID_HANDOFF,
      no_handoff_reason: 'No handoff needed for this task'
    })
    expect(result.valid).toBe(true)
  })

  test('rejects unknown owner_mode', () => {
    const result = validateHandoff({ ...VALID_HANDOFF, owner_mode: 'exclusive', to_agents: [] })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('owner_mode'))).toBe(true)
  })
})
