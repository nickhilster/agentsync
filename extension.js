const vscode = require('vscode')
const fs = require('fs')
const path = require('path')

/**
 * Returns the templates directory bundled with this extension.
 * @param {vscode.ExtensionContext} context
 */
function getTemplatesDir(context) {
  return path.join(context.extensionPath, 'templates')
}

/**
 * Parse AgentTracker.md content for status bar display.
 * @param {string} content
 * @returns {{ agent: string, date: string }}
 */
function parseTracker(content) {
  const agentMatch = content.match(/\*\*Agent:\*\*\s*(.+)/)
  const dateMatch = content.match(/\*\*Date:\*\*\s*(.+)/)
  return {
    agent: agentMatch?.[1]?.trim() ?? '—',
    date: dateMatch?.[1]?.trim() ?? '—'
  }
}

/**
 * Resolve the AgentTracker.md path for the current workspace.
 * Returns null if no workspace folder is open.
 * @returns {string | null}
 */
function getTrackerPath() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  if (!workspaceFolder) return null
  return path.join(workspaceFolder.uri.fsPath, 'AgentTracker.md')
}

/**
 * Update status bar item from current AgentTracker.md state.
 * @param {vscode.StatusBarItem} statusItem
 */
function updateStatusBar(statusItem) {
  const trackerPath = getTrackerPath()

  if (!trackerPath) {
    statusItem.text = '$(sync) AgentSync'
    statusItem.tooltip = 'No workspace open'
    statusItem.show()
    return
  }

  if (!fs.existsSync(trackerPath)) {
    statusItem.text = '$(sync) AgentSync'
    statusItem.tooltip = 'AgentTracker not initialized — run "AgentSync: Initialize Workspace"'
    statusItem.show()
    return
  }

  try {
    const content = fs.readFileSync(trackerPath, 'utf8')
    const { agent, date } = parseTracker(content)
    const agentLabel = agent !== '—' ? agent : 'AgentSync'
    statusItem.text = `$(sync) ${agentLabel}`
    statusItem.tooltip =
      agent !== '—'
        ? `Last session: ${agent} · ${date}\nClick to open AgentTracker`
        : 'Click to open AgentTracker'
  } catch {
    statusItem.text = '$(sync) AgentSync'
    statusItem.tooltip = 'Could not read AgentTracker.md'
  }

  statusItem.show()
}

/**
 * Initialize the workspace with AgentSync protocol files.
 * @param {vscode.ExtensionContext} context
 */
async function initWorkspace(context) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const root = workspaceFolder.uri.fsPath
  const templatesDir = getTemplatesDir(context)

  const filesToCreate = [
    { src: 'CLAUDE.md', dest: 'CLAUDE.md' },
    { src: 'AGENTS.md', dest: 'AGENTS.md' },
    { src: 'copilot-instructions.md', dest: path.join('.github', 'copilot-instructions.md') },
    { src: 'AgentTracker.md', dest: 'AgentTracker.md' }
  ]

  let created = 0
  let skipped = 0

  for (const file of filesToCreate) {
    const destPath = path.join(root, file.dest)
    const srcPath = path.join(templatesDir, file.src)

    if (fs.existsSync(destPath)) {
      const choice = await vscode.window.showWarningMessage(
        `${file.dest} already exists. Overwrite?`,
        { modal: false },
        'Overwrite',
        'Skip'
      )
      if (choice !== 'Overwrite') {
        skipped++
        continue
      }
    }

    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(srcPath, destPath)
      created++
    } catch (err) {
      vscode.window.showErrorMessage(`AgentSync: Failed to create ${file.dest}: ${err.message}`)
    }
  }

  const summary =
    created === 0 && skipped > 0
      ? 'All files skipped.'
      : `${created} file${created !== 1 ? 's' : ''} created${skipped > 0 ? `, ${skipped} skipped` : ''}.`

  vscode.window.showInformationMessage(`AgentSync: Workspace initialized. ${summary}`)

  // Open AgentTracker.md in the editor
  const trackerPath = path.join(root, 'AgentTracker.md')
  if (fs.existsSync(trackerPath)) {
    const doc = await vscode.workspace.openTextDocument(trackerPath)
    await vscode.window.showTextDocument(doc)
  }
}

/**
 * Open AgentTracker.md in the editor.
 */
async function openTracker() {
  const trackerPath = getTrackerPath()

  if (!trackerPath) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  if (!fs.existsSync(trackerPath)) {
    const choice = await vscode.window.showWarningMessage(
      'AgentTracker.md not found. Initialize this workspace first?',
      'Initialize',
      'Cancel'
    )
    if (choice === 'Initialize') {
      await vscode.commands.executeCommand('agentsync.init')
    }
    return
  }

  const doc = await vscode.workspace.openTextDocument(trackerPath)
  await vscode.window.showTextDocument(doc)
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  // Status bar item
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  statusItem.command = 'agentsync.openTracker'
  updateStatusBar(statusItem)

  // Watch AgentTracker.md for changes so status bar stays current
  const watcher = vscode.workspace.createFileSystemWatcher('**/AgentTracker.md')
  watcher.onDidChange(() => updateStatusBar(statusItem))
  watcher.onDidCreate(() => updateStatusBar(statusItem))
  watcher.onDidDelete(() => updateStatusBar(statusItem))

  // Commands
  const initCmd = vscode.commands.registerCommand('agentsync.init', () => initWorkspace(context))
  const openCmd = vscode.commands.registerCommand('agentsync.openTracker', openTracker)

  context.subscriptions.push(statusItem, watcher, initCmd, openCmd)
}

function deactivate() {}

module.exports = { activate, deactivate }
