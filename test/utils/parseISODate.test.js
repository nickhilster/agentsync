'use strict'

const { _testExports } = require('../../extension')
const { parseISODate } = _testExports

describe('parseISODate (M5 strict ISO parsing fix)', () => {
  test('parses full ISO 8601 timestamp with Z', () => {
    const result = parseISODate('2026-02-25T10:00:00Z')
    expect(Number.isFinite(result)).toBe(true)
  })

  test('parses ISO with milliseconds', () => {
    const result = parseISODate('2026-02-25T10:00:00.000Z')
    expect(Number.isFinite(result)).toBe(true)
  })

  test('parses ISO with timezone offset', () => {
    const result = parseISODate('2026-02-25T10:00:00+05:30')
    expect(Number.isFinite(result)).toBe(true)
  })

  test('returns NaN for locale date string', () => {
    expect(Number.isFinite(parseISODate('February 25, 2026'))).toBe(false)
  })

  test('returns NaN for date-only string (no time component)', () => {
    expect(Number.isFinite(parseISODate('2026-02-25'))).toBe(false)
  })

  test('returns NaN for null', () => {
    expect(Number.isFinite(parseISODate(null))).toBe(false)
  })

  test('returns NaN for undefined', () => {
    expect(Number.isFinite(parseISODate(undefined))).toBe(false)
  })

  test('returns NaN for empty string', () => {
    expect(Number.isFinite(parseISODate(''))).toBe(false)
  })

  test('returns NaN for numeric input', () => {
    expect(Number.isFinite(parseISODate(1234567890))).toBe(false)
  })

  test('returns expected epoch for known timestamp', () => {
    const result = parseISODate('2026-01-01T00:00:00.000Z')
    expect(result).toBe(new Date('2026-01-01T00:00:00.000Z').getTime())
  })
})
