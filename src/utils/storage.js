'use strict'

const fs = require('fs')
const {
  getTrackerPath,
  getStatePath,
  getHandoffsPath,
  getAgentSyncDir
} = require('./paths')
const { atomicWriteFileSync } = require('./io')

/**
 * Read tracker file content.
 */
function readTracker(workspaceFolder) {
  try {
    return fs.readFileSync(getTrackerPath(workspaceFolder), 'utf8')
  } catch {
    return null
  }
}

/**
 * Write tracker file content.
 */
function writeTracker(workspaceFolder, content) {
  atomicWriteFileSync(getTrackerPath(workspaceFolder), content)
}

/**
 * Read .agentsync/state.json if present.
 */
function readStateFile(workspaceFolder) {
  const statePath = getStatePath(workspaceFolder)
  if (!fs.existsSync(statePath)) return null
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Write structured session state to .agentsync/state.json.
 */
function writeStateFile(workspaceFolder, data) {
  try {
    fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
    const statePath = getStatePath(workspaceFolder)
    atomicWriteFileSync(statePath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('[AgentSync] writeStateFile error:', err)
  }
}

/**
 * Read .agentsync/handoffs.json when present.
 */
function readHandoffs(workspaceFolder) {
  const handoffsPath = getHandoffsPath(workspaceFolder)
  if (!fs.existsSync(handoffsPath)) {
    return { exists: false, handoffs: [], error: null }
  }

  try {
    const raw = fs.readFileSync(handoffsPath, 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(raw)
    const handoffs = Array.isArray(parsed?.handoffs) ? parsed.handoffs : []
    return { exists: true, handoffs, error: null }
  } catch (err) {
    return {
      exists: true,
      handoffs: [],
      error: err && err.message ? err.message : 'Invalid JSON'
    }
  }
}

/**
 * Finalize write to .agentsync/handoffs.json.
 */
function writeHandoffs(workspaceFolder, data) {
  try {
    fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true })
    const handoffsPath = getHandoffsPath(workspaceFolder)
    atomicWriteFileSync(handoffsPath, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('[AgentSync] writeHandoffs error:', err)
  }
}

module.exports = {
  readTracker,
  writeTracker,
  readStateFile,
  writeStateFile,
  readHandoffs,
  writeHandoffs
}
