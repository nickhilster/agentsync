'use strict'

const { _testExports } = require('../../extension')
const { isEmptyValue } = _testExports

describe('isEmptyValue', () => {
  test('returns true for empty string', () => {
    expect(isEmptyValue('')).toBe(true)
  })

  test('returns true for whitespace-only string', () => {
    expect(isEmptyValue('   ')).toBe(true)
  })

  test('returns true for null', () => {
    expect(isEmptyValue(null)).toBe(true)
  })

  test('returns true for undefined', () => {
    expect(isEmptyValue(undefined)).toBe(true)
  })

  test('returns true for PLACEHOLDER value "-"', () => {
    expect(isEmptyValue('-')).toBe(true)
  })

  test('returns false for a real value', () => {
    expect(isEmptyValue('some content')).toBe(false)
  })

  test('returns false for a numeric-like string', () => {
    expect(isEmptyValue('42')).toBe(false)
  })

  test('trims before checking', () => {
    expect(isEmptyValue('  -  ')).toBe(true)
  })
})
