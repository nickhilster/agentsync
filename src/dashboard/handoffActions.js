'use strict'

const vscode = require('vscode')
const SessionManager = require('../session/SessionManager')
const { EXECUTION_PROVIDER_DEFS, getSessionProviderInfo, getExecutionProviderId, getExecutionProviderLabel } = require('../session/providers')
const { getPersonalityDisplayName } = require('../session/personalities')
const { PLACEHOLDER } = require('../utils/constants')
const { toSingleLine, canonicalAgentId } = require('../utils/text')
const { readStateFile, writeStateFile, readHandoffs, writeHandoffs } = require('../utils/storage')
const {
  claimHandoffRecord,
  syncTrackerHandoffsSection,
  getHandoffPersonalityId
} = require('../utils/handoffs')
const {
  assembleAgentPrompt,
  deliverPrompt,
  injectPersonalityToWorkspace
} = require('../utils/executionChannels')
const { buildSessionIdentity } = require('../utils/session')
const { getAgentCatalog, matchAgentsByCapabilities } = require('../utils/agentCatalog')

async function promptForAgent(defaultAgent) {
  const defaultLabel = getExecutionProviderLabel(defaultAgent) || 'Codex'
  const builtIn = EXECUTION_PROVIDER_DEFS.map((provider) => ({
    label: provider.label,
    description: provider.label === defaultLabel ? 'default' : undefined
  }))

  const choice = await vscode.window.showQuickPick(
    [...builtIn, { label: 'Other' }],
    { placeHolder: 'Select the execution provider for this session' }
  )

  if (!choice) return null
  if (choice.label !== 'Other') return choice.label

  const custom = await vscode.window.showInputBox({
    prompt: 'Enter provider name',
    value: defaultLabel !== 'Codex' ? defaultLabel : ''
  })
  if (custom === undefined) return null

  const trimmed = custom.trim()
  return trimmed || null
}

function updateActiveSessionContext(workspaceFolder, updates = {}) {
  const state = readStateFile(workspaceFolder) || {}
  if (!state?.sessionActive || !state?.activeSession) return null

  const nextSession = {
    ...state.activeSession,
    ...updates
  }

  writeStateFile(workspaceFolder, {
    ...state,
    lastUpdated: new Date().toISOString(),
    activeSession: nextSession
  })
  return nextSession
}

function updateHandoffPromptCopiedFlag(workspaceFolder, handoffId, copied) {
  const normalizedId = toSingleLine(handoffId)
  if (!normalizedId) return

  const store = readHandoffs(workspaceFolder)
  if (!store.handoffs.length) return

  const next = store.handoffs.map((handoff) => {
    if (toSingleLine(handoff?.handoff_id) !== normalizedId) return handoff
    return {
      ...handoff,
      prompt_copied_to_clipboard: copied === true,
      updated_at: new Date().toISOString()
    }
  })

  writeHandoffs(workspaceFolder, { version: 1, handoffs: next })
}

function resolveHandoffPersonality(workspaceFolder, handoff, overridePersonalityId = null) {
  const catalog = getAgentCatalog(workspaceFolder)
  if (!catalog || !Array.isArray(catalog.agents) || catalog.agents.length === 0) return null

  const explicitId = canonicalAgentId(overridePersonalityId || getHandoffPersonalityId(handoff))
  if (explicitId) {
    const direct = catalog.agents.find((agent) => canonicalAgentId(agent.id) === explicitId)
    if (direct) return direct
  }

  const matched = matchAgentsByCapabilities(catalog.agents, handoff?.required_capabilities || [])
  return matched[0] || null
}

function buildHandoffExecutionInstruction(handoff) {
  const lines = [String(handoff?.summary || 'Continue the queued work').trim()]

  if (handoff?.notes) {
    lines.push('', 'Notes:', String(handoff.notes).trim())
  }

  if (Array.isArray(handoff?.files) && handoff.files.length > 0) {
    lines.push('', 'Start with these files:')
    handoff.files.forEach((file) => lines.push('- ' + file))
  }

  if (handoff?.branch || handoff?.commit) {
    lines.push('', `Branch: ${handoff?.branch || PLACEHOLDER}`)
    lines.push(`Commit: ${handoff?.commit || PLACEHOLDER}`)
  }

  return lines.join('\n')
}

async function runHandoffStep(workspaceFolder, handoff, providerLabel, options = {}) {
  const providerId = getExecutionProviderId(providerLabel)
  const providerDisplay = getExecutionProviderLabel(providerLabel) || String(providerLabel || 'Unknown')
  const normalizedHandoffId = toSingleLine(handoff?.handoff_id)
  const result = claimHandoffRecord(workspaceFolder, normalizedHandoffId, providerDisplay)
  if (!result.ok) {
    vscode.window.showWarningMessage(
      `AgentSync: Could not claim ${handoff?.handoff_id || 'handoff'} (${result.reason || 'unknown reason'}).`
    )
    return false
  }

  syncTrackerHandoffsSection(workspaceFolder)

  const personality = resolveHandoffPersonality(
    workspaceFolder,
    handoff,
    options.personalityId || null
  )
  const personalityId =
    personality?.id ||
    canonicalAgentId(options.personalityId || getHandoffPersonalityId(handoff) || '') ||
    null
  const personalityName =
    personality?.name || getPersonalityDisplayName(workspaceFolder, personalityId) || null

  if (personality && normalizedHandoffId) {
    const store = readHandoffs(workspaceFolder)
    const next = store.handoffs.map((entry) => {
      if (toSingleLine(entry?.handoff_id) !== normalizedHandoffId) return entry
      return {
        ...entry,
        suggested_agent_personality_id: personality.id,
        updated_at: new Date().toISOString()
      }
    })
    writeHandoffs(workspaceFolder, { version: 1, handoffs: next })
  }

  if (personality) {
    injectPersonalityToWorkspace(workspaceFolder.uri.fsPath, personality)
  }

  if (options.ensureSession) {
    SessionManager.startSessionCore(
      workspaceFolder,
      providerDisplay,
      toSingleLine(handoff?.summary) || 'Continue queued work',
      {
        providerId,
        providerLabel: providerDisplay,
        personalityId,
        personalityName
      }
    )
  } else {
    updateActiveSessionContext(workspaceFolder, {
      ...buildSessionIdentity(workspaceFolder, providerDisplay, {
        providerId,
        providerLabel: providerDisplay,
        personalityId,
        personalityName
      }),
      goal: toSingleLine(handoff?.summary) || 'Continue queued work'
    })
  }

  const instruction = buildHandoffExecutionInstruction(handoff)
  const assembledPrompt = personality
    ? assembleAgentPrompt(personality, instruction, { contextFiles: handoff?.files || [] })
    : ['# Task', '', instruction].join('\n')
  const delivery = await deliverPrompt('clipboard', { vscodeEnv: vscode.env }, assembledPrompt)
  updateHandoffPromptCopiedFlag(workspaceFolder, handoff?.handoff_id, delivery.ok)

  if (delivery.ok) {
    const suffix = personalityName ? ` Personality: ${personalityName}.` : ''
    vscode.window.showInformationMessage(
      `AgentSync: Next step prepared for ${providerDisplay}.${suffix} Prompt copied to clipboard.`
    )
    return true
  }

  vscode.window.showErrorMessage('AgentSync: Failed to copy the next-step prompt to clipboard.')
  return false
}

/**
 * Process handoff actions (claim, start, skip) triggered from the dashboard.
 */
async function handleHandoffAction(workspaceFolder, message, refreshCallback) {
  const action = String(message?.action || '').trim()
  const handoffId = toSingleLine(message?.handoffId)
  const personalityId = toSingleLine(message?.personalityId) || null
  if (!action || !handoffId) return

  const state = readStateFile(workspaceFolder) || {}
  const activeProvider = getSessionProviderInfo(state?.activeSession || null)
  const lastProvider = getSessionProviderInfo(state?.lastSession || null)
  const currentProvider =
    activeProvider.label !== 'Unknown' ? activeProvider.label : lastProvider.label

  if (action === 'claim') {
    if (!currentProvider || currentProvider === 'Unknown') {
      vscode.window.showErrorMessage('No active provider identity found to claim handoff.')
      return
    }

    const result = claimHandoffRecord(workspaceFolder, handoffId, currentProvider)
    if (result.ok) {
      syncTrackerHandoffsSection(workspaceFolder)
      vscode.window.showInformationMessage(`AgentSync: Claimed handoff ${handoffId}.`)
      if (refreshCallback) refreshCallback()
    } else {
      vscode.window.showWarningMessage(
        `AgentSync: Could not claim ${handoffId} (${result.reason || 'unknown reason'}).`
      )
    }
    return
  }

  const { handoffs } = readHandoffs(workspaceFolder)
  const handoff = handoffs.find((entry) => toSingleLine(entry?.handoff_id) === handoffId)
  if (!handoff) {
    vscode.window.showErrorMessage(`AgentSync: Handoff ${handoffId} not found.`)
    return
  }

  if (action === 'start') {
    let providerLabel = currentProvider
    if (!state?.sessionActive) {
      providerLabel = await promptForAgent(currentProvider || 'Codex')
      if (!providerLabel) return
    }

    await runHandoffStep(workspaceFolder, handoff, providerLabel, {
      ensureSession: !state?.sessionActive,
      personalityId
    })
    if (refreshCallback) refreshCallback()
    return
  }

  if (action === 'skip') {
    const now = new Date().toISOString()
    const updated = handoffs.map((entry) => {
      if (toSingleLine(entry?.handoff_id) !== handoffId) return entry
      return {
        ...entry,
        status: 'blocked',
        updated_at: now,
        state_history: [
          ...(Array.isArray(entry.state_history) ? entry.state_history : []),
          {
            status: 'blocked',
            agent: canonicalAgentId(currentProvider),
            timestamp: now,
            reason: 'skipped via dashboard'
          }
        ]
      }
    })
    writeHandoffs(workspaceFolder, { version: 1, handoffs: updated })
    syncTrackerHandoffsSection(workspaceFolder)
    vscode.window.showInformationMessage(`AgentSync: Handoff ${handoffId} marked as skipped.`)
    if (refreshCallback) refreshCallback()
  }
}

module.exports = { handleHandoffAction }
