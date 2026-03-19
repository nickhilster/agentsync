'use strict'

const { _testExports } = require('../../src/extension')
const { scoreNextTaskCapabilities } = _testExports

describe('scoreNextTaskCapabilities', () => {
  test('returns worker tier with default inputs', () => {
    const res = scoreNextTaskCapabilities([], [], {}, 0)
    expect(res.tier).toBe('worker')
    expect(res.capabilities).toEqual([])
    expect(res.reason).toMatch(/Routine/)
  })

  test('elevates to lead when priorAttempts >= 2', () => {
    const res = scoreNextTaskCapabilities([], [], {}, 2)
    expect(res.tier).toBe('lead')
    expect(res.capabilities).toContain('repeat-fix')
  })

  test('elevates to lead when signature changes present', () => {
    const res = scoreNextTaskCapabilities([], [{file:'a',change:'+ function foo(){}'}], {}, 0)
    expect(res.tier).toBe('lead')
    expect(res.capabilities).toContain('interface/signature change')
  })

  test('elevates to lead when many hot files', () => {
    const hot = Array.from({length:9},(_,i)=>`f${i}.js`)
    const res = scoreNextTaskCapabilities(hot, [], {}, 0)
    expect(res.tier).toBe('lead')
    expect(res.capabilities).toContain('multi-file refactor')
  })

  test('elevates to lead when filesModified high', () => {
    const res = scoreNextTaskCapabilities([], [], {filesModified:20}, 0)
    expect(res.tier).toBe('lead')
    expect(res.capabilities).toContain('heavy edit')
  })

  test('combines reasons when multiple triggers exist', () => {
    const res = scoreNextTaskCapabilities(['a','b','c','d','e','f','g','h','i'], [{file:'x',change:'- class A'}], {filesModified:20}, 3)
    expect(res.tier).toBe('lead')
    expect(res.capabilities.length).toBeGreaterThan(1)
    expect(res.reason).toMatch(/Detected/)
  })
})