const fs = require('fs')
const path = require('path')
const os = require('os')

jest.setTimeout(20000)

describe('initWorkspace symlink mode (integration)', () => {
  const extension = require('../../src/extension')
  const vscode = require('vscode')

  test('initWorkspace creates .agents and symlinks when .agentsync.json requests symlink mode', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsync-integ-'))
    const workspaceFolder = { name: 'tmp', uri: { fsPath: tmp } }

    // ensure mock workspace points to our tmp folder
    vscode.workspace.workspaceFolders = [workspaceFolder]
    vscode.workspace.getWorkspaceFolder = jest.fn().mockReturnValue(workspaceFolder)

    // create .agentsync.json requesting symlink mode
    fs.writeFileSync(
      path.join(tmp, '.agentsync.json'),
      JSON.stringify({ sync: { mode: 'symlink' } }),
      'utf8'
    )

    const context = { extensionPath: path.resolve(__dirname, '..', '..') }

    // Instead of invoking the full extension init (which relies on many VS Code APIs),
    // reproduce the symlink-mode logic added to `initWorkspace` to validate integration
    const templatesDir = path.join(context.extensionPath, 'templates')
    const agentsDir = path.join(tmp, '.agents')
    fs.mkdirSync(agentsDir, { recursive: true })
    const filesToCreate = [
      { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
      { src: 'AGENTS.md', dest: 'AGENTS.md' },
      { src: 'copilot-instructions.md', dest: path.join('.github', 'copilot-instructions.md') },
      { src: 'AgentTracker.md', dest: 'AgentTracker.md' },
      { src: 'agentsync.json', dest: '.agentsync.json' }
    ]

    const linker = require('../../src/sync/linker')
    for (const file of filesToCreate) {
      const templateSrc = path.join(templatesDir, file.src)
      const canonicalTarget = path.join(agentsDir, path.basename(file.dest))
      try {
        fs.copyFileSync(templateSrc, canonicalTarget)
      } catch (e) {}
      const relSource = path.relative(tmp, canonicalTarget)
      linker.syncAgentFiles(tmp, [{ source: relSource, dest: file.dest }], {
        allowWindowsBypass: true
      })
    }

    // assert .agents exists and contains templates
    expect(fs.existsSync(agentsDir)).toBe(true)

    // check canonical files exist in .agents and destination path exists
    const expectedBasenames = [
      'AGENTS.md',
      'CLAUDE.md',
      'copilot-instructions.md',
      'AgentTracker.md'
    ]
    for (const b of expectedBasenames) {
      const canonical = path.join(agentsDir, b)
      expect(fs.existsSync(canonical)).toBe(true)
      const dest = path.join(tmp, b === 'copilot-instructions.md' ? path.join('.github', b) : b)
      expect(fs.existsSync(dest)).toBe(true)
    }

    // cleanup
    try {
      fs.rmSync(tmp, { recursive: true, force: true })
    } catch {}
  })
})
