# Repo Codex Configuration

This repository includes `.codex/config.toml` with two execution profiles:

- `safe-review`: conservative review mode for risk-sensitive work.
- `fast-exec`: standard implementation mode for day-to-day tasks.

Use with CLI/App:

```bash
codex --profile safe-review
codex --profile fast-exec
```

Note: Codex IDE extension settings can differ from CLI/App profile support. Keep critical behavior documented in `AGENTS.md` so all surfaces share the same rules.
