# AgentTracker

> Shared handoff document for multi-agent coordination.
> Every agent reads this first and updates it last.

## Last Session

- **Agent:** Copilot
- **Date:** 2026-03-11T05:30:52Z
- **Summary:** Investigated MCP server access for Notion and Linear. Neither is available in the current agent environment — only Playwright and GitHub MCP servers are active.
- **Branch:** copilot/check-access-notion-linear
- **Commit:** (see latest commit)

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
- **To enable Notion MCP access**: Configure a Notion MCP server (e.g. `@notionhq/notion-mcp-server`) in the `GITHUB_COPILOT_MCP_JSON` workflow input and provide a valid Notion API token.
- **To enable Linear MCP access**: Configure a Linear MCP server in the `GITHUB_COPILOT_MCP_JSON` workflow input and provide a valid Linear API key.

## Known Issues & Gotchas

<!-- Recurring bugs, environment quirks, deployment notes, things that surprised you. -->
- If AgentSync appears Busy while no one is working, use `AgentSync: Clear Active Session` (stale `state.json` flag).
- Extension Development Host can surface unrelated extension failures unless launched in isolated mode.
- `AgentSync Live` requires webview registration (`"type": "webview"` in contributed view).
- **Notion MCP**: Not available in this agent environment. No Notion MCP server is configured — previously confirmed `Auth required` when attempted. To enable, add a Notion MCP server entry to `GITHUB_COPILOT_MCP_JSON` in the workflow inputs.
- **Linear MCP**: Not available in this agent environment. No Linear MCP server is configured. To enable, add a Linear MCP server entry to `GITHUB_COPILOT_MCP_JSON` in the workflow inputs. (A Linear document exists at https://linear.app/teambotics/document/agentsync-eod-status-2026-02-22-ce7c369563e1 but requires a configured MCP server to access programmatically.)

## Conventions

<!-- Architecture decisions, naming rules, and patterns discovered during work. -->
- Use `npm run vsix:refresh` for local package + reinstall test loop.
- Keep machine-readable handoffs in `.agentsync/handoffs.json`; UI reads and summarizes it.
- Tree panel (`AgentSync Details`) remains as fallback/details view; `AgentSync Live` is the primary visual dashboard.
