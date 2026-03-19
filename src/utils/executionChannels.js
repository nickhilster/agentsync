'use strict'

const fs = require('fs')
const path = require('path')
const { createSystemPrompt, createPrompt } = require('./agentCatalog')

// ━━━ Execution Channels ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// Clipboard-first execution: assemble a full prompt (system prompt + agent
// personality + user instruction + context) and copy to the clipboard.  The
// user then pastes into whichever AI tool they already subscribe to.
//
// Drop-zone channel: write the assembled prompt to `.agentsync/agent-prompt.md`
// for terminal agents (Claude Code, Codex) that can read files directly.

/**
 * Assemble a full agent prompt ready for delivery.
 * @param {object} agent - Agent definition from the catalog
 * @param {string} instruction - User instruction
 * @param {{ previousOutput?: string, contextFiles?: string[] }} [options]
 * @returns {string}
 */
function assembleAgentPrompt(agent, instruction, options = {}) {
  const systemPrompt = createSystemPrompt(agent)
  const userPrompt = createPrompt(
    agent,
    instruction,
    options.previousOutput || '',
    options.contextFiles
  )

  return [
    '# System Prompt',
    '',
    systemPrompt,
    '',
    '---',
    '',
    userPrompt
  ].join('\n')
}

/**
 * Copy assembled prompt to the system clipboard.
 * Requires the vscode API to be passed in.
 * @param {object} vscodeEnv - The vscode.env object
 * @param {string} assembledPrompt
 * @returns {Promise<boolean>}
 */
async function copyToClipboard(vscodeEnv, assembledPrompt) {
  try {
    await vscodeEnv.clipboard.writeText(assembledPrompt)
    return true
  } catch {
    return false
  }
}

/**
 * Write assembled prompt to the drop-zone file for terminal agents.
 * @param {string} workspaceRoot - Workspace root path
 * @param {string} assembledPrompt
 * @returns {boolean}
 */
function writeToDropZone(workspaceRoot, assembledPrompt) {
  try {
    const agentSyncDir = path.join(workspaceRoot, '.agentsync')
    fs.mkdirSync(agentSyncDir, { recursive: true })
    const promptPath = path.join(agentSyncDir, 'agent-prompt.md')
    fs.writeFileSync(promptPath, assembledPrompt, 'utf8')
    return true
  } catch {
    return false
  }
}

/**
 * Deliver an assembled prompt via the preferred channel.
 * @param {string} channel - 'clipboard' or 'drop-zone'
 * @param {{ vscodeEnv?: object, workspaceRoot?: string }} context
 * @param {string} assembledPrompt
 * @returns {Promise<{ ok: boolean, channel: string }>}
 */
async function deliverPrompt(channel, context, assembledPrompt) {
  if (channel === 'drop-zone' && context.workspaceRoot) {
    const ok = writeToDropZone(context.workspaceRoot, assembledPrompt)
    return { ok, channel: 'drop-zone' }
  }

  // Default: clipboard
  if (context.vscodeEnv) {
    const ok = await copyToClipboard(context.vscodeEnv, assembledPrompt)
    return { ok, channel: 'clipboard' }
  }

  return { ok: false, channel }
}

// ━━━ Personality injection ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PERSONALITY_SECTION_HEADER = '## Active Agent Personality'
const PERSONALITY_SECTION_REGEX =
  /\n## Active Agent Personality[\s\S]*?(?=\n## [^\n]|\n# [^\n]|$)/

/**
 * Inject an agent personality section into an agent instruction file.
 * @param {string} filePath
 * @param {object} agent - Agent definition from the catalog
 */
function injectPersonalitySection(filePath, agent) {
  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    return // File doesn't exist, skip
  }

  // Remove any existing personality section first
  content = content.replace(PERSONALITY_SECTION_REGEX, '')

  const section = [
    '',
    PERSONALITY_SECTION_HEADER,
    '',
    '**Agent:** ' + agent.name + ' (' + agent.id + ')',
    '**Category:** ' + agent.category,
    '**Description:** ' + agent.description,
    '',
    agent.promptBody,
    ''
  ].join('\n')

  content += section
  fs.writeFileSync(filePath, content, 'utf8')
}

/**
 * Remove the agent personality section from an instruction file.
 * @param {string} filePath
 */
function removePersonalitySection(filePath) {
  let content = ''
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch {
    return // File doesn't exist, skip
  }

  const updated = content.replace(PERSONALITY_SECTION_REGEX, '')
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8')
  }
}

/**
 * Inject personality into all standard agent instruction files.
 * @param {string} workspaceRoot
 * @param {object} agent
 */
function injectPersonalityToWorkspace(workspaceRoot, agent) {
  const files = [
    path.join(workspaceRoot, 'CLAUDE.md'),
    path.join(workspaceRoot, 'AGENTS.md'),
    path.join(workspaceRoot, '.github', 'copilot-instructions.md')
  ]
  for (const filePath of files) {
    injectPersonalitySection(filePath, agent)
  }
}

/**
 * Remove personality from all standard agent instruction files.
 * @param {string} workspaceRoot
 */
function removePersonalityFromWorkspace(workspaceRoot) {
  const files = [
    path.join(workspaceRoot, 'CLAUDE.md'),
    path.join(workspaceRoot, 'AGENTS.md'),
    path.join(workspaceRoot, '.github', 'copilot-instructions.md')
  ]
  for (const filePath of files) {
    removePersonalitySection(filePath)
  }
}

module.exports = {
  assembleAgentPrompt,
  copyToClipboard,
  writeToDropZone,
  deliverPrompt,
  injectPersonalitySection,
  removePersonalitySection,
  injectPersonalityToWorkspace,
  removePersonalityFromWorkspace
}
