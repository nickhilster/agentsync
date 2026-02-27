# Codex on Windows Power-User Playbook

Last verified: 2026-02-27

## Summary

Use a three-lane model:

- **Claude/Gemini:** reasoning and specification.
- **Codex:** implementation, validation, and branch-level execution.
- **Copilot:** inline completion and micro-edits.

Keep one writer-of-record per branch. For implementation work, that writer is Codex unless explicitly reassigned.

## Ownership Model

### Claude/Gemini lane

- Frame the problem.
- Compare tradeoffs.
- Propose architecture options.
- Produce implementation-ready specs.

### Codex lane

- Convert approved specs into patches.
- Execute multi-file refactors.
- Run tests/build checks.
- Produce implementation evidence (`commands + results`).
- Run pre-PR checks (`/review` in IDE, plus CLI checks when needed).

### Copilot lane

- Assist with local token-level completion.
- Help polish small manual edits.
- Avoid unreviewed architectural drift.

## Windows Setup Strategy

1. Keep active repos in WSL filesystem when possible.
2. Open repos with VS Code Remote WSL.
3. Use Codex in VS Code as the primary surface.
4. Use Codex app for background/parallel workflows (worktrees, notifications, automations).
5. Configure Codex in layers:
   - Global: `~/.codex/config.toml`
   - Repo: `.codex/config.toml`
   - Session override: `codex -c key=value`
6. Keep `AGENTS.md` as the shared contract all assistants read first.

## Daily Execution Flow

1. Claude/Gemini produce an execution packet.
2. Hand packet to Codex for plan plus implementation.
3. Require Codex to include:
   - assumptions
   - command log
   - test/build evidence
4. Validate before PR:
   - VS Code extension: `/review`, `/status`
   - CLI/App when needed: `/test`, `/diff`, `/compact`, `/undo`
5. Use Copilot only for scoped, local improvements during manual review.

## Standard Interfaces

### Input to Codex

- `Task`
- `Definition of done`
- `Constraints`
- `Touched areas`
- `Validation commands`
- `Non-goals`
- `Failure cases to avoid`

Template: [docs/templates/execution-packet.md](templates/execution-packet.md)

### Output from Codex

- `What changed`
- `Why`
- `Files touched`
- `Commands run + results`
- `Residual risks`
- `Follow-ups`

Template: [docs/templates/codex-output-report.md](templates/codex-output-report.md)

### PR gate checklist

Checklist: [docs/templates/pr-gate-checklist.md](templates/pr-gate-checklist.md)

## Safety Defaults

- Default: balanced safety (workspace-write and approval-on-request behavior).
- Temporarily relax constraints only for scoped tasks.
- Return to defaults immediately after the task.
- Never run destructive git operations without explicit approval.

## Scenario Acceptance Tests

1. **Small bugfix**
   - Codex ships patch plus test evidence in one pass.
   - Copilot only assists with polish.
2. **Cross-cutting refactor**
   - Codex executes all changes.
   - Claude/Gemini stay in architecture role.
   - No dual-writer branch conflicts.
3. **Failing CI fix**
   - Codex reproduces locally.
   - Applies minimal fix.
   - Posts exact command evidence.
4. **Parallel feature + hotfix**
   - Separate worktree/session per stream.
   - No branch contamination.
5. **Ambiguous requirement**
   - Claude/Gemini resolve ambiguity first.
   - Codex starts only after acceptance criteria are explicit.

## 7-Day Rollout

### Day 1-2

- Apply ownership model on two real tasks.
- Use execution packet and output report templates.

### Day 3-4

- Use `safe-review` vs `fast-exec` profiles from `.codex/config.toml`.
- Enforce PR gate checklist.

### Day 5-7

- Run one parallel worktree workflow.
- Track cycle time and rework against baseline.

## References

- [Codex docs hub](https://platform.openai.com/docs/codex)
- [Codex overview](https://developers.openai.com/codex)
- [Windows + VS Code setup](https://developers.openai.com/codex/ide#setup-on-windows)
- [Codex configuration](https://developers.openai.com/codex/config)
- [Codex config reference](https://developers.openai.com/codex/config-reference)
- [IDE slash commands](https://developers.openai.com/codex/ide#slash-commands)
- [CLI slash commands](https://developers.openai.com/codex/cli#slash-commands)
- [Codex app](https://developers.openai.com/codex/app)
