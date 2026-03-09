# AgentTracker

> Shared handoff document for multi-agent coordination.
> Every agent reads this first and updates it last.

## Last Session

- **Agent:** Codex
- **Date:** 2026-03-08T20:43:37.0150703-04:00
- **Summary:** Fixed Windows health-check spawning, cleaned tracker state, and ignored local runtime/test artifacts.
- **Branch:** codex/release-0.3.7-readiness
- **Commit:** 0d84836

## Current Health

| Check  | Status |
| ------ | ------ |
| Build  | Pass |
| Tests  | Pass |
| Deploy | Not configured |

## Hot Files

- `.gitignore`
- `AgentTracker.md`
- `src/extension.js`
- `test/utils/resolveHealthCheckProgram.test.js`

## In Progress

*Nothing active*

## Suggested Next Work

<!-- Leave notes for the next agent here. -->
- Smoke-test `AgentSync: End Session` in an Extension Development Host on Windows to confirm the health-check fix now reports `Pass` instead of `spawn npm ENOENT`.
- If the agent catalog work is going to ship in `0.3.7`, consider a quick UI pass on `Browse Agents`, `Run with Personality`, and pipeline flows.

## Known Issues & Gotchas

- `src/extension.js` is still the main integration point and remains large; the catalog/pipeline work landed, but the broader dashboard/session extraction plan is not finished yet.
- Runtime coordination files live under `.agentsync/` and `.agencysync/` and are now treated as local workspace state, not source artifacts.

## Conventions

<!-- Architecture decisions, naming rules, and patterns discovered during work. -->
- Use `npm run vsix:refresh` for the local package + reinstall loop.
- Keep machine-readable handoffs in `.agentsync/handoffs.json`; the UI summarizes that data into the dashboard/tracker views.
- Treat `AgentTracker.md` as a concise current-state document, not an append-only log.

## Agent Handoffs

No open handoffs.
