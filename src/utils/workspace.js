'use strict'

const vscode = require('vscode')

/**
 * Get active workspace folder without showing prompts.
 * @returns {import('vscode').WorkspaceFolder | null}
 */
function getActiveWorkspaceFolder() {
  const activeUri = vscode.window.activeTextEditor?.document?.uri
  if (activeUri) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(activeUri)
    if (activeFolder) return activeFolder
  }

  return vscode.workspace.workspaceFolders?.[0] ?? null
}

/**
 * Resolve a workspace folder for a command invocation.
 * @param {{ allowPick?: boolean }} options
 * @returns {Promise<import('vscode').WorkspaceFolder | null>}
 */
async function resolveWorkspaceFolder(options = {}) {
  const { allowPick = true } = options
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) return null

  const activeFolder = getActiveWorkspaceFolder()
  if (activeFolder) return activeFolder

  if (folders.length === 1 || !allowPick) {
    return folders[0]
  }

  const picks = folders.map((folder) => ({
    label: folder.name,
    description: folder.uri.fsPath,
    folder
  }))

  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Select a workspace folder for AgentSync'
  })

  return selected?.folder ?? null
}

/**
 * Format text prefix for multi-root workspaces.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getWorkspaceLabelPrefix(workspaceFolder) {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length <= 1) return ''
  return `[${workspaceFolder.name}] `
}

module.exports = {
  getActiveWorkspaceFolder,
  resolveWorkspaceFolder,
  getWorkspaceLabelPrefix
}
