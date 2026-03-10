'use strict'

const { PLACEHOLDER } = require('./constants')
const { parseTracker, getInProgressLines } = require('./text')
const { readTracker, readStateFile, readHandoffs } = require('./storage')
const { readAgentSyncConfig } = require('./workspace')

/**
 * Cache workspace reads and derived tracker/session data.
 * This keeps status bar + tree + dashboard refreshes consistent and cheap.
 */
class WorkspaceSnapshotService {
  /**
   * @param {{
   *   readTracker: (workspaceFolder: any) => string | null,
   *   parseTracker: (content: string) => any,
   *   readStateFile: (workspaceFolder: any) => any | null,
   *   readConfig: (workspaceFolder: any) => any,
   *   readHandoffs: (workspaceFolder: any) => { exists: boolean, handoffs: any[], error: string | null },
   *   getInProgressLines: (content: string | null) => string[],
   *   placeholder: string
   * }} loaders
   */
  constructor(loaders) {
    this.loaders = loaders
    /** @type {Map<string, { snapshot: any, dirty: boolean, version: number }>} */
    this.cache = new Map()
  }

  /**
   * @param {any} workspaceFolder
   * @returns {string}
   */
  key(workspaceFolder) {
    return workspaceFolder.uri.fsPath
  }

  /**
   * @param {any} workspaceFolder
   */
  invalidate(workspaceFolder) {
    if (!workspaceFolder) return
    const key = this.key(workspaceFolder)
    const existing = this.cache.get(key)
    if (!existing) return
    existing.dirty = true
    this.cache.set(key, existing)
  }

  invalidateAll() {
    for (const [key, entry] of this.cache.entries()) {
      entry.dirty = true
      this.cache.set(key, entry)
    }
  }

  /**
   * @param {any} workspaceFolder
   * @returns {{ version: number, hash: string | null }}
   */
  getMetadata(workspaceFolder) {
    if (!workspaceFolder) return { version: 0, hash: null }
    const entry = this.cache.get(this.key(workspaceFolder))
    if (!entry || !entry.snapshot) return { version: 0, hash: null }
    return { version: entry.version, hash: entry.snapshot.hash || null }
  }

  /**
   * @param {any} workspaceFolder
   * @param {{ force?: boolean }} [options]
   * @returns {any}
   */
  getSnapshot(workspaceFolder, options = {}) {
    const { force = false } = options
    const key = this.key(workspaceFolder)
    const current = this.cache.get(key)

    if (current && current.snapshot && !current.dirty && !force) {
      return current.snapshot
    }

    const trackerContent = this.loaders.readTracker(workspaceFolder)
    const placeholder = this.loaders.placeholder
    const tracker = trackerContent
      ? this.loaders.parseTracker(trackerContent)
      : {
          agent: placeholder,
          date: placeholder,
          summary: placeholder,
          branch: placeholder,
          commit: placeholder
        }

    const state = this.loaders.readStateFile(workspaceFolder)
    const config = this.loaders.readConfig(workspaceFolder)
    const handoffInfo = this.loaders.readHandoffs(workspaceFolder)
    const inProgressLines =
      Array.isArray(state?.inProgress) && state.inProgress.length > 0
        ? state.inProgress
        : this.loaders.getInProgressLines(trackerContent)

    const nextVersion = (current?.version || 0) + 1
    const generatedAt = new Date().toISOString()
    const hash = this.computeHash(
      JSON.stringify({
        tracker,
        state,
        config,
        handoffCount: handoffInfo.handoffs.length,
        inProgressCount: inProgressLines.length,
        generatedAt
      })
    )

    const snapshot = {
      trackerContent,
      tracker,
      state,
      config,
      handoffInfo,
      inProgressLines,
      generatedAt,
      version: nextVersion,
      hash
    }

    this.cache.set(key, { snapshot, dirty: false, version: nextVersion })
    return snapshot
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  computeHash(value) {
    let hash = 0
    for (let i = 0; i < value.length; i += 1) {
      hash = (hash * 31 + value.charCodeAt(i)) | 0
    }
    return Math.abs(hash).toString(16)
  }
}

let _workspaceSnapshotService = null

function getWorkspaceSnapshotService() {
  if (_workspaceSnapshotService) return _workspaceSnapshotService

  _workspaceSnapshotService = new WorkspaceSnapshotService({
    readTracker,
    parseTracker,
    readStateFile,
    readConfig: readAgentSyncConfig,
    readHandoffs,
    getInProgressLines,
    placeholder: PLACEHOLDER
  })
  return _workspaceSnapshotService
}

/**
 * Read a cached workspace snapshot.
 */
function getWorkspaceSnapshot(workspaceFolder, options = {}) {
  return getWorkspaceSnapshotService().getSnapshot(workspaceFolder, options)
}

/**
 * Invalidate per-workspace snapshot caches.
 */
function invalidateWorkspaceCaches(workspaceFolder) {
  if (!workspaceFolder) {
    getWorkspaceSnapshotService().invalidateAll()
    return
  }
  getWorkspaceSnapshotService().invalidate(workspaceFolder)
}

module.exports = {
  WorkspaceSnapshotService,
  getWorkspaceSnapshotService,
  getWorkspaceSnapshot,
  invalidateWorkspaceCaches
}
