'use strict'

const { _testExports } = require('../../extension')
const { escapeRegExp } = _testExports

describe('escapeRegExp', () => {
  test('escapes dot', () => {
    expect(escapeRegExp('a.b')).toBe('a\\.b')
  })

  test('escapes asterisk', () => {
    expect(escapeRegExp('a*b')).toBe('a\\*b')
  })

  test('escapes parentheses', () => {
    expect(escapeRegExp('(a|b)')).toBe('\\(a\\|b\\)')
  })

  test('escapes square brackets', () => {
    expect(escapeRegExp('[test]')).toBe('\\[test\\]')
  })

  test('escapes caret and dollar', () => {
    expect(escapeRegExp('^end$')).toBe('\\^end\\$')
  })

  test('escapes curly braces', () => {
    expect(escapeRegExp('a{2}')).toBe('a\\{2\\}')
  })

  test('escapes backslash', () => {
    expect(escapeRegExp('a\\b')).toBe('a\\\\b')
  })

  test('returns plain string unchanged', () => {
    expect(escapeRegExp('hello world')).toBe('hello world')
  })

  test('escaped string is safe to use in RegExp constructor', () => {
    const heading = 'Current Health (Pass/Fail)'
    const escaped = escapeRegExp(heading)
    const re = new RegExp(escaped)
    expect(re.test('## Current Health (Pass/Fail)')).toBe(true)
  })
})
