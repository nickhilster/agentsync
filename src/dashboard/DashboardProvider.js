'use strict'

const vscode = require('vscode')
const { getDashboardModel } = require('./dashboardModel')
const { getDashboardHtml } = require('./dashboardHtml')
const { handleHandoffAction } = require('./handoffActions')

/**
 * Provides the AgentSync Live Dashboard webview view.
 */
class AgentSyncDashboardViewProvider {
  constructor(context) {
    this._context = context
    this._view = null
    this._viewMode = context.globalState.get('agentsync.dashboard.viewMode', 'compact')
    this._lastRefresh = 0
  }

  resolveWebviewView(webviewView, _context, _token) {
    this._view = webviewView
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri]
    }

    webviewView.webview.html = getDashboardHtml(webviewView.webview, this._context.extensionUri)

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.type) {
        case 'refresh':
          this.refresh()
          break
        case 'setMode':
          this.setViewMode(message.mode)
          break
        case 'runCommand':
          if (message.command) vscode.commands.executeCommand(message.command)
          break
        case 'handoffAction':
          if (workspaceFolder) {
            handleHandoffAction(workspaceFolder, message, () => this.refresh())
          }
          break
        case 'openFile':
          if (message.file && workspaceFolder) {
            const uri = vscode.Uri.joinPath(workspaceFolder.uri, message.file)
            vscode.window.showTextDocument(uri)
          }
          break
      }
    })

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this.refresh()
    })

    this.refresh()
  }

  refresh() {
    if (!this._view) return

    const now = Date.now()
    if (now - this._lastRefresh < 250) return
    this._lastRefresh = now

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]
    if (!workspaceFolder) {
      this._view.webview.postMessage({ type: 'update', data: { hasWorkspace: false } })
      return
    }

    try {
      const data = getDashboardModel(workspaceFolder, this._viewMode)
      this._view.webview.postMessage({ type: 'update', data })
    } catch (err) {
      console.error('[AgentSync] dashboard refresh error:', err)
      this._view.webview.postMessage({
        type: 'update',
        data: { hasWorkspace: true, error: err.message }
      })
    }
  }

  setViewMode(mode) {
    this._viewMode = mode === 'full' ? 'full' : 'compact'
    this._context.globalState.update('agentsync.dashboard.viewMode', this._viewMode)
    this.refresh()
  }
}

AgentSyncDashboardViewProvider.viewType = 'agentsync.dashboard'

module.exports = { AgentSyncDashboardViewProvider }
