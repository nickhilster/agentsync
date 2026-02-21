# Changelog

All notable changes to AgentSync are documented here.

## [0.2.0] - 2026-02-21

### Added
- **Start Session** command - logs agent name, goal, and timestamp to `AgentTracker.md` In Progress section
- **End Session** command - runs health checks and updates Last Session, Current Health, Hot Files, In Progress, and Suggested Next Work
- Git-aware hot files detection from staged/unstaged changes and recent commit history
- Status bar warnings for stale tracker data, branch mismatches, and commits not in HEAD history
- Multi-root workspace support with per-folder labels
- File system watchers for live tracker and config reloads
- BOM-safe `.agentsync.json` parsing

### Fixed
- Removed `files` field from `package.json` that was incorrectly limiting packaged content
- Excluded `agent-matrix-theme/` from `.vscodeignore` to prevent unrelated assets from bundling

## [0.1.0] - 2026-02-21

### Added
- **Initialize Workspace** command - creates `CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`, `AgentTracker.md`, and `.agentsync.json`
- **Open AgentTracker** command - opens `AgentTracker.md` in the editor
- Status bar item showing last session agent
- Configurable build/test/deploy health checks via `.agentsync.json`
- Agent selection quick pick (Claude, Codex, Copilot, or custom)
- Template system for agent instruction files
