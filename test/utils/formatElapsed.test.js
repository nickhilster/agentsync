'use strict'

const { _testExports } = require('../../extension')
const { formatElapsed } = _testExports

describe('formatElapsed', () => {
  test('formats zero milliseconds as "0m"', () => {
    expect(formatElapsed(0)).toBe('0m')
  })

  test('formats 45 minutes correctly', () => {
    expect(formatElapsed(45 * 60 * 1000)).toBe('45m')
  })

  test('formats exactly 1 hour', () => {
    expect(formatElapsed(60 * 60 * 1000)).toBe('1h 0m')
  })

  test('formats 1 hour 30 minutes', () => {
    expect(formatElapsed(90 * 60 * 1000)).toBe('1h 30m')
  })

  test('formats 2 hours 15 minutes', () => {
    expect(formatElapsed(135 * 60 * 1000)).toBe('2h 15m')
  })

  test('formats 59 minutes without hour prefix', () => {
    expect(formatElapsed(59 * 60 * 1000)).toBe('59m')
  })

  test('formats sub-minute duration as "0m"', () => {
    expect(formatElapsed(30000)).toBe('0m')
  })

  test('formats 24 hours', () => {
    expect(formatElapsed(24 * 60 * 60 * 1000)).toBe('24h 0m')
  })
})
