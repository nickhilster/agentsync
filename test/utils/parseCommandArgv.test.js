'use strict'

const { _testExports } = require('../../extension')
const { parseCommandArgv } = _testExports

describe('parseCommandArgv', () => {
  test('splits simple command into tokens', () => {
    expect(parseCommandArgv('npm test')).toEqual(['npm', 'test'])
  })

  test('handles single-quoted argument with spaces', () => {
    expect(parseCommandArgv("npm run 'my script'")).toEqual(['npm', 'run', 'my script'])
  })

  test('handles double-quoted argument with spaces', () => {
    expect(parseCommandArgv('node "my script.js" --flag')).toEqual([
      'node',
      'my script.js',
      '--flag'
    ])
  })

  test('handles backslash escape inside double quotes', () => {
    expect(parseCommandArgv('"path\\"with\\"quotes"')).toEqual(['path"with"quotes'])
  })

  test('returns empty array for empty string', () => {
    expect(parseCommandArgv('')).toEqual([])
  })

  test('returns empty array for whitespace-only string', () => {
    expect(parseCommandArgv('   ')).toEqual([])
  })

  test('handles multiple spaces between tokens', () => {
    expect(parseCommandArgv('npm   run   test')).toEqual(['npm', 'run', 'test'])
  })

  test('shell operators are treated as literal tokens (C1 security fix)', () => {
    const result = parseCommandArgv('npm test && npm build')
    expect(result).toEqual(['npm', 'test', '&&', 'npm', 'build'])
  })

  test('shell pipe treated as literal token', () => {
    const result = parseCommandArgv('echo foo | grep foo')
    expect(result).toEqual(['echo', 'foo', '|', 'grep', 'foo'])
  })

  test('handles tab as whitespace delimiter', () => {
    expect(parseCommandArgv('npm\ttest')).toEqual(['npm', 'test'])
  })

  test('handles single argument with no spaces', () => {
    expect(parseCommandArgv('jest')).toEqual(['jest'])
  })
})
