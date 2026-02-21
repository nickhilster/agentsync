# AgentSync Documentation

## Overview
AgentSync is a VS Code extension that coordinates multi-agent work (Claude, Codex, Copilot) in a shared repository by standardizing handoff files and workflow commands.

## Core Value
- Prevents conflicting parallel agent work by maintaining a shared tracker (`AgentTracker.md`).
- Provides consistent session lifecycle commands for starting and ending agent work.
- Surfaces stale or branch-divergent handoff state via a status bar indicator.

## Repository Structure
- `extension.js`: Main extension implementation and all command logic.
- `package.json`: Extension manifest, command registrations, metadata.
- `templates/`: Seed files copied into user workspaces during initialization.
- `README.md`: End-user usage and workflow documentation.
- `agentsync-0.2.0.vsix`: Packaged extension artifact.

## Extension Commands
- `AgentSync: Initialize Workspace` (`agentsync.init`)
- `AgentSync: Open AgentTracker` (`agentsync.openTracker`)
- `AgentSync: Start Session` (`agentsync.startSession`)
- `AgentSync: End Session` (`agentsync.endSession`)

## Runtime Behavior
### Activation
- Activates on `onStartupFinished`.
- Creates a status bar item bound to `agentsync.openTracker`.
- Watches `**/AgentTracker.md` and `**/.agentsync.json` for updates.
- Handles multi-root by preferring active editor workspace and labeling status text with folder name.

### Initialize Workspace
- Copies templates into target repo:
  - `CLAUDE.md`
  - `AGENTS.md`
  - `.github/copilot-instructions.md`
  - `AgentTracker.md`
  - `.agentsync.json`
- Prompts before overwriting existing files.

### Start Session
- Ensures tracker exists (offers auto-initialize).
- Prompts for agent and goal.
- Appends an unchecked item into `## In Progress` with ISO timestamp.

### End Session
- Prompts for agent, summary, and optional suggested next work.
- Collects git metadata:
  - branch (`git rev-parse --abbrev-ref HEAD`)
  - commit (`git rev-parse --short HEAD`)
- Updates tracker sections:
  - `Last Session`
  - `Current Health`
  - `Hot Files`
  - `In Progress`
  - `Suggested Next Work` (append-only when provided)
- Runs optional build/test/deploy commands from `.agentsync.json`.

## Configuration
Path: `.agentsync.json`

Supported keys:
- `staleAfterHours` (number, default 24)
- `commands.build`
- `commands.test` (or `commands.tests`)
- `commands.deploy`

If commands are missing or blank, health rows are marked `Not configured`.

## Tracker Model (`AgentTracker.md`)
Expected high-value sections:
- Last Session (agent/date/summary/branch/commit)
- Current Health (build/test/deploy)
- Hot Files
- In Progress
- Suggested Next Work
- Known Issues & Gotchas
- Conventions

The parser relies on markdown heading names and bold-label lines for last-session fields.

## Git Integration
AgentSync uses synchronous git calls:
- `diff --name-only`
- `diff --cached --name-only`
- `ls-files --others --exclude-standard`
- fallback: `show --pretty=format: --name-only HEAD`
- stale/branch safety checks:
  - `rev-parse`
  - `merge-base --is-ancestor`

## Known Risks and Gaps
- `extension.js` is monolithic; maintainability risk as scope expands.
- Tracker parsing depends on specific markdown formatting patterns.
- Shell command execution returns pass/fail only (stdout/stderr not persisted for diagnosis).
- No automated tests currently present in repository.
- Potential text encoding artifacts in source comments/strings should be normalized to UTF-8 clean output.

## Suggested Engineering Roadmap
1. Split `extension.js` into modules (`tracker`, `git`, `statusbar`, `commands`).
2. Add unit tests for parser/section replacement and workspace selection behavior.
3. Add integration tests for command flows (start/end/init).
4. Harden markdown parsing (more resilient to formatting drift).
5. Add optional telemetry/logging for failed health checks and git command failures.
6. Publish extension CI pipeline (lint/test/package/release).

## Quick Operational Runbook
1. Initialize workspace once per repository.
2. Start session at beginning of agent work.
3. Execute code changes and run checks.
4. End session to refresh tracker and handoff metadata.
5. Review status bar warnings before continuing new work.

## Notion Sync Payload (Ready-to-Paste)
Recommended Notion page title:
- `AgentSync - Technical Documentation`

Recommended child pages:
- `Architecture`
- `Command and Workflow Reference`
- `Configuration and Tracker Schema`
- `Known Risks`
- `Roadmap`

This markdown file can be copied directly into Notion, or split into those child pages.
