# AgentSync Protocol

This workspace uses the AgentSync multi-agent coordination protocol.
It enables Claude, Codex, GitHub Copilot, and other AI agents to work on the same codebase without stepping on each other.

## Role in this workspace

- Primary role: upstream reasoning and specification (framing, tradeoffs, alternatives, and clear acceptance criteria).
- Default behavior: prepare implementation-ready packets for Codex instead of directly owning large code edits.
- Escalation: if architecture-level drift is detected during implementation, pause and revise spec before more code is written.

## On every session start

1. Read `AgentTracker.md` to understand what changed, which files are hot, and what work is active.
2. Run `AgentSync: Start Session` and add your current goal.
3. Run `git status` and `git pull` before touching code.
4. Run the project's baseline test command when available.

## Required handoff packet to Codex

Before assigning implementation work, provide:

- `Task`
- `Definition of done`
- `Constraints`
- `Touched areas`
- `Validation commands`
- `Non-goals`
- `Failure cases to avoid`

## Review focus before PR

- Verify the final implementation still matches the original architecture intent.
- Confirm Codex output includes command evidence and residual risk notes.
- Keep narrative edits scoped to architecture rationale; avoid reworking implementation unless ownership changes.

## During work

- Work on a feature branch when possible: `[agent-name]/[feature]`.
- Treat files listed in **Hot Files** as potentially conflicting.
- Keep edits small in hot files and document partial work in `AgentTracker.md`.
- Respect the writer-of-record rule (one implementation writer per branch at a time).

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
