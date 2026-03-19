const os = require('os')
const fs = require('fs')
const path = require('path')

// Allow symlink creation in test environments where Windows Developer Mode is off
process.env.AGENTSYNC_ALLOW_SYMLINKS = '1'

const { syncAgentFiles } = require('../../src/sync/linker')

describe('syncAgentFiles', () => {
  test('creates a symlink to a source file', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsync-'))
    const srcDir = path.join(tmp, 'src')
    fs.mkdirSync(srcDir)
    const srcFile = path.join(srcDir, 'AGENTS.md')
    fs.writeFileSync(srcFile, 'agent content')

    const mappings = [
      { source: path.relative(tmp, srcFile), dest: path.join('.agents', 'AGENTS.md') }
    ]

    const results = syncAgentFiles(tmp, mappings, { allowWindowsBypass: true })
    expect(results).toHaveLength(1)
    expect(['linked', 'copied']).toContain(results[0].action)

    const dest = path.join(tmp, '.agents', 'AGENTS.md')
    expect(fs.existsSync(dest)).toBe(true)
    const stat = fs.lstatSync(dest)
    if (stat.isSymbolicLink()) {
      const resolved = fs.readlinkSync(dest)
      expect(path.resolve(tmp, resolved)).toBe(srcFile)
    } else {
      expect(fs.readFileSync(dest, 'utf8')).toBe('agent content')
    }
  })

  test('dry-run does not create files', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsync-'))
    const srcFile = path.join(tmp, 'source.txt')
    fs.writeFileSync(srcFile, 'x')
    const mappings = [
      { source: path.relative(tmp, srcFile), dest: path.join('.agents', 'source.txt') }
    ]
    const results = syncAgentFiles(tmp, mappings, { dryRun: true })
    expect(results[0].action).toBe('dryrun')
    const dest = path.join(tmp, '.agents', 'source.txt')
    expect(fs.existsSync(dest)).toBe(false)
  })
})
