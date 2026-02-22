# AgentTracker

> Shared handoff document for multi-agent coordination.
> Every agent reads this first and updates it last.

## Last Session

- **Agent:** Codex
- **Date:** 2026-02-22T00:00:00Z
- **Summary:** Implemented AgentSync Live webview dashboard, handoff-aware details panel, stale-session controls, and local VSIX refresh workflow.
- **Branch:** master
- **Commit:** (see latest commit after EOD push)

## Current Health

| Check  | Status |
| ------ | ------ |
| Build  | Not configured |
| Tests  | Not configured |
| Deploy | Not configured |

## Hot Files

<!-- Files recently changed. Other agents should coordinate before editing these. -->

- `extension.js`
- `package.json`
- `README.md`
- `CHANGELOG.md`
- `templates/AgentTracker.md`
- `templates/agentsync.json`
- `scripts/refresh-vsix.js`
- `schemas/handoffs.schema.json`

## In Progress

<!-- Active work. Clear this section when complete. -->

*Nothing active*

## Suggested Next Work

<!-- Leave notes for the next agent here. -->
- Verify `AgentSync Live` webview in Extension Development Host after reload and run through Start/End/Clear flows once.
- Decide default `autoStaleSessionMinutes` for new workspaces (currently `0`, disabled).
- Optionally add automated tests for `getOperationalState`, stale-session logic, and handoff bucket grouping.
- Confirm packaging allowlist/ignore strategy for root protocol docs that are now present in repo.

## Known Issues & Gotchas

<!-- Recurring bugs, environment quirks, deployment notes, things that surprised you. -->
- If AgentSync appears Busy while no one is working, use `AgentSync: Clear Active Session` (stale `state.json` flag).
- Extension Development Host can surface unrelated extension failures unless launched in isolated mode.
- `AgentSync Live` requires webview registration (`"type": "webview"` in contributed view).

## Conventions

<!-- Architecture decisions, naming rules, and patterns discovered during work. -->
- Use `npm run vsix:refresh` for local package + reinstall test loop.
- Keep machine-readable handoffs in `.agentsync/handoffs.json`; UI reads and summarizes it.
- Tree panel (`AgentSync Details`) remains as fallback/details view; `AgentSync Live` is the primary visual dashboard.
