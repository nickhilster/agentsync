# Changelog

All notable changes to AgentSync are documented here.

## [0.3.0] - 2026-02-21

### Added

- **Sidebar panel** — live AgentSync activity bar icon and tree view showing active session, health status, hot files, and in-progress work; refreshes automatically on file changes and every 60 seconds during an active session
- **Session state file** — `.agentsync/state.json` written on every session start/end, giving terminal agents and scripts structured data without parsing markdown
- **Drop-zone API** — write `.agentsync/request.json` to trigger `startSession`, `endSession`, `status`, or `health` actions headlessly; result written to `.agentsync/result.json`
- **Health check output capture** — stdout/stderr from failed build/test/deploy commands now appended (last 20 lines) to the `Current Health` section in `AgentTracker.md` for instant diagnosis
- **On-startup session check** — if VS Code reopens with an active session still in `state.json`, a notification prompts to continue or end it (toggle via `agentsync.promptOnStartup`)
- **Session timeout reminder** — background timer notifies when a session exceeds `agentsync.sessionReminderHours` (default 2h), fires once per session
- **Auto-detect build/test commands** — `initWorkspace` scans `package.json` scripts and offers to populate `.agentsync.json`; also available on demand via **AgentSync: Detect Build/Test Commands**; detects npm, yarn, pnpm, and bun
- **VS Code settings** — `agentsync.promptOnStartup`, `agentsync.sessionReminderHours`, `agentsync.autoDetectCommands` now appear in Settings UI
- `.agentsync/` runtime directory created automatically on `initWorkspace` and added to `.gitignore`

### Fixed

- Duplicate `.gitignore` entry in `.vscodeignore`

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
