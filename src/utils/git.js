'use strict'

const cp = require('child_process')

const HOT_FILES_CACHE_TTL_MS = 4000
const _hotFilesCache = new Map()

/**
 * Run a git command and return stdout when successful.
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
 * Cached version of detectHotFiles with a short TTL.
 */
function getHotFilesCached(workspaceFolder, options = {}) {
  const { force = false } = options
  const key = workspaceFolder.uri.fsPath
  const cached = _hotFilesCache.get(key)
  const now = Date.now()

  if (
    !force &&
    cached &&
    now - cached.fetchedAt <= HOT_FILES_CACHE_TTL_MS &&
    Array.isArray(cached.files)
  ) {
    return cached.files
  }

  const files = detectHotFiles(workspaceFolder)
  _hotFilesCache.set(key, { files, fetchedAt: now })
  return files
}

/**
 * Normalize a workspace-relative path for stable cross-platform comparisons.
 */
function normalizeRepoRelativePath(filePath) {
  return String(filePath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
}

/**
 * Parse a git diff file header path into a normalized relative path.
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

  if (hotFiles && hotFiles.length > 0) {
    const extensions = new Set(
      hotFiles
        .map((file) => {
          const dot = file.lastIndexOf('.')
          return dot >= 0 ? file.slice(dot).toLowerCase() : ''
        })
        .filter(Boolean)
    )
    const testFiles = hotFiles.filter(
      (file) =>
        /\.(test|spec|e2e)\./i.test(file) || /\/__tests__\//i.test(file) || /\/test\//i.test(file)
    )
    if (testFiles.length > 0) caps.push('testing')
    if (extensions.has('.css') || extensions.has('.scss') || extensions.has('.figma')) {
      caps.push('design')
    }
    if (extensions.has('.md') || extensions.has('.txt') || extensions.has('.rst')) {
      caps.push('documentation')
    }
    if (
      extensions.has('.yml') ||
      extensions.has('.yaml') ||
      extensions.has('.dockerfile') ||
      hotFiles.some((file) => file.includes('Dockerfile') || file.includes('.github/workflows'))
    ) {
      caps.push('automation')
    }
  }

  const reason = caps.length ? 'Detected ' + caps.join(', ') : 'Routine change'
  return { tier, capabilities: caps, reason }
}

/**
 * Detect function/method signature changes in hot files using git diff.
 */
function detectSignatureChanges(workspaceFolder, hotFiles) {
  if (!hotFiles || hotFiles.length === 0) return []

  const normalizedHotFiles = hotFiles
    .map((file) => normalizeRepoRelativePath(file))
    .filter((file) => file.length > 0)
  if (normalizedHotFiles.length === 0) return []

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
  getHotFilesCached,
  normalizeRepoRelativePath,
  parseDiffHeaderPath,
  scoreNextTaskCapabilities,
  detectSignatureChanges
}
