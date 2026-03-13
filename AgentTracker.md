# AgentTracker

> Shared handoff document for multi-agent coordination.
> Every agent reads this first and updates it last.

## Last Session

- **Agent:** Claude
- **Date:** 2026-03-02T18:23:24.125Z
- **Summary:** -
- **Branch:** master
- **Commit:** 0d68240

- **Date:** 2026-02-22T00:00:00Z
- **Summary:** Implemented AgentSync Live webview dashboard, handoff-aware details panel, stale-session controls, and local VSIX refresh workflow.
- **Branch:** master
- **Commit:** (see latest commit after EOD push)

## Current Health

| Check  | Status |
| ------ | ------ |
| Build  | Not configured |
| Tests  | Fail |
| Deploy | Not configured |

**Tests output:**
```
spawn npm ENOENT
```

| ------ | ------ |
| Build  | Not configured |
| Tests  | Not configured |
| Deploy | Not configured |

## Hot Files

- `.agentsync/state.json`
- `AgentTracker.md`
- `analyze.js`
- `Audit Report.md`
- `CHANGELOG.md`
- `docs/agent-protocol-integration-plan.md`
- `esbuild.js`
- `extension.js`
- `jest-errors.txt`
- `jest-results.json`
- `out/extension.js`
- `out/extension.js.map`
- `package-lock.json`
- `package.json`
- `schemas/handoffs.schema.json`
- `src/extension.js`
- `templates/AGENTS.md`
- `templates/agentsync.json`
- `templates/AgentTracker.md`
- `templates/CLAUDE.md`
- `templates/copilot-instructions.md`
- `templates/roles/founder_pm.json`
- `templates/roles/non_technical.json`
- `templates/roles/software_developer.json`
- `templates/roles/systems_designer.json`
- `templates/roles/ux_designer.json`
- `test-output.txt`
- `test/utils/canonicalAgentId.test.js`
- `test/utils/escapeRegExp.test.js`
- `test/utils/formatElapsed.test.js`
- `test/utils/getOperationalState.test.js`
- `test/utils/getSectionBody.test.js`
- `test/utils/isEmptyValue.test.js`
- `test/utils/parseCommandArgv.test.js`
- `test/utils/parseISODate.test.js`
- `test/utils/parseTracker.test.js`
- `test/utils/scoreNextTaskCapabilities.test.js`
- `test/utils/validateHandoff.test.js`
- `themes/custom-color-theme-dark.json`
- `tsconfig.json`


- `extension.js`
- `package.json`
- `README.md`
- `CHANGELOG.md`
- `templates/AgentTracker.md`
- `templates/agentsync.json`
- `scripts/refresh-vsix.js`
- `schemas/handoffs.schema.json`

## In Progress

- [ ] Copilot (2026-03-02T01:42:02.726Z): building the UI for status bar



*Nothing active*

## Suggested Next Work

<!-- Leave notes for the next agent here. -->
- Verify `AgentSync Live` webview in Extension Development Host after reload and run through Start/End/Clear flows once.
- Decide default `autoStaleSessionMinutes` for new workspaces (currently `0`, disabled).
- Optionally add automated tests for `getOperationalState`, stale-session logic, and handoff bucket grouping.
- Confirm packaging allowlist/ignore strategy for root protocol docs that are now present in repo.

## Known Issues & Gotchas

- ⚠ Signature change in `extension.js`: `-function getTemplatesDir(context) {`
- ⚠ Signature change in `extension.js`: `-function getTrackerPath(workspaceFolder) {`
- ⚠ Signature change in `extension.js`: `-function getConfigPath(workspaceFolder) {`
- ⚠ Signature change in `extension.js`: `-function getAgentSyncDir(workspaceFolder) {`
- ⚠ Signature change in `extension.js`: `-function getStatePath(workspaceFolder) {`
- ⚠ Signature change in `extension.js`: `-function getRequestPath(workspaceFolder) {`
- ⚠ Signature change in `extension.js`: `-function getResultPath(workspaceFolder) {`
- ⚠ Signature change in `extension.js`: `-function getHandoffsPath(workspaceFolder) {`
- ⚠ Signature change in `extension.js`: `-function isEmptyValue(value) {`
- ⚠ Signature change in `extension.js`: `-function parseTracker(content) {`

- If AgentSync appears Busy while no one is working, use `AgentSync: Clear Active Session` (stale `state.json` flag).
- Extension Development Host can surface unrelated extension failures unless launched in isolated mode.
- `AgentSync Live` requires webview registration (`"type": "webview"` in contributed view).

## Conventions

<!-- Architecture decisions, naming rules, and patterns discovered during work. -->
- Use `npm run vsix:refresh` for local package + reinstall test loop.
- Keep machine-readable handoffs in `.agentsync/handoffs.json`; UI reads and summarizes it.
- Tree panel (`AgentSync Details`) remains as fallback/details view; `AgentSync Live` is the primary visual dashboard.

## Agent Handoffs

- [ ] HO-20260302-001 | from: claude | to: (none) | mode: single | status: queued
  - files: `.agentsync/state.json`, `AgentTracker.md`, `analyze.js`, `Audit Report.md`, `CHANGELOG.md`, `docs/agent-protocol-integration-plan.md`, `esbuild.js`, `extension.js`, `jest-errors.txt`, `jest-results.json`, `out/extension.js`, `out/extension.js.map`, `package-lock.json`, `package.json`, `schemas/handoffs.schema.json`, `src/extension.js`, `templates/AGENTS.md`, `templates/agentsync.json`, `templates/AgentTracker.md`, `templates/CLAUDE.md`, `templates/copilot-instructions.md`, `templates/roles/founder_pm.json`, `templates/roles/non_technical.json`, `templates/roles/software_developer.json`, `templates/roles/systems_designer.json`, `templates/roles/ux_designer.json`, `test-output.txt`, `test/utils/canonicalAgentId.test.js`, `test/utils/escapeRegExp.test.js`, `test/utils/formatElapsed.test.js`, `test/utils/getOperationalState.test.js`, `test/utils/getSectionBody.test.js`, `test/utils/isEmptyValue.test.js`, `test/utils/parseCommandArgv.test.js`, `test/utils/parseISODate.test.js`, `test/utils/parseTracker.test.js`, `test/utils/scoreNextTaskCapabilities.test.js`, `test/utils/validateHandoff.test.js`, `themes/custom-color-theme-dark.json`, `tsconfig.json`
