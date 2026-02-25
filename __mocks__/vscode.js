'use strict'

// Minimal vscode mock for Jest unit tests.
// Only covers members referenced in the utility functions being tested.
module.exports = {
  window: {
    showErrorMessage: jest.fn(),
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    createStatusBarItem: jest.fn().mockReturnValue({
      text: '',
      tooltip: '',
      command: '',
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn()
    }),
    activeTextEditor: null
  },
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue(0)
    }),
    workspaceFolders: [],
    getWorkspaceFolder: jest.fn(),
    onDidChangeWorkspaceFolders: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    openTextDocument: jest.fn(),
    createFileSystemWatcher: jest.fn().mockReturnValue({
      onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
      dispose: jest.fn()
    })
  },
  commands: {
    registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    executeCommand: jest.fn()
  },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  TreeItem: class TreeItem {
    constructor(label) {
      this.label = label
    }
  },
  ThemeColor: class ThemeColor {
    constructor(id) {
      this.id = id
    }
  },
  EventEmitter: class EventEmitter {
    constructor() {
      this._listeners = []
      this.event = (listener) => {
        this._listeners.push(listener)
      }
    }
    fire(data) {
      this._listeners.forEach((l) => l(data))
    }
    dispose() {}
  },
  Uri: {
    file: (path) => ({ fsPath: path, scheme: 'file' }),
    joinPath: jest.fn()
  },
  StatusBarAlignment: { Left: 1, Right: 2 },
  ViewColumn: { One: 1, Two: 2, Active: -1 },
  RelativePattern: class RelativePattern {
    constructor(base, pattern) {
      this.base = base
      this.pattern = pattern
    }
  },
  env: {
    openExternal: jest.fn()
  },
  extensions: {
    getExtension: jest.fn()
  }
}
