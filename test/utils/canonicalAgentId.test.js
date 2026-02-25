'use strict'

const { _testExports } = require('../../extension')
const { canonicalAgentId } = _testExports

describe('canonicalAgentId', () => {
  test('lowercases input', () => {
    expect(canonicalAgentId('Claude')).toBe('claude')
  })

  test('trims leading and trailing whitespace', () => {
    expect(canonicalAgentId('  claude  ')).toBe('claude')
  })

  test('replaces internal spaces with underscores', () => {
    expect(canonicalAgentId('GitHub Copilot')).toBe('github_copilot')
  })

  test('collapses multiple consecutive spaces to a single underscore', () => {
    // \s+ matches each run of spaces, replacing with one underscore
    expect(canonicalAgentId('my  agent  name')).toBe('my_agent_name')
  })

  test('handles null', () => {
    expect(canonicalAgentId(null)).toBe('')
  })

  test('handles undefined', () => {
    expect(canonicalAgentId(undefined)).toBe('')
  })

  test('handles empty string', () => {
    expect(canonicalAgentId('')).toBe('')
  })

  test('preserves already-canonical id', () => {
    expect(canonicalAgentId('claude')).toBe('claude')
  })

  test('handles all-caps input', () => {
    expect(canonicalAgentId('CODEX')).toBe('codex')
  })
})
