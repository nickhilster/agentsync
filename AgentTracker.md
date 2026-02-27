# AgentTracker

> Shared handoff document for multi-agent coordination.
> Every agent reads this first and updates it last.

## Last Session

- **Agent:** Codex
- **Date:** 2026-02-27T03:14:02Z
- **Summary:** Implemented Codex-on-Windows power-user operating model assets (role-specific agent instructions, playbook, reusable packet/report/checklist templates, and repo-level `.codex` profile config).
- **Branch:** master
- **Commit:** 0d682407531b131d27185f00b86d45f5643bc529 (working tree has uncommitted changes)

## Current Health

| Check  | Status |
| ------ | ------ |
| Build  | Not configured |
| Tests  | Pass |
| Deploy | Not configured |

## Hot Files

<!-- Files recently changed. Other agents should coordinate before editing these. -->

- `.github/copilot-instructions.md`
- `AGENTS.md`
- `CHANGELOG.md`
- `CLAUDE.md`
- `README.md`
- `.codex/config.toml`
- `.codex/README.md`
- `docs/codex-windows-power-user-playbook.md`
- `docs/templates/execution-packet.md`
- `docs/templates/codex-output-report.md`
- `docs/templates/pr-gate-checklist.md`
- `templates/AGENTS.md`
- `templates/CLAUDE.md`
- `templates/copilot-instructions.md`

## In Progress

<!-- Active work. Clear this section when complete. -->

*Nothing active*

## Suggested Next Work

<!-- Leave notes for the next agent here. -->
- Validate the new power-user playbook in a real task run and refine any wording that causes ambiguous handoffs.
- Decide whether `initWorkspace` should optionally scaffold the new `.codex/` and `docs/templates/` assets for fresh workspaces.
- Add an automated test or fixture to ensure template instruction files stay in sync with root instruction files.

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
- For Codex-heavy teams, use structured packet/report interfaces (`docs/templates/*`) instead of prose-only task handoffs.
