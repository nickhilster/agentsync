'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const { _testExports } = require('../../src/extension')
const {
  createHandoffRecord,
  claimHandoffRecord,
  completeHandoffRecord,
  listHandoffRecords,
  getHandoffOwners,
  listRunnableQueuedHandoffs
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

  test('treats legacy pipeline personality owners as provider-flex during claim', () => {
    const { root, folder } = makeWorkspace()
    try {
      const now = new Date().toISOString()
      const legacy = {
        version: 1,
        handoffs: [
          {
            handoff_id: 'HO-LEGACY-001',
            from_agent: 'codex',
            to_agents: ['engineering/engineering-ai-engineer'],
            owner_mode: 'single',
            status: 'queued',
            required_capabilities: ['implementation'],
            summary: 'Pipeline step 1/2: Implement the feature',
            notes: 'Personality: AI Engineer',
            files: [],
            branch: 'main',
            commit: 'abc123',
            chain_id: 'CHAIN-LEGACY',
            chain_step: 1,
            chain_total: 2,
            agent_personality_id: 'engineering/engineering-ai-engineer',
            created_at: now,
            updated_at: now,
            state_history: [
              { status: 'queued', agent: 'codex', timestamp: now, reason: 'pipeline created' }
            ]
          }
        ]
      }
      fs.writeFileSync(
        path.join(root, '.agentsync', 'handoffs.json'),
        JSON.stringify(legacy, null, 2),
        'utf8'
      )

      const handoff = listHandoffRecords(folder)[0]
      expect(getHandoffOwners(handoff)).toEqual([])

      const claim = claimHandoffRecord(folder, 'HO-LEGACY-001', 'gemini')
      expect(claim.ok).toBe(true)
      expect(listHandoffRecords(folder)[0].status).toBe('in_progress')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('auto-advances the next pipeline step when a step reaches a terminal status', () => {
    const { root, folder } = makeWorkspace()
    try {
      const now = new Date().toISOString()
      const pipeline = {
        version: 1,
        handoffs: [
          {
            handoff_id: 'HO-CHAIN-001',
            from_agent: 'codex',
            to_agents: [],
            owner_mode: 'auto',
            status: 'queued',
            required_capabilities: ['implementation'],
            summary: 'Pipeline step 1/2: Build it',
            notes: 'Personality: Senior Developer',
            files: [],
            branch: 'main',
            commit: 'abc123',
            chain_id: 'CHAIN-001',
            chain_step: 1,
            chain_total: 2,
            agent_personality_id: 'engineering/engineering-senior-developer',
            created_at: now,
            updated_at: now,
            state_history: [
              { status: 'queued', agent: 'codex', timestamp: now, reason: 'pipeline created' }
            ]
          },
          {
            handoff_id: 'HO-CHAIN-002',
            from_agent: 'engineering/engineering-senior-developer',
            to_agents: [],
            owner_mode: 'auto',
            status: 'blocked',
            required_capabilities: ['testing'],
            summary: 'Pipeline step 2/2: Verify it',
            notes: 'Personality: API Tester',
            files: [],
            branch: 'main',
            commit: 'abc123',
            chain_id: 'CHAIN-001',
            chain_step: 2,
            chain_total: 2,
            agent_personality_id: 'testing/testing-api-tester',
            created_at: now,
            updated_at: now,
            state_history: [
              { status: 'blocked', agent: 'codex', timestamp: now, reason: 'pipeline created' }
            ]
          }
        ]
      }
      fs.writeFileSync(
        path.join(root, '.agentsync', 'handoffs.json'),
        JSON.stringify(pipeline, null, 2),
        'utf8'
      )

      expect(claimHandoffRecord(folder, 'HO-CHAIN-001', 'claude').ok).toBe(true)
      expect(completeHandoffRecord(folder, 'HO-CHAIN-001', 'ready_for_review', 'claude').ok).toBe(
        true
      )

      const handoffs = listHandoffRecords(folder)
      expect(handoffs.find((h) => h.handoff_id === 'HO-CHAIN-001').status).toBe('ready_for_review')
      expect(handoffs.find((h) => h.handoff_id === 'HO-CHAIN-002').status).toBe('queued')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  test('lists provider-flex and provider-matched queued handoffs as runnable', () => {
    const { root, folder } = makeWorkspace()
    try {
      const now = new Date().toISOString()
      const handoffs = {
        version: 1,
        handoffs: [
          {
            handoff_id: 'HO-RUN-001',
            from_agent: 'codex',
            to_agents: [],
            owner_mode: 'auto',
            status: 'queued',
            required_capabilities: ['implementation'],
            summary: 'Provider-flex work',
            created_at: now,
            updated_at: now,
            state_history: [{ status: 'queued', agent: 'codex', timestamp: now, reason: 'created' }]
          },
          {
            handoff_id: 'HO-RUN-002',
            from_agent: 'codex',
            to_agents: ['claude'],
            owner_mode: 'single',
            status: 'queued',
            required_capabilities: [],
            summary: 'Claude-only work',
            created_at: now,
            updated_at: now,
            state_history: [{ status: 'queued', agent: 'codex', timestamp: now, reason: 'created' }]
          }
        ]
      }
      fs.writeFileSync(
        path.join(root, '.agentsync', 'handoffs.json'),
        JSON.stringify(handoffs, null, 2),
        'utf8'
      )

      expect(listRunnableQueuedHandoffs(folder, 'claude').map((h) => h.handoff_id)).toEqual([
        'HO-RUN-001',
        'HO-RUN-002'
      ])
      expect(listRunnableQueuedHandoffs(folder, 'gemini').map((h) => h.handoff_id)).toEqual([
        'HO-RUN-001'
      ])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
