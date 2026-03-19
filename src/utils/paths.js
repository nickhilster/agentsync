'use strict'

const path = require('path')

/**
 * Returns the templates directory bundled with this extension.
 * @param {import('vscode').ExtensionContext} context
 */
function getTemplatesDir(context) {
  return path.join(context.extensionPath, 'templates')
}

/**
 * Resolve the AgentTracker.md path for a workspace folder.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getTrackerPath(workspaceFolder) {
  return path.join(workspaceFolder.uri.fsPath, 'AgentTracker.md')
}

/**
 * Resolve the .agentsync.json config path for a workspace folder.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getConfigPath(workspaceFolder) {
  return path.join(workspaceFolder.uri.fsPath, '.agentsync.json')
}

/**
 * Resolve the .agentsync/ runtime directory for a workspace folder.
 * This directory holds state.json, request.json, and result.json.
 * It should be added to .gitignore — initWorkspace does this automatically.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getAgentSyncDir(workspaceFolder) {
  return path.join(workspaceFolder.uri.fsPath, '.agentsync')
}

/**
 * Resolve the state file path.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getStatePath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'state.json')
}

/**
 * Resolve the drop-zone request file path.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getRequestPath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'request.json')
}

/**
 * Resolve the drop-zone result file path.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getResultPath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'result.json')
}

/**
 * Resolve the handoffs file path.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getHandoffsPath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'handoffs.json')
}

/**
 * Resolve the context capsule file path.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getContextCapsulePath(workspaceFolder) {
  return path.join(getAgentSyncDir(workspaceFolder), 'context-capsule.json')
}

module.exports = {
  getTemplatesDir,
  getTrackerPath,
  getConfigPath,
  getAgentSyncDir,
  getStatePath,
  getRequestPath,
  getResultPath,
  getHandoffsPath,
  getContextCapsulePath
}
