# Master Plan: Targeted Agent Handoff Notes

Date: 2026-02-21
Owner: AgentSync maintainers
Status: Planning

## Sources Reviewed

This plan is synthesized from all current questionnaire and answer files:

- `agent-coordination-questions.md`
- `templates/agent_collaboration_questions.md`
- `templates/copilot_claude_integration_automation_questionnaire.md`
- `codex_agent_questionnaire_answers.md`
- `templates/copilot_answers.md`
- `claude-answers.md`

## Problem Statement

AgentSync currently tracks session status but does not enforce structured handoff notes per change set. As a result, agents can finish implementation work without explicit, targeted follow-up ownership for other agents.

Required feature:

- Every time an agent implements changes, they must leave handoff notes.
- Handoff can target one agent or shared ownership across two agents.
- Ownership should support integration-aware routing (who can actually execute each subtask).

## Goals

1. Enforce handoff notes on change-producing sessions.
2. Support both `single-target` and `shared-owners` handoff modes.
3. Add structured, machine-readable handoff data for automation.
4. Keep `AgentTracker.md` human-readable while preserving a strict data model.
5. Expose handoff lifecycle via UI commands and drop-zone API.

## Non-Goals (v1)

- Full autonomous multi-agent scheduler.
- Cross-repo dispatch orchestration.
- Hard dependency on external SaaS integrations.

## Proposed Feature: Targeted Handoff Notes

### Core Concept

Add a new handoff object that links implemented changes to explicit next owners.

Modes:

- `single`: exactly one next owner (example: Codex -> Claude)
- `shared`: two next owners (example: Codex + Copilot co-own next step)
- `auto`: system resolves owner(s) from required capabilities

### Data Model (source of truth)

Store handoffs in `.agentsync/handoffs.json`.

```json
{
  "version": 1,
  "handoffs": [
    {
      "handoff_id": "HO-20260221-001",
      "task_id": "AS-210",
      "from_agent": "codex",
      "to_agents": ["claude", "copilot"],
      "owner_mode": "shared",
      "status": "queued",
      "required_capabilities": ["policy_review", "pr_review"],
      "summary": "Auth timeout fix implemented; needs policy and PR review",
      "notes": "Check regression risk in token refresh path before merge.",
      "no_handoff_reason": null,
      "files": ["src/auth/session.ts", "tests/auth/session.test.ts"],
      "branch": "codex/as-210-auth-timeout",
      "commit": "abc1234",
      "prior_attempts": 0,
      "created_at": "2026-02-21T21:00:00.000Z",
      "updated_at": "2026-02-21T21:00:00.000Z",
      "state_history": [
        { "status": "queued", "agent": "codex", "timestamp": "2026-02-21T21:00:00.000Z", "reason": "session ended with hot files" }
      ]
    }
  ]
}
```

Valid `status` values and allowed transitions:

```text
queued → in_progress → blocked → ready_for_review → approved → merged
                    ↘ (on repeated failure) → escalated
```

- `no_handoff_reason`: required (non-null string) when an agent skips handoff. Null otherwise.
- `prior_attempts`: incremented each time a to-agent returns the handoff for revision.
- `state_history`: append-only log of every status change with agent and timestamp.
- Every transition must update `AgentTracker.md` and `state_history` atomically.

### Human View in `AgentTracker.md`

Add section:

`## Agent Handoffs`

Rendered summary lines (generated from JSON):

```md
- [ ] HO-20260221-001 | from: Codex | to: Claude,Copilot | mode: shared | status: queued
  - task: AS-210 | files: `src/auth/session.ts`, `tests/auth/session.test.ts`
  - note: Check regression risk in token refresh path before merge.
```

## Integration-Aware Ownership Routing

### Capability Matrix (config-driven)

Canonical agent IDs

Canonical agent IDs used in machine-readable fields should be lowercase: `codex`, `copilot`, `claude`. UI and human-facing text may render Title Case (Codex, Copilot, Claude).

### Capability Matrix (config-driven)

Extend `.agentsync.json` (backward-compatible addition alongside existing `staleAfterHours` and `commands` fields):

```json
{
  "agentCapabilities": {
    "codex": ["code_patch", "test_authoring", "shell_checks"],
    "copilot": ["inline_refactor", "pr_review"],
    "claude": ["workflow_orchestration", "policy_review", "risk_decision"]
  }
}
```

### Routing Rules

1. If explicit `to_agents` is provided, honor it — skip capability lookup.
2. If `owner_mode = auto`, resolve owners by matching `required_capabilities` against `agentCapabilities`.
3. If exactly one agent satisfies all required capabilities, emit `single`.
4. If two agents together cover all capabilities and no single agent does, emit `shared`.
5. If two agents both fully satisfy requirements (overlap), prefer the one with fewer active in-progress handoffs (lowest load). If equal, prefer the order defined in `agentCapabilities`.
6. If unresolved, mark `blocked` and require human owner assignment.

## UX and Workflow Changes

### End Session (mandatory handoff for code changes)

When `endSession` detects changed files (`hotFiles.length > 0`), require:

1. Handoff summary
2. Handoff note
3. Owner mode (`single`, `shared`, `auto`)
4. Target agent(s) or capability requirements

Allow skip only with explicit reason (`no_handoff_reason`) recorded in artifact.

### New Commands

Add commands in `package.json` and `extension.js`:

- `agentsync.addHandoffNote`
- `agentsync.claimHandoff`
- `agentsync.completeHandoff`
- `agentsync.listHandoffs` (required — drop-zone consumers have no tree view access)

### Tree View

Add `Handoffs` section:

- `Assigned to me`
- `Shared with me`
- `Blocked/Stale`

### Status Bar

Add warning badge when open handoffs are assigned to current agent and exceed stale threshold. Use the existing `staleAfterHours` value from `.agentsync.json` as the threshold — no new config field needed.

## Drop-Zone API Extensions

Add actions to `.agentsync/request.json` API:

- `createHandoff`
- `listHandoffs`
- `claimHandoff`
- `completeHandoff`

Example request:

```json
{
  "action": "createHandoff",
  "handoff": {
    "task_id": "AS-210",
    "from_agent": "Codex",
    "owner_mode": "shared",
    "to_agents": ["Claude", "Copilot"],
    "summary": "Needs policy + PR review",
    "notes": "Focus on auth risk and PR narrative."
  }
}
```

## Implementation Plan by Phase

### Phase 1: Schema + Storage + Rendering

Files:

- `extension.js`
- `templates/AgentTracker.md`

Tasks:

1. Add handoff store helpers (`readHandoffs`, `writeHandoffs`, `validateHandoff`).
2. Add tracker rendering helper for `Agent Handoffs` section.
3. Backward-compatible creation of `.agentsync/handoffs.json` if missing.

### Phase 2: End Session Enforcement

Files:

- `extension.js`

Tasks:

1. Extend `endSessionCore` to require handoff metadata when hot files exist.
2. Extend interactive `endSession` command prompts for handoff fields.
3. Persist handoff record and update tracker section.

### Phase 3: Commands + Panel + Status

Files:

- `package.json`
- `extension.js`

Tasks:

1. Register new handoff commands.
2. Add `Handoffs` tree section with ownership grouping.
3. Add status bar warnings for pending assigned handoffs.

### Phase 4: Automation API

Files:

- `extension.js`
- `README.md`
- `docs/agentsync-documentation.md`

Tasks:

1. Add new drop-zone actions and result payloads.
2. Document JSON contracts and examples.
3. Add compatibility note for orchestrators.

### Phase 5: Validation + Hardening

Files:

- `extension.js`
- (new) `tests/*` — use Node's built-in `node:test` runner (zero new dependencies)

Tasks:

1. Add validation for owner mode and required fields.
2. Add parser/renderer tests for tracker and handoff JSON.
3. Add migration checks for existing workspaces (handle missing `agentCapabilities` and `handoffs.json` gracefully).

## Acceptance Criteria (v1)

1. Ending a session with changed files cannot complete without either:
   - valid handoff note and owner assignment, or
   - explicit recorded skip reason.
2. Single-target and shared-owner handoffs are both supported and visible in tracker + panel.
3. Handoffs are machine-readable in `.agentsync/handoffs.json`.
4. Drop-zone API supports creating and completing handoffs.
5. Documentation includes schemas, examples, and workflow updates.

## Risks and Mitigations

1. Risk: Markdown parsing brittleness.
Mitigation: JSON as source of truth; tracker section is rendered output.

2. Risk: Prompt fatigue in end-session flow.
Mitigation: prefill defaults; allow explicit skip with reason.

3. Risk: Ownership ambiguity.
Mitigation: strict validation (`single` requires 1 owner, `shared` requires 2 owners).

4. Risk: Agent naming drift (`codex` vs `Codex`).
Mitigation: normalize and validate against configured agent list.

5. Risk: Two agents simultaneously call `claimHandoff` on the same handoff ID (race condition).
Mitigation: `claimHandoff` does a read-check-write — if `status` is already `in_progress` when the write lands, return an error and do not overwrite. First writer wins; the second caller receives `{ ok: false, reason: "already_claimed", claimedBy: "agent" }`.

6. Risk: `state.json` and `handoffs.json` diverging (panel reads `state.json`, handoffs are in `handoffs.json`).
Mitigation: Phase 1 must include writing active handoff IDs and counts into `state.json` alongside existing session fields so the panel and status bar can read a single source without opening `handoffs.json` directly.

7. Risk: Completed handoffs never feed back into agent learning.
Mitigation: Phase 4 — when a handoff reaches `merged` or `escalated`, append a summary entry to `decisions.md` (agent, task_id, outcome, notes). All agents read `decisions.md` at session start to build on prior outcomes.

## Rollout Strategy

1. Ship behind config flag: `"requireHandoffOnEndSession": false` by default. (Flat naming, consistent with existing `staleAfterHours` convention — not nested.)
2. Enable in pilot repos, gather feedback.
3. Flip default to `true` after stabilization.
4. Announce migration guidance in changelog and README.

## Suggested Next Execution Order

1. Implement Phase 1 + Phase 2 in one PR (core capability).
2. Implement Phase 3 UI improvements in second PR.
3. Implement Phase 4 automation contracts in third PR.
4. Implement Phase 5 tests and hardening in final PR.
