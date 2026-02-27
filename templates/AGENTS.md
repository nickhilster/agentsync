# AgentSync Protocol

This workspace uses the AgentSync multi-agent coordination protocol.
It enables Claude, Codex, GitHub Copilot, and other AI agents to work on the same codebase without stepping on each other.

## Default operating model

- **Claude/Gemini** own problem framing, tradeoff analysis, design alternatives, and spec drafting.
- **Codex** is the default implementation writer for approved specs (patches, refactors, tests, migration/checklist updates).
- **Copilot** is used for inline completions and micro-edits while a human is actively editing.
- **Writer-of-record rule:** one writer per branch at a time. For implementation branches, that writer is Codex unless explicitly reassigned.

## On every session start

1. Read `AgentTracker.md` to understand what changed, which files are hot, and what work is active.
2. Run `AgentSync: Start Session` and add your current goal.
3. Run `git status` and `git pull` before touching code.
4. Run the project's baseline test command when available.

## Required input packet for Codex

Provide this before asking Codex to implement:

- `Task`
- `Definition of done`
- `Constraints`
- `Touched areas`
- `Validation commands`
- `Non-goals`

## Required output from Codex

Codex should report:

- `What changed`
- `Why`
- `Files touched`
- `Commands run + results`
- `Residual risks`
- `Follow-ups`

## Validation cycle

1. In VS Code Codex extension, run `/review` (and `/status` if context feels stale).
2. In Codex CLI/App sessions, use `/test`, `/diff`, `/compact`, and `/undo` when needed.
3. Run repo validation commands before PR (`commands.test` from `.agentsync.json` at minimum).
4. Keep command evidence in final handoff notes.

## Windows setup defaults

1. Prefer repos in WSL filesystem for performance and tool consistency.
2. Open the repo via VS Code + WSL when possible.
3. Use Codex app for parallel/background workflows; keep day-to-day implementation in VS Code.
4. Configure Codex in layers:
   - Global defaults: `~/.codex/config.toml`
   - Repo overrides: `.codex/config.toml`
   - Task profiles: `safe-review` and `fast-exec`
5. Use runtime overrides only when needed (`codex -c key=value`).

## Safety defaults

- Baseline is balanced safety: workspace-write plus approval-on-request behavior.
- Temporarily relax constraints only for scoped tasks and restore defaults immediately after.
- Never run destructive git commands without explicit user approval.

## During work

- Work on a feature branch when possible: `[agent-name]/[feature]`.
- Treat files listed in **Hot Files** as potentially conflicting.
- Keep edits small in hot files and document partial work in `AgentTracker.md`.
- Keep handoffs structured; avoid prose-only transfers between agents.

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
