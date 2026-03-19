'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const { _testExports } = require('../../src/extension')
const { processDropZoneRequest } = _testExports

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsync-dropzone-'))
  fs.mkdirSync(path.join(root, '.agentsync'), { recursive: true })
  fs.writeFileSync(
    path.join(root, '.agentsync', 'handoffs.json'),
    JSON.stringify({ version: 1, handoffs: [] }, null, 2),
    'utf8'
  )
  return {
    root,
    folder: { name: 'tmp', uri: { fsPath: root } }
  }
}

function writeRequest(root, payload) {
  fs.writeFileSync(path.join(root, '.agentsync', 'request.json'), JSON.stringify(payload, null, 2), 'utf8')
}

function readResult(root) {
  const raw = fs.readFileSync(path.join(root, '.agentsync', 'result.json'), 'utf8')
  return JSON.parse(raw)
}

function readHandoffs(root) {
  const raw = fs.readFileSync(path.join(root, '.agentsync', 'handoffs.json'), 'utf8')
  return JSON.parse(raw).handoffs
}

describe('drop-zone action contracts', () => {
  test('create/list/claim/complete handoff actions', async () => {
    const { root, folder } = makeWorkspace()
    try {
      writeRequest(root, {
        action: 'createHandoff',
        handoff: {
          from_agent: 'codex',
          owner_mode: 'single',
          to_agents: ['claude'],
          summary: 'Implement queue retry'
        }
      })
      await processDropZoneRequest(folder)
      let result = readResult(root)
      expect(result.ok).toBe(true)
      expect(result.action).toBe('createHandoff')
      const createdId = result.data.handoff.handoff_id
      expect(createdId).toBeTruthy()

      writeRequest(root, { action: 'listHandoffs' })
      await processDropZoneRequest(folder)
      result = readResult(root)
      expect(result.ok).toBe(true)
      expect(result.data.count).toBe(1)

      writeRequest(root, { action: 'claimHandoff', handoffId: createdId, agent: 'claude' })
      await processDropZoneRequest(folder)
      result = readResult(root)
      expect(result.ok).toBe(true)

      writeRequest(root, {
        action: 'completeHandoff',
        handoffId: createdId,
        agent: 'claude',
        status: 'merged'
      })
      await processDropZoneRequest(folder)
      result = readResult(root)
      expect(result.ok).toBe(true)

      const handoffs = readHandoffs(root)
      expect(handoffs[0].status).toBe('merged')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('syncAgencyRuns imports external events', async () => {
    const { root, folder } = makeWorkspace()
    try {
      const eventsDir = path.join(root, '.agencysync', 'events')
      fs.mkdirSync(eventsDir, { recursive: true })
      fs.writeFileSync(
        path.join(eventsDir, 'event-1.json'),
        JSON.stringify({
          event_id: 'evt-1',
          run_id: 'run-1',
          from_agent: 'codex',
          to_agents: ['claude'],
          owner_mode: 'single',
          status: 'queued',
          summary: 'Review retry logic',
          files: ['src/queue.js']
        }),
        'utf8'
      )

      writeRequest(root, { action: 'syncAgencyRuns' })
      await processDropZoneRequest(folder)
      const result = readResult(root)
      expect(result.ok).toBe(true)
      expect(result.action).toBe('syncAgencyRuns')
      expect(result.data.synced).toBeGreaterThanOrEqual(1)

      const handoffs = readHandoffs(root)
      expect(handoffs.length).toBeGreaterThanOrEqual(1)
      expect(handoffs[0].source_system).toBe('agencysync')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
