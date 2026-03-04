# AgentSync Protocol

This workspace uses the AgentSync multi-agent coordination protocol.
It enables Claude, Codex, GitHub Copilot, and other AI agents to coordinate through shared handoff state.

*AgentSync will ask you to identify your role during workspace initialization; this tailors the quick‑action buttons and routing.*

## At the start of each Copilot session

1. Read `AgentTracker.md` for current state and hot files.
2. Use **Conventions** and **Known Issues & Gotchas** as constraints for suggestions.
3. If substantial work is about to start, ask the user to run `AgentSync: Start Session`.

## When suggesting code

- Follow conventions documented in `AgentTracker.md`.
- If editing a file listed in **Hot Files**, mention cross-agent collision risk.
- Prefer focused suggestions instead of broad rewrites in active areas.

## Token budget and context efficiency

- Prefer focused, small suggestions over broad rewrites to minimize token usage.
- If rate-limited, suggest the user wait and retry with exponential backoff.
- Record failed approaches in `AgentTracker.md` under **Failed Approaches**.

## At the end of significant work

Ask the user to run `AgentSync: End Session` so the tracker is updated with:

- Last Session metadata (Agent, Date, Summary, Branch, Commit)
- Current Health checks
- Hot Files from git changes
- In Progress cleanup and Suggested Next Work
