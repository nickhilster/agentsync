'use strict'

const { _testExports } = require('../../src/extension')
const { resolveHealthCheckProgram } = _testExports

describe('resolveHealthCheckProgram', () => {
  test('uses .cmd shims for npm-family commands on Windows', () => {
    expect(resolveHealthCheckProgram('npm', 'win32')).toBe('npm.cmd')
    expect(resolveHealthCheckProgram('pnpm', 'win32')).toBe('pnpm.cmd')
    expect(resolveHealthCheckProgram('yarn', 'win32')).toBe('yarn.cmd')
  })

  test('preserves explicit executable extensions on Windows', () => {
    expect(resolveHealthCheckProgram('npm.cmd', 'win32')).toBe('npm.cmd')
    expect(resolveHealthCheckProgram('node.exe', 'win32')).toBe('node.exe')
  })

  test('leaves non-shim commands untouched', () => {
    expect(resolveHealthCheckProgram('git', 'win32')).toBe('git')
    expect(resolveHealthCheckProgram('npm', 'linux')).toBe('npm')
  })
})
