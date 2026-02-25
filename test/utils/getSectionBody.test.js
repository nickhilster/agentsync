'use strict'

const { _testExports } = require('../../extension')
const { getSectionBody, setSectionBody } = _testExports

// Note: getSectionBody uses [\s\S]*? with the 'm' flag, where $ matches end of each line.
// This means it captures up to the first line end or the next '## ' heading, whichever
// comes first. The function is designed for AgentTracker sections with single-line values.
const SAMPLE_DOC = `# AgentTracker

## Last Session

**Agent:** Claude

## Current Health

Build: Pass

## In Progress

Working on feature X.
`

describe('getSectionBody', () => {
  test('extracts body of existing single-line section', () => {
    const body = getSectionBody(SAMPLE_DOC, 'Current Health')
    expect(body).toContain('Build: Pass')
  })

  test('returns empty string for missing section', () => {
    expect(getSectionBody(SAMPLE_DOC, 'Nonexistent Section')).toBe('')
  })

  test('does not include next heading in result', () => {
    const body = getSectionBody(SAMPLE_DOC, 'Last Session')
    expect(body).not.toContain('## Current Health')
  })

  test('extracts last section body', () => {
    const body = getSectionBody(SAMPLE_DOC, 'In Progress')
    expect(body).toContain('Working on feature X.')
  })

  test('escapes regex special characters in heading name', () => {
    const doc = `## Health (Pass/Fail)\n\nAll good.\n\n## Next\n\nstuff\n`
    const body = getSectionBody(doc, 'Health (Pass/Fail)')
    expect(body).toBe('All good.')
  })

  test('returns trimmed content', () => {
    const doc = `## Section\n\n  trimmed content  \n\n## Next\n\nother\n`
    const body = getSectionBody(doc, 'Section')
    expect(body).toBe('trimmed content')
  })
})

describe('setSectionBody', () => {
  test('replaces body of existing section', () => {
    const updated = setSectionBody(SAMPLE_DOC, 'In Progress', 'Working on feature Y.')
    expect(updated).toContain('Working on feature Y.')
    expect(updated).not.toContain('Working on feature X.')
  })

  test('preserves other sections when replacing', () => {
    const updated = setSectionBody(SAMPLE_DOC, 'In Progress', 'New task.')
    expect(updated).toContain('## Current Health')
    expect(updated).toContain('## Last Session')
  })

  test('appends new section when heading does not exist', () => {
    const updated = setSectionBody(SAMPLE_DOC, 'Suggested Next Work', 'Add more tests.')
    expect(updated).toContain('## Suggested Next Work')
    expect(updated).toContain('Add more tests.')
  })

  test('does not duplicate existing section when replacing', () => {
    const updated = setSectionBody(SAMPLE_DOC, 'In Progress', 'New content.')
    const count = (updated.match(/## In Progress/g) || []).length
    expect(count).toBe(1)
  })
})
