const vscode = require('vscode')
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const PLACEHOLDER = '-'
const DEFAULT_STALE_HOURS = 24

/**
 * Returns the templates directory bundled with this extension.
 * @param {vscode.ExtensionContext} context
 */
function getTemplatesDir(context) {
  return path.join(context.extensionPath, 'templates')
}

/**
 * Resolve the AgentTracker.md path for a workspace folder.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getTrackerPath(workspaceFolder) {
  return path.join(workspaceFolder.uri.fsPath, 'AgentTracker.md')
}

/**
 * Resolve the .agentsync.json path for a workspace folder.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getConfigPath(workspaceFolder) {
  return path.join(workspaceFolder.uri.fsPath, '.agentsync.json')
}

/**
 * Whether a parsed value should be treated as empty.
 * @param {string | undefined | null} value
 */
function isEmptyValue(value) {
  const normalized = (value || '').trim()
  return normalized.length === 0 || normalized === PLACEHOLDER || normalized === '—'
}

/**
 * Parse AgentTracker.md content for status and automation.
 * @param {string} content
 */
function parseTracker(content) {
  const pick = (label) => {
    const match = content.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`))
    return match?.[1]?.trim() ?? PLACEHOLDER
  }

  return {
    agent: pick('Agent'),
    date: pick('Date'),
    summary: pick('Summary'),
    branch: pick('Branch'),
    commit: pick('Commit')
  }
}

/**
 * Escape a string for use in a regular expression.
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Get the content body for a given section heading.
 * @param {string} content
 * @param {string} heading
 * @returns {string}
 */
function getSectionBody(content, heading) {
  const matcher = new RegExp(
    `## ${escapeRegExp(heading)}\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`,
    'm'
  )
  const match = content.match(matcher)
  return match?.[1]?.trim() ?? ''
}

/**
 * Replace a section body and keep the rest of the document intact.
 * @param {string} content
 * @param {string} heading
 * @param {string} body
 * @returns {string}
 */
function setSectionBody(content, heading, body) {
  const normalizedBody = body.trimEnd()
  const matcher = new RegExp(
    `(## ${escapeRegExp(heading)}\\r?\\n\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |$)`,
    'm'
  )

  if (matcher.test(content)) {
    return content.replace(matcher, `$1${normalizedBody}\n`)
  }

  return `${content.trimEnd()}\n\n## ${heading}\n\n${normalizedBody}\n`
}

/**
 * Get active workspace folder without showing prompts.
 * @returns {vscode.WorkspaceFolder | null}
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
 * @returns {Promise<vscode.WorkspaceFolder | null>}
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
 * Read optional AgentSync configuration.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function readAgentSyncConfig(workspaceFolder) {
  const defaults = { staleAfterHours: DEFAULT_STALE_HOURS, commands: {} }
  const configPath = getConfigPath(workspaceFolder)
  if (!fs.existsSync(configPath)) return defaults

  try {
    const raw = fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, '')
    const parsed = JSON.parse(raw)
    const staleAfterHours = Number(parsed.staleAfterHours)

    return {
      staleAfterHours:
        Number.isFinite(staleAfterHours) && staleAfterHours > 0
          ? staleAfterHours
          : DEFAULT_STALE_HOURS,
      commands: parsed.commands && typeof parsed.commands === 'object' ? parsed.commands : {}
    }
  } catch {
    return defaults
  }
}

/**
 * Run a git command and return stdout when successful.
 * @param {vscode.WorkspaceFolder} workspaceFolder
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
 * @param {vscode.WorkspaceFolder} workspaceFolder
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
 * Run a shell command for build/test/deploy checks.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} command
 * @returns {{ ok: boolean }}
 */
function runCheckCommand(workspaceFolder, command) {
  if (!command || !command.trim()) return { ok: false }

  const result = cp.spawnSync(command, {
    cwd: workspaceFolder.uri.fsPath,
    encoding: 'utf8',
    shell: true,
    timeout: 10 * 60 * 1000
  })

  return { ok: !result.error && result.status === 0 }
}

/**
 * Detect changed files for Hot Files using git.
 * @param {vscode.WorkspaceFolder} workspaceFolder
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
 * Execute configured health checks and return status rows.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
function runHealthChecks(workspaceFolder) {
  const config = readAgentSyncConfig(workspaceFolder)
  const commandMap = {
    Build: config.commands?.build,
    Tests: config.commands?.test || config.commands?.tests,
    Deploy: config.commands?.deploy
  }

  const results = {}
  for (const [label, command] of Object.entries(commandMap)) {
    if (!command || !String(command).trim()) {
      results[label] = 'Not configured'
      continue
    }

    const { ok } = runCheckCommand(workspaceFolder, String(command))
    results[label] = ok ? 'Pass' : 'Fail'
  }

  return results
}

/**
 * Format Current Health section as a markdown table.
 * @param {{ Build: string, Tests: string, Deploy: string }} health
 * @returns {string}
 */
function formatHealthTable(health) {
  return [
    '| Check  | Status |',
    '| ------ | ------ |',
    `| Build  | ${health.Build} |`,
    `| Tests  | ${health.Tests} |`,
    `| Deploy | ${health.Deploy} |`
  ].join('\n')
}

/**
 * Prompt user for the acting agent.
 * @param {string} defaultAgent
 * @returns {Promise<string | null>}
 */
async function promptForAgent(defaultAgent) {
  const preset = ['Claude', 'Codex', 'Copilot']
  const defaultLabel = !isEmptyValue(defaultAgent) ? defaultAgent : 'Codex'

  const choice = await vscode.window.showQuickPick(
    [
      ...preset.map((name) => ({
        label: name,
        description: name === defaultLabel ? 'default' : undefined
      })),
      { label: 'Other' }
    ],
    { placeHolder: 'Select the agent for this session' }
  )

  if (!choice) return null
  if (choice.label !== 'Other') return choice.label

  const custom = await vscode.window.showInputBox({
    prompt: 'Enter agent name',
    value: defaultLabel !== 'Codex' ? defaultLabel : ''
  })
  if (custom === undefined) return null

  const trimmed = custom.trim()
  return trimmed || null
}

/**
 * Open a tracker file in the editor.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 */
async function openTrackerDocument(workspaceFolder) {
  const trackerPath = getTrackerPath(workspaceFolder)
  const doc = await vscode.workspace.openTextDocument(trackerPath)
  await vscode.window.showTextDocument(doc)
}

/**
 * Ensure tracker exists, optionally offering initialization.
 * @param {vscode.ExtensionContext} context
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {Promise<boolean>}
 */
async function ensureTrackerExists(context, workspaceFolder) {
  const trackerPath = getTrackerPath(workspaceFolder)
  if (fs.existsSync(trackerPath)) return true

  const choice = await vscode.window.showWarningMessage(
    `AgentTracker.md not found in "${workspaceFolder.name}". Initialize this workspace first?`,
    'Initialize',
    'Cancel'
  )

  if (choice !== 'Initialize') return false
  await initWorkspace(context, workspaceFolder)
  return fs.existsSync(trackerPath)
}

/**
 * Read tracker file content.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string | null}
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
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @param {string} content
 */
function writeTracker(workspaceFolder, content) {
  fs.writeFileSync(getTrackerPath(workspaceFolder), content, 'utf8')
}

/**
 * Return warning strings for stale tracker/branch drift.
 * @param {vscode.WorkspaceFolder} workspaceFolder
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
    const exitCode = runGitExitCode(workspaceFolder, ['merge-base', '--is-ancestor', tracker.commit, 'HEAD'])
    if (exitCode !== 0) {
      warnings.push(`Tracker commit ${tracker.commit} is not in current HEAD history.`)
    }
  }

  return warnings
}

/**
 * Format text prefix for multi-root workspaces.
 * @param {vscode.WorkspaceFolder} workspaceFolder
 * @returns {string}
 */
function getWorkspaceLabelPrefix(workspaceFolder) {
  const count = vscode.workspace.workspaceFolders?.length ?? 0
  return count > 1 ? `${workspaceFolder.name}: ` : ''
}

/**
 * Update status bar item from current AgentTracker.md state.
 * @param {vscode.StatusBarItem} statusItem
 */
function updateStatusBar(statusItem) {
  const workspaceFolder = getActiveWorkspaceFolder()

  if (!workspaceFolder) {
    statusItem.text = '$(sync) AgentSync'
    statusItem.tooltip = 'No workspace open'
    statusItem.show()
    return
  }

  const trackerPath = getTrackerPath(workspaceFolder)
  const prefix = getWorkspaceLabelPrefix(workspaceFolder)

  if (!fs.existsSync(trackerPath)) {
    statusItem.text = `$(sync) ${prefix}AgentSync`
    statusItem.tooltip = `AgentTracker not initialized for ${workspaceFolder.name}.\nRun "AgentSync: Initialize Workspace".`
    statusItem.show()
    return
  }

  try {
    const tracker = parseTracker(fs.readFileSync(trackerPath, 'utf8'))
    const warnings = getTrackerWarnings(workspaceFolder, tracker)
    const icon = warnings.length > 0 ? '$(warning)' : '$(sync)'
    const label = !isEmptyValue(tracker.agent) ? tracker.agent : 'AgentSync'

    statusItem.text = `${icon} ${prefix}${label}`

    const tooltipLines = []
    if (!isEmptyValue(tracker.agent) || !isEmptyValue(tracker.date)) {
      tooltipLines.push(`Last session: ${tracker.agent} | ${tracker.date}`)
    }
    if (!isEmptyValue(tracker.branch) || !isEmptyValue(tracker.commit)) {
      tooltipLines.push(`Branch: ${tracker.branch} | Commit: ${tracker.commit}`)
    }
    if (warnings.length > 0) {
      tooltipLines.push('', 'Warnings:')
      warnings.forEach((warning) => tooltipLines.push(`- ${warning}`))
    }
    tooltipLines.push('', 'Click to open AgentTracker')
    statusItem.tooltip = tooltipLines.join('\n')
  } catch {
    statusItem.text = `$(sync) ${prefix}AgentSync`
    statusItem.tooltip = `Could not read AgentTracker.md for ${workspaceFolder.name}`
  }

  statusItem.show()
}

/**
 * Initialize the workspace with AgentSync protocol files.
 * @param {vscode.ExtensionContext} context
 * @param {vscode.WorkspaceFolder | null} selectedFolder
 */
async function initWorkspace(context, selectedFolder = null) {
  const workspaceFolder = selectedFolder || (await resolveWorkspaceFolder({ allowPick: true }))
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
    { src: 'AgentTracker.md', dest: 'AgentTracker.md' },
    { src: 'agentsync.json', dest: '.agentsync.json' }
  ]

  let created = 0
  let skipped = 0

  for (const file of filesToCreate) {
    const destPath = path.join(root, file.dest)
    const srcPath = path.join(templatesDir, file.src)

    if (fs.existsSync(destPath)) {
      const choice = await vscode.window.showWarningMessage(
        `${file.dest} already exists in ${workspaceFolder.name}. Overwrite?`,
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

  vscode.window.showInformationMessage(
    `AgentSync: Workspace "${workspaceFolder.name}" initialized. ${summary}`
  )

  const trackerPath = getTrackerPath(workspaceFolder)
  if (fs.existsSync(trackerPath)) {
    await openTrackerDocument(workspaceFolder)
  }
}

/**
 * Open AgentTracker.md in the editor.
 * @param {vscode.ExtensionContext} context
 */
async function openTracker(context) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const ready = await ensureTrackerExists(context, workspaceFolder)
  if (!ready) return

  await openTrackerDocument(workspaceFolder)
}

/**
 * Start a session and append an In Progress entry.
 * @param {vscode.ExtensionContext} context
 */
async function startSession(context) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const ready = await ensureTrackerExists(context, workspaceFolder)
  if (!ready) return

  const content = readTracker(workspaceFolder)
  if (!content) {
    vscode.window.showErrorMessage('AgentSync: Could not read AgentTracker.md.')
    return
  }

  const tracker = parseTracker(content)
  const agent = await promptForAgent(tracker.agent)
  if (!agent) return

  const goal = await vscode.window.showInputBox({
    prompt: 'What are you working on this session?',
    placeHolder: 'Example: Implement auth callback retries'
  })
  if (goal === undefined) return

  const entry = `- [ ] ${agent} (${new Date().toISOString()}): ${goal.trim() || 'Session started'}`
  const currentBody = getSectionBody(content, 'In Progress')
  const currentLines = currentBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('<!--'))
    .filter((line) => line && line.toLowerCase() !== '*nothing active*')

  const updatedBody = [...currentLines, entry].join('\n')
  const updated = setSectionBody(content, 'In Progress', updatedBody || '*Nothing active*')
  writeTracker(workspaceFolder, updated)

  await openTrackerDocument(workspaceFolder)
  vscode.window.showInformationMessage(`AgentSync: Session started for ${agent}.`)
}

/**
 * End a session and update Last Session/Health/Hot Files.
 * @param {vscode.ExtensionContext} context
 */
async function endSession(context) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true })
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('AgentSync: No workspace folder is open.')
    return
  }

  const ready = await ensureTrackerExists(context, workspaceFolder)
  if (!ready) return

  let content = readTracker(workspaceFolder)
  if (!content) {
    vscode.window.showErrorMessage('AgentSync: Could not read AgentTracker.md.')
    return
  }

  const parsed = parseTracker(content)
  const agent = await promptForAgent(parsed.agent)
  if (!agent) return

  const summary = await vscode.window.showInputBox({
    prompt: 'One-line session summary',
    placeHolder: 'Example: Added queue retry logic and fixed race condition'
  })
  if (summary === undefined) return

  const nextWork = await vscode.window.showInputBox({
    prompt: 'Suggested next work (optional)',
    placeHolder: 'Leave empty to keep existing notes'
  })
  if (nextWork === undefined) return

  const now = new Date().toISOString()
  const branch = runGit(workspaceFolder, ['rev-parse', '--abbrev-ref', 'HEAD']) || PLACEHOLDER
  const commit = runGit(workspaceFolder, ['rev-parse', '--short', 'HEAD']) || PLACEHOLDER
  const hotFiles = detectHotFiles(workspaceFolder)
  const health = runHealthChecks(workspaceFolder)

  content = setSectionBody(
    content,
    'Last Session',
    [
      `- **Agent:** ${agent}`,
      `- **Date:** ${now}`,
      `- **Summary:** ${summary.trim() || PLACEHOLDER}`,
      `- **Branch:** ${branch}`,
      `- **Commit:** ${commit}`
    ].join('\n')
  )

  content = setSectionBody(content, 'Current Health', formatHealthTable(health))
  content = setSectionBody(
    content,
    'Hot Files',
    hotFiles.length > 0 ? hotFiles.map((file) => `- \`${file}\``).join('\n') : '*None*'
  )

  const inProgressBody = getSectionBody(content, 'In Progress')
  const remainingInProgress = inProgressBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !line.startsWith('<!--'))
    .filter((line) => line)
    .filter((line) => line.toLowerCase() !== '*nothing active*')
    .filter((line) => !line.toLowerCase().includes(agent.toLowerCase()))

  content = setSectionBody(
    content,
    'In Progress',
    remainingInProgress.length > 0 ? remainingInProgress.join('\n') : '*Nothing active*'
  )

  if (nextWork.trim()) {
    const existingNext = getSectionBody(content, 'Suggested Next Work')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => !line.startsWith('<!--'))
      .filter((line) => line)

    content = setSectionBody(content, 'Suggested Next Work', [...existingNext, `- ${nextWork.trim()}`].join('\n'))
  }

  writeTracker(workspaceFolder, content)
  await openTrackerDocument(workspaceFolder)

  const failedChecks = Object.values(health).filter((status) => status === 'Fail').length
  const summaryMessage =
    failedChecks > 0
      ? `AgentSync: Session ended. ${failedChecks} health check(s) failed.`
      : 'AgentSync: Session ended and tracker updated.'

  vscode.window.showInformationMessage(summaryMessage)
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99)
  statusItem.command = 'agentsync.openTracker'
  updateStatusBar(statusItem)

  const trackerWatcher = vscode.workspace.createFileSystemWatcher('**/AgentTracker.md')
  trackerWatcher.onDidChange(() => updateStatusBar(statusItem))
  trackerWatcher.onDidCreate(() => updateStatusBar(statusItem))
  trackerWatcher.onDidDelete(() => updateStatusBar(statusItem))

  const configWatcher = vscode.workspace.createFileSystemWatcher('**/.agentsync.json')
  configWatcher.onDidChange(() => updateStatusBar(statusItem))
  configWatcher.onDidCreate(() => updateStatusBar(statusItem))
  configWatcher.onDidDelete(() => updateStatusBar(statusItem))

  const onEditorChange = vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar(statusItem))
  const onWorkspaceChange = vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar(statusItem))

  const initCmd = vscode.commands.registerCommand('agentsync.init', () => initWorkspace(context))
  const openCmd = vscode.commands.registerCommand('agentsync.openTracker', () => openTracker(context))
  const startCmd = vscode.commands.registerCommand('agentsync.startSession', () => startSession(context))
  const endCmd = vscode.commands.registerCommand('agentsync.endSession', () => endSession(context))

  context.subscriptions.push(
    statusItem,
    trackerWatcher,
    configWatcher,
    onEditorChange,
    onWorkspaceChange,
    initCmd,
    openCmd,
    startCmd,
    endCmd
  )
}

function deactivate() {}

module.exports = { activate, deactivate }
