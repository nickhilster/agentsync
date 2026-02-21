# AgentSync Protocol

This workspace uses the **AgentSync** multi-agent coordination protocol. It enables Claude, Codex,
GitHub Copilot, and other AI agents to work on the same codebase without stepping on each other.

## At the start of each Copilot chat session

1. **Read `AgentTracker.md`** — understand what the last agent did and which files are currently hot
2. Reference the **Conventions** section when generating code — follow established patterns
3. Reference the **Known Issues & Gotchas** section before suggesting changes in those areas

## When suggesting code

- Follow conventions documented in AgentTracker — don't introduce new patterns that contradict them
- If editing a file listed in **Hot Files**, mention that it was recently changed by another agent
- Prefer smaller, targeted suggestions over large rewrites in hot files

## When ending a Copilot chat session

After applying significant changes, update `AgentTracker.md`:

- **Last Session**: "Copilot", today's date, brief summary
- **Hot Files**: add any files you substantially modified
- **Conventions**: note any new patterns you introduced or discovered
