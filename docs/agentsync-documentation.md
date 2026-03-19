# AgentSync Documentation

## Overview

AgentSync coordinates multi-agent workflows (Claude, Codex, Copilot, and Agency-style pipelines) in a shared repository using local-first artifacts:

- `AgentTracker.md` (human handoff log)
- `.agentsync/state.json` (session/runtime state)
- `.agentsync/handoffs.json` (machine-readable handoffs)
- `.agentsync/context-capsule.json` (deterministic context package)

## Command Surface

Primary commands:

- `agentsync.init`
- `agentsync.startSession`
- `agentsync.endSession`
- `agentsync.clearActiveSession`
- `agentsync.openDashboard`
- `agentsync.openHandoffs`
- `agentsync.contextStatus`

Handoff lifecycle commands:

- `agentsync.listHandoffs`
- `agentsync.claimHandoff`
- `agentsync.completeHandoff`

Agency/context commands:

- `agentsync.contextCapsule`
- `agentsync.syncAgencyRuns`

## Drop-zone API

Supported `.agentsync/request.json` actions:

- `startSession`
- `endSession`
- `status`
- `health`
- `listHandoffs`
- `claimHandoff`
- `completeHandoff`
- `createHandoff`
- `syncAgencyRuns`

Results are written to `.agentsync/result.json`.

## Runtime Model

- Activation: `onStartupFinished`.
- Uses coalesced/debounced refresh scheduling to avoid duplicate recompute bursts.
- Uses snapshot caching for tracker/config/state/handoff reads.
- Uses hot-file git caching with TTL + invalidation.
- Watches:
  - `**/AgentTracker.md`
  - `**/.agentsync.json`
  - `**/.agentsync/state.json`
  - `**/.agentsync/handoffs.json`
  - `**/.agentsync/request.json`
  - `**/.agencysync/runs.json`
  - `**/.agencysync/events/**/*.json`

## State and Schema Notes

- `state.json` now records integration metadata including:
  - `integration.lastAgencySyncAt`
  - `integration.snapshot.version`
  - `integration.snapshot.hash`
- `handoffs.schema.json` includes provenance fields:
  - `source_system`
  - `source_run_id`
  - `source_event_id`
- Skip/no-handoff records are normalized to schema-compatible `owner_mode: "auto"` with `to_agents: []`.

## Testing

- Jest test suite includes parser/utility coverage plus handoff lifecycle and drop-zone contract tests.
- Coverage collection targets `src/**/*.js` and `scripts/**/*.js`.

## Current Risks

- `src/extension.js` remains large; further modular extraction is still recommended.
- Markdown-based tracker parsing remains format-sensitive.
- Agency ingest uses deterministic heuristic mapping; event schemas should be tightened over time.
