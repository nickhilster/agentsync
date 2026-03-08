'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const { _testExports } = require('../../src/extension')
const {
  createHandoffRecord,
  claimHandoffRecord,
  completeHandoffRecord,
  listHandoffRecords
} = _testExports

function makeWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsync-handoff-'))
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

describe('handoff lifecycle transitions', () => {
  test('supports queued -> in_progress -> blocked -> ready_for_review -> approved -> merged', () => {
    const { root, folder } = makeWorkspace()
    try {
      const created = createHandoffRecord(folder, {
        from_agent: 'codex',
        owner_mode: 'single',
        to_agents: ['claude'],
        summary: 'Implement feature X'
      })
      expect(created.status).toBe('queued')

      const claim = claimHandoffRecord(folder, created.handoff_id, 'claude')
      expect(claim.ok).toBe(true)

      expect(completeHandoffRecord(folder, created.handoff_id, 'blocked', 'claude').ok).toBe(true)
      expect(
        completeHandoffRecord(folder, created.handoff_id, 'ready_for_review', 'claude').ok
      ).toBe(true)
      expect(completeHandoffRecord(folder, created.handoff_id, 'approved', 'claude').ok).toBe(true)
      expect(completeHandoffRecord(folder, created.handoff_id, 'merged', 'claude').ok).toBe(true)

      const handoffs = listHandoffRecords(folder)
      expect(handoffs).toHaveLength(1)
      expect(handoffs[0].status).toBe('merged')
      const historyStatuses = handoffs[0].state_history.map((h) => h.status)
      expect(historyStatuses).toEqual([
        'queued',
        'in_progress',
        'blocked',
        'ready_for_review',
        'approved',
        'merged'
      ])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('prevents double-claim race by rejecting second claimant', () => {
    const { root, folder } = makeWorkspace()
    try {
      const created = createHandoffRecord(folder, {
        from_agent: 'codex',
        owner_mode: 'single',
        to_agents: ['claude'],
        summary: 'Fix bug'
      })
      const first = claimHandoffRecord(folder, created.handoff_id, 'claude')
      const second = claimHandoffRecord(folder, created.handoff_id, 'copilot')
      expect(first.ok).toBe(true)
      expect(second.ok).toBe(false)
      expect(second.reason).toBe('already_claimed')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
