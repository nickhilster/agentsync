# AgentSync Protocol

This workspace uses the AgentSync multi-agent coordination protocol.
It enables Claude, Codex, GitHub Copilot, and other AI agents to work on the same codebase without stepping on each other.

*Note: the first time you run Init Workspace AgentSync will prompt you for your role and adjust instructions/shortcuts accordingly.*

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

## Token budget and context efficiency

- Set `max_tokens` to match the expected completion size. Do not over-allocate as a safety net.
- Batch similar small tasks (e.g. multiple unit tests, boilerplate edits) into single requests where possible.
- Use prompt caching for static content (system prompts, library schemas) to reduce cost and latency.
- If rate-limited (429 errors), use exponential backoff with randomized jitter before retrying.
- Record failed approaches in `AgentTracker.md` under **Failed Approaches** so the next agent avoids repeating them.

## Model selection guidance

When handing off work, consider the task complexity:

- **Worker-tier tasks** (routine edits, syntax fixes, boilerplate): prefer lighter models (e.g. Claude Haiku 4.5, GPT-5-mini).
- **Lead-tier tasks** (architecture, multi-file refactoring, complex reasoning): prefer capable models (e.g. Claude Opus 4.6, GPT-5.3-Codex).

Include a brief justification in the handoff notes when recommending a specific model tier.

## Health checks configuration

AgentSync reads optional commands from `.agentsync.json` in the repository root:

- `commands.build`
- `commands.test`
- `commands.deploy`

When configured, `AgentSync: End Session` runs these checks and writes pass/fail to **Current Health**.
