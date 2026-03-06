'use strict'

const cp = require('child_process')

/**
 * Run a git command and return stdout when successful.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @param {string[]} args
 * @returns {string | null}
 */
function runGit(workspaceFolder, args) {
  const result = cp.spawnSync('git', args, {
    cwd: workspaceFolder.uri.fsPath,
    encoding: 'utf8'
  })

  if (result.error || result.status !== 0) return null
  return result.stdout.trim()
}

/**
 * Run a git command and return the exit code.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @param {string[]} args
 * @returns {number}
 */
function runGitExitCode(workspaceFolder, args) {
  const result = cp.spawnSync('git', args, {
    cwd: workspaceFolder.uri.fsPath,
    encoding: 'utf8'
  })

  if (result.error || typeof result.status !== 'number') return 1
  return result.status
}

/**
 * Detect changed files for Hot Files using git.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @returns {string[]}
 */
function detectHotFiles(workspaceFolder) {
  const collected = new Set()
  const addLines = (output) => {
    if (!output) return
    output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => collected.add(line))
  }

  addLines(runGit(workspaceFolder, ['diff', '--name-only']))
  addLines(runGit(workspaceFolder, ['diff', '--cached', '--name-only']))
  addLines(runGit(workspaceFolder, ['ls-files', '--others', '--exclude-standard']))

  if (collected.size === 0) {
    addLines(runGit(workspaceFolder, ['show', '--pretty=format:', '--name-only', 'HEAD']))
  }

  return [...collected].sort((a, b) => a.localeCompare(b))
}

/**
 * Normalize a workspace-relative path for stable cross-platform comparisons.
 * @param {string} filePath
 * @returns {string}
 */
function normalizeRepoRelativePath(filePath) {
  return String(filePath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
}

/**
 * Parse a git diff file header path into a normalized relative path.
 * @param {string} rawPath
 * @returns {string}
 */
function parseDiffHeaderPath(rawPath) {
  let value = String(rawPath || '').trim()
  if (!value || value === '/dev/null') return ''
  value = value.replace(/^"|"$/g, '')
  if (value.startsWith('a/') || value.startsWith('b/')) {
    value = value.slice(2)
  }
  return normalizeRepoRelativePath(value)
}

/**
 * Score the next task's capabilities based on session context and changes.
 * @param {string[]} hotFiles
 * @param {{ file:string, change:string }[]} signatureChanges
 * @param {{ filesModified?:number, commandsRun?:number }} metrics
 * @param {number} priorAttempts
 * @returns {{ tier:'worker'|'lead', capabilities:string[], reason:string }}
 */
function scoreNextTaskCapabilities(hotFiles, signatureChanges, metrics = {}, priorAttempts = 0) {
  const caps = []
  let tier = 'worker'
  if (priorAttempts >= 2) {
    tier = 'lead'
    caps.push('repeat-fix')
  }
  if (signatureChanges && signatureChanges.length > 0) {
    tier = 'lead'
    caps.push('interface/signature change')
  }
  if (hotFiles && hotFiles.length > 8) {
    tier = 'lead'
    caps.push('multi-file refactor')
  }
  if (metrics.filesModified && metrics.filesModified > 15) {
    tier = 'lead'
    caps.push('heavy edit')
  }
  const reason = caps.length ? 'Detected ' + caps.join(', ') : 'Routine change'
  return { tier, capabilities: caps, reason }
}

/**
 * Detect function/method signature changes in hot files using git diff.
 * @param {import('vscode').WorkspaceFolder} workspaceFolder
 * @param {string[]} hotFiles
 * @returns {{ file: string, change: string }[]}
 */
function detectSignatureChanges(workspaceFolder, hotFiles) {
  if (!hotFiles || hotFiles.length === 0) return []

  const normalizedHotFiles = hotFiles
    .map((file) => normalizeRepoRelativePath(file))
    .filter((file) => file.length > 0)
  if (normalizedHotFiles.length === 0) return []

  // Diff against the parent of the most recent commit.
  const diff = runGit(workspaceFolder, [
    'diff',
    'HEAD~1',
    '--unified=0',
    '--',
    ...normalizedHotFiles
  ])
  if (!diff) return []

  const changes = []
  let currentFile = ''
  const signatureRegex = /(?:\basync\s+function\b|\bfunction\b|=>|\bdef\b|\bclass\b|:\s*\()/

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const headerPath = parseDiffHeaderPath(line.slice(4))
      if (headerPath) currentFile = headerPath
      continue
    }

    if (line.startsWith('@@')) continue

    if (changes.length >= 10) break

    const marker = line[0]
    if ((marker !== '+' && marker !== '-') || line.startsWith('+++') || line.startsWith('---')) {
      continue
    }

    const content = line.slice(1).trim()
    if (!content) continue

    if (signatureRegex.test(content)) {
      changes.push({
        file: currentFile || 'unknown',
        change: line
      })
    }
  }

  return changes
}

module.exports = {
  runGit,
  runGitExitCode,
  detectHotFiles,
  normalizeRepoRelativePath,
  parseDiffHeaderPath,
  scoreNextTaskCapabilities,
  detectSignatureChanges
}
