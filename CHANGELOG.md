# Changelog

All notable changes to AgentSync are documented here.

## [0.3.5] - 2026-02-25

### Added

- **Start Session zero-touch pickup controls** - added `automation.startSessionZeroTouch` config with `enabled`, `autoClaimHandoff`, and `promptPreFill` options to support claim-and-prefill handoff flows.
- **Queued handoff action cards in AgentSync Live** - dashboard now surfaces queued handoffs assigned to the current agent with in-panel `Claim`, `Start`, and `Skip` actions.
- **Hot file safety visuals** - added explorer file decorations and on-open warnings for hot files while a session is active.

### Changed

- **State-backed dashboard/session metadata** - dashboard and status bar now prefer `state.json` session snapshots (`lastSession`, `inProgress`, `hotFiles`) over markdown parsing when available for more stable UI state.
- **VSIX packaging exclusions** - updated `.vscodeignore` to exclude local runtime/protocol coordination files from packaged extension artifacts.

### Fixed

- **Compact dashboard task formatting** - corrected escaped whitespace regex handling inside webview script rendering.

## [0.3.4] - 2026-02-25

### Fixed

- **Release trigger pattern** - corrected `.github/workflows/release.yml` tag matching so standard `vX.Y.Z` tags trigger the release pipeline.
- **Safe default deploy health check** - set `.agentsync.json` `commands.deploy` to empty by default to avoid failed End Session health checks in local environments without publish credentials.
- **Cross-platform version bump scripts** - replaced bash-based bump commands with a Node-based script so `npm run bump:*` works on Windows and Unix hosts.
- **Local Jest collision warning** - added `modulePathIgnorePatterns` in `jest.config.js` to ignore nested local clones (for example `agentsync/`) and prevent duplicate package-name warnings.

## [0.3.3] - 2026-02-24

### Added

- **Feature-flagged zero-touch End Session automation** - added `automation.endSessionZeroTouch` and `automation.handoffRoutingDefaults`, deterministic summary generation, auto-routed handoff drafting, generated one-line handoff prompts, clipboard copy support in interactive mode, and prompt metadata persisted to state/handoff files.

### Changed

- **Drop-zone endSession response enrichment** - `.agentsync/request.json` `endSession` responses now include `generatedSummary`, `summarySource`, `handoffPrompts`, and `promptCopiedToClipboard` (`false` in headless mode).
- **Status bar routing + compact-first dashboard docs** - README and changelog text now match runtime behavior for AgentSync Live panel routing and compact-first workflow.

## [0.3.2] - 2026-02-23

### Added

- **Interactive tutorial walkthrough** - added a native VS Code Getting Started walkthrough for first-time AgentSync setup (`Open Live Dashboard`, `Initialize Workspace`, `Start Session`, `End Session`).
- **Open tutorial command** - new `AgentSync: Open Interactive Tutorial` command in Command Palette, dashboard actions, panel quick actions, and view title actions.
- **Post-init tutorial launch** - workspace initialization prompt now offers to open the interactive tutorial immediately.
- **Compact-first AgentSync Live** - dashboard now defaults to compact mode with smaller buttons, focused task memory, and a `More` tray for secondary actions.
- **Remembered dashboard mode + process colors** - `Show Full`/`Show Compact` mode is persisted per workspace and active commands now highlight buttons with process-specific colors while running.
- **Status bar routing to live panel** - clicking the AgentSync status bar item now opens AgentSync Live instead of `AgentTracker.md`.

### Security & Reliability

- **Command injection fix (C1)** - health check commands in `.agentsync.json` are now tokenised and passed directly to the OS without invoking a shell (`shell: true` removed). Shell operators (`&&`, `|`, `;`) are not interpreted.
- **Non-blocking health checks (M1/C1)** - `runCheckCommand` is now async (`cp.spawn`) with a 60-second timeout so the VS Code extension host is never blocked during End Session.
- **Atomic file writes (C3)** - `AgentTracker.md`, `handoffs.json`, and `state.json` are now written via write-then-rename so a crash mid-write cannot corrupt existing data.
- **Drop-zone race condition fix (C2/H1)** - `request.json` is atomically renamed to `request.json.processing` before reading, and an in-flight Set prevents concurrent handlers from processing the same request twice.
- **State divergence ordering (C4)** - tracker is now written before `state.json` so a failed state write leaves the UI showing "Busy" (recoverable) rather than falsely "Ready".
- **Skip-handoff validation (H5)** - `no_handoff_reason` skip records now go through the same non-empty validation as full handoff records before being persisted.
- **Regex injection fix (H2)** - tracker field labels passed to `parseTracker()` are now escaped via `escapeRegExp()` before being used in a `RegExp` constructor.
- **`created_at` required in handoffs (M3)** - `validateHandoff()` now enforces the `created_at` ISO timestamp required by the handoff schema.
- **ISO date parsing (M5)** - replaced bare `Date.parse()` with a strict ISO 8601 validator (`parseISODate()`) in stale-session checks and startup prompts.
- **`staleAfterHours: 0` honoured (M2)** - setting `staleAfterHours` to `0` in `.agentsync.json` now correctly disables the staleness check (previously silently defaulted to 24 hours).
- **Unhandled promise rejections fixed (H3)** - `executeCommand` calls in the startup check and the session reminder timer now have `.catch()` handlers.
- **Silent catch blocks improved (M4)** - `ENOENT` is still silently ignored where expected; other unexpected I/O errors are logged to the extension console instead of being swallowed.
- **`.vscodeignore` tightened (T1)** - `.git/`, `.github/`, `.claude/`, `docs/`, `scripts/`, and `schemas/` are now excluded from the VSIX, reducing package size.
- **EM_DASH constant (T2)** - `'—'` replaced with a named `EM_DASH` constant in `isEmptyValue`.
- **`.agentsync.json` template documented (T5)** - template now ships with a `_readme` key explaining every field inline.

## [0.3.1] - 2026-02-22

### Fixed

- Marketplace republish: version bump to `0.3.1` so a new VSIX can be uploaded.

## [0.3.0] - 2026-02-21

### Added

- **Dashboard Action Center** - live command feedback in AgentSync Live showing running/completed/failed state, last update timestamp, and suggested next step for non-technical users
- **Onboarding checklist** - Action Center now tracks first-run progress (`Initialize Workspace`, `Start Session`, `End Session`) with clear completion markers
- **Failure recovery shortcuts** - when dashboard actions fail, users get immediate recovery controls (`Open Tracker`, `Refresh`) and plain-language retry guidance
- **Sidebar panel** - live AgentSync activity bar icon and tree view showing active session, health status, hot files, and in-progress work; refreshes automatically on file changes and every 60 seconds during an active session
- **Session state file** - `.agentsync/state.json` written on every session start/end, giving terminal agents and scripts structured data without parsing markdown
- **Drop-zone API** - write `.agentsync/request.json` to trigger `startSession`, `endSession`, `status`, or `health` actions headlessly; result written to `.agentsync/result.json`
- **Health check output capture** - stdout/stderr from failed build/test/deploy commands now appended (last 20 lines) to the `Current Health` section in `AgentTracker.md` for instant diagnosis
- **On-startup session check** - if VS Code reopens with an active session still in `state.json`, a notification prompts to continue or end it (toggle via `agentsync.promptOnStartup`)
- **Session timeout reminder** - background timer notifies when a session exceeds `agentsync.sessionReminderHours` (default 2h), fires once per session
- **Auto-detect build/test commands** - `initWorkspace` scans `package.json` scripts and offers to populate `.agentsync.json`; also available on demand via **AgentSync: Detect Build/Test Commands**; detects npm, yarn, pnpm, and bun
- **VS Code settings** - `agentsync.promptOnStartup`, `agentsync.sessionReminderHours`, `agentsync.autoDetectCommands` now appear in Settings UI
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
