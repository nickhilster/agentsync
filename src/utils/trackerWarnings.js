'use strict'

const { isEmptyValue } = require('./text')
const { runGit, runGitExitCode } = require('./git')
const { readAgentSyncConfig } = require('./workspace')

/**
 * Return warning strings for stale tracker data and branch drift.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @param {{ date: string, branch: string, commit: string }} tracker
 * @returns {string[]}
 */
function getTrackerWarnings(workspaceFolder, tracker) {
  const warnings = []
  const config = readAgentSyncConfig(workspaceFolder)

  if (!isEmptyValue(tracker.date)) {
    const parsed = Date.parse(tracker.date)
    if (Number.isFinite(parsed)) {
      const ageMs = Date.now() - parsed
      if (ageMs > config.staleAfterHours * 60 * 60 * 1000) {
        const ageHours = Math.floor(ageMs / (60 * 60 * 1000))
        warnings.push(`Tracker is stale (${ageHours}h old).`)
      }
    }
  }

  const currentBranch = runGit(workspaceFolder, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (currentBranch && !isEmptyValue(tracker.branch) && tracker.branch !== currentBranch) {
    warnings.push(`Branch mismatch: tracker=${tracker.branch}, current=${currentBranch}.`)
  }

  if (!isEmptyValue(tracker.commit)) {
    const exitCode = runGitExitCode(workspaceFolder, [
      'merge-base',
      '--is-ancestor',
      tracker.commit,
      'HEAD'
    ])
    if (exitCode !== 0) {
      warnings.push(`Tracker commit ${tracker.commit} is not in current HEAD history.`)
    }
  }

  return warnings
}

module.exports = { getTrackerWarnings }
