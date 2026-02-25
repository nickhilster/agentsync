'use strict'

const { _testExports } = require('../../extension')
const { parseTracker } = _testExports

const SAMPLE_TRACKER = `# AgentTracker

## Last Session

- **Agent:** Claude
- **Date:** 2026-02-25
- **Summary:** Implemented test suite
- **Branch:** claude/add-tests
- **Commit:** abc1234
`

describe('parseTracker', () => {
  test('extracts agent field', () => {
    const result = parseTracker(SAMPLE_TRACKER)
    expect(result.agent).toBe('Claude')
  })

  test('extracts date field', () => {
    const result = parseTracker(SAMPLE_TRACKER)
    expect(result.date).toBe('2026-02-25')
  })

  test('extracts summary field', () => {
    const result = parseTracker(SAMPLE_TRACKER)
    expect(result.summary).toBe('Implemented test suite')
  })

  test('extracts branch field', () => {
    const result = parseTracker(SAMPLE_TRACKER)
    expect(result.branch).toBe('claude/add-tests')
  })

  test('extracts commit field', () => {
    const result = parseTracker(SAMPLE_TRACKER)
    expect(result.commit).toBe('abc1234')
  })

  test('returns placeholder for missing field', () => {
    const result = parseTracker('# AgentTracker\n\nNo fields here.')
    expect(result.agent).toBe('-')
    expect(result.date).toBe('-')
    expect(result.summary).toBe('-')
  })

  test('handles empty content', () => {
    const result = parseTracker('')
    expect(result.agent).toBe('-')
    expect(result.branch).toBe('-')
    expect(result.commit).toBe('-')
  })
})
