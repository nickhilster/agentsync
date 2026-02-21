# AgentSync Protocol

This workspace uses the AgentSync multi-agent coordination protocol.
It enables Claude, Codex, GitHub Copilot, and other AI agents to work on the same codebase without stepping on each other.

## On every session start

1. Read `AgentTracker.md` to understand what changed, which files are hot, and what work is active.
2. Run `AgentSync: Start Session` and add your current goal.
3. Run `git status` and `git pull` before touching code.
4. Run the project's baseline test command when available.

## During work

- Work on a feature branch when possible: `[agent-name]/[feature]`.
- Treat files listed in **Hot Files** as potentially conflicting.
- Keep edits small in hot files and document partial work in `AgentTracker.md`.

## Before ending your session

1. Run build and tests.
2. Run `AgentSync: End Session`.
3. Commit all changes with a descriptive message.
4. Leave concise **Suggested Next Work** notes for the next agent.

## Health checks configuration

AgentSync reads optional commands from `.agentsync.json` in the repository root:

- `commands.build`
- `commands.test`
- `commands.deploy`

When configured, `AgentSync: End Session` runs these checks and writes pass/fail to **Current Health**.
