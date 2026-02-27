# AgentSync Protocol

This workspace uses the AgentSync multi-agent coordination protocol.
It enables Claude, Codex, GitHub Copilot, and other AI agents to coordinate through shared handoff state.

## Role in this workspace

- Copilot is optimized for inline completions and narrow edits while a human is actively editing.
- Do not become writer-of-record for branch-wide implementation unless explicitly assigned.
- If a suggestion changes architecture, data flow, or cross-file contracts, defer to Claude/Codex workflow first.

## At the start of each Copilot session

1. Read `AgentTracker.md` for current state and hot files.
2. Use **Conventions** and **Known Issues & Gotchas** as constraints for suggestions.
3. If substantial work is about to start, ask the user to run `AgentSync: Start Session`.

## When suggesting code

- Follow conventions documented in `AgentTracker.md`.
- If editing a file listed in **Hot Files**, mention cross-agent collision risk.
- Prefer focused suggestions instead of broad rewrites in active areas.
- Keep suggestions aligned with the active Codex execution packet (task, constraints, and non-goals).

## At the end of significant work

Ask the user to run `AgentSync: End Session` so the tracker is updated with:

- Last Session metadata (Agent, Date, Summary, Branch, Commit)
- Current Health checks
- Hot Files from git changes
- In Progress cleanup and Suggested Next Work
