# AgentSync — Technical Status Report

**Date:** 2026-03-11
**Version:** 0.3.5
**Prepared by:** GitHub Copilot

---

## 1. Project Overview

**What it does:** AgentSync is a VS Code extension that enables multi-agent coordination across AI coding assistants (Claude, Codex, GitHub Copilot) working in the same repository. It prevents conflicting parallel work by maintaining a shared `AgentTracker.md` file, enforcing a session lifecycle (start → work → end → handoff), surfacing a live status dashboard, and providing a drop-zone API so terminal-based agents can participate without the VS Code UI.

**Primary technologies:**
- **Runtime:** Node.js, VS Code Extension API (activation event `onStartupFinished`)
- **Coordination storage:** Markdown (`AgentTracker.md`), JSON (`state.json`, `handoffs.json`, `.agentsync.json`)
- **Testing:** Jest with `__mocks__/vscode.js` isolation shim
- **Linting/formatting:** ESLint (ecmaVersion 2020, CommonJS) + Prettier (single quotes, no semicolons)
- **CI/CD:** GitHub Actions (`.github/workflows/ci.yml`, `release.yml`)

**Maturity stage:** Early production / MVP. The extension is published on the VS Code Marketplace and has reached v0.3.5 through rapid iteration. Core workflows are functional; some subsystems (automation, testing) are partially complete.

---

## 2. Core Architecture

**Main modules (all within `extension.js`, ~5,000 lines):**

| Concern | Key functions |
|---|---|
| Tracker I/O | `readTracker()`, `writeTracker()`, `writeStateFile()` — atomic write-then-rename |
| Session lifecycle | `startSessionCore()`, `endSessionCore()`, `clearActiveSessionCore()` |
| Health checks | `runCheckCommand()` — async `cp.spawn`, 60 s timeout, no `shell: true` |
| Handoff routing | `resolveAutomationRoute()`, `buildHandoffPromptLines()` |
| Drop-zone API | `processDropZoneRequest()` — reads `request.json`, writes `result.json` |
| Dashboard UI | `getDashboardModel()`, `getDashboardHtml()`, `AgentSyncDashboardViewProvider` |
| Tree view | `AgentSyncTreeDataProvider` — live panel, auto-refreshes every 60 s |
| Status bar | `updateStatusBar()`, `getTrackerWarnings()` |
| Git integration | Inline `child_process.execSync` calls for diff, branch, commit, stale checks |

**Agent/persona implementation:** Agent identity is a plain string (e.g. `"claude"`, `"codex"`, `"copilot"`) normalised by `canonicalAgentId()`. There is no class hierarchy; personas are distinguished only by routing configuration in `.agentsync.json`.

**LLM provider integration:** AgentSync does not call any LLM APIs. Instead it writes instruction files (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`) that each AI tool reads on startup; all files reference the shared `AgentTracker.md` as the single source of truth.

**Orchestration layer:** The `resolveAutomationRoute()` function selects a target agent at End Session using `handoffRoutingDefaults` from `.agentsync.json` (or falls back to a user prompt). Owner modes are `single`, `shared`, and `auto` (capability-based).

---

## 3. Agent System

| Agent | Canonical ID | Instruction file | Default routes to |
|---|---|---|---|
| Claude (Anthropic) | `claude` | `CLAUDE.md` | `codex` |
| OpenAI Codex | `codex` | `AGENTS.md` | `claude` |
| GitHub Copilot | `copilot` | `.github/copilot-instructions.md` | `codex` |

**Responsibilities:** All three agents follow the same protocol — read `AgentTracker.md` on session start, work on a feature branch, run health checks, and call End Session to update the tracker and emit a structured handoff record.

**Handoff mechanism:** At End Session, a JSON record is appended to `.agentsync/handoffs.json` (validated against `schemas/handoffs.schema.json`). The record contains `to_agents`, `owner_mode`, `summary`, `files`, `branch`, `commit`, and a `state_history` array. The next agent claims the handoff via the `Claim` action in AgentSync Live or via the drop-zone API.

**Custom agents:** Any string is accepted as an agent ID; routing defaults for non-built-in agents can be added to `.agentsync.json`.

---

## 4. LLM / Service Routing

AgentSync is a **coordination layer, not an LLM gateway** — it does not proxy model calls or manage tokens. Routing decisions are made entirely at the handoff boundary:

| Routing mode | Behaviour |
|---|---|
| `single` | One target agent takes exclusive ownership |
| `shared` | Two agents collaborate on the same task |
| `auto` | Target chosen by matching `required_capabilities` array (logic in `resolveAutomationRoute()`) |

**Zero-touch automation** (`automation.endSessionZeroTouch`): when enabled, a deterministic summary is generated from the active goal + hot file count + health results (capped at `maxSummaryLength`, default 180 chars) and the handoff is auto-routed without user input. Currently disabled by default (`"enabled": false`).

**Token / rate-limit management:** None — out of scope. Each AI tool manages its own model interaction independently.

---

## 5. Repo Structure

```
agentsync/
├── extension.js              # Entire extension (~5,000 lines, monolithic)
├── package.json              # Manifest, commands, views, config schema
├── .agentsync.json           # Live workspace config (stale thresholds, routing, commands)
├── AgentTracker.md           # Live shared handoff tracker
├── CLAUDE.md / AGENTS.md     # Agent instruction files (protocol entry points)
├── templates/                # Seed files copied to user workspaces on init
│   ├── AgentTracker.md
│   ├── agentsync.json        # Config template with inline _readme docs
│   ├── CLAUDE.md / AGENTS.md / copilot-instructions.md
├── schemas/
│   └── handoffs.schema.json  # JSON Schema v7 for handoff records
├── scripts/
│   ├── bump-version.js       # Cross-platform semver bump
│   └── refresh-vsix.js       # Local package-and-reinstall loop
├── docs/
│   ├── agentsync-documentation.md  # Architecture and command reference
│   └── EOD-2026-02-22.md           # Previous agent session report
├── test/utils/               # 10 Jest unit tests for utility functions
├── __mocks__/vscode.js       # VS Code API mock for Jest
└── .github/workflows/
    ├── ci.yml                # Lint → test → package on push/PR to main
    └── release.yml           # Publish to Marketplace on vX.Y.Z tag
```

**Entry point:** `extension.js` exports `activate()` and `deactivate()` per the VS Code extension contract.

---

## 6. Development Workflow

**Branch strategy:** Feature branches per agent (`[agent-name]/[feature]`), merging to `main`/`master`. The AgentTracker records the active branch and last commit; status bar warns on branch or commit divergence.

**Agent contributions:** Each agent reads its instruction file on session start, records progress in `AgentTracker.md` via the Start/End Session commands, and emits a structured handoff for the next agent.

**CI/CD (`ci.yml`):** On every push or PR to `main`/`master`: `npm ci` → `npm run lint` → `npm run format:check` → `npm test` → `npm run vsix:package`. VSIX artifact is uploaded for push events.

**Release (`release.yml`):** Triggered by a `vX.Y.Z` tag. Runs the same lint/test/package pipeline, then publishes to the VS Code Marketplace via `vsce` using the `VSCE_PAT` secret, and creates a GitHub Release with changelog notes extracted from `CHANGELOG.md`.

**Version bumping:** `npm run bump:patch|minor|major` via `scripts/bump-version.js` (cross-platform Node.js).

---

## 7. Current Capabilities

- **Workspace initialisation** — copies five template files and creates `.agentsync/` runtime directory; auto-adds it to `.gitignore`; detects npm/yarn/pnpm/bun package managers and offers to populate health-check commands.
- **Session lifecycle** — Start Session (agent + goal prompt → updates In Progress), End Session (health checks → updates Last Session / Health / Hot Files / Handoffs), Clear Active Session (stale recovery).
- **Live dashboard (AgentSync Live)** — compact-first webview, operational state badge (Ready / Busy / Waiting), action center with run feedback, handoff claim/start/skip cards, hot file list, mode persistence per workspace.
- **Tree panel** — sidebar activity bar view, auto-refreshes every 60 s during active session.
- **Hot file safety** — file-explorer decorations and on-open warnings for files changed during an active session.
- **Drop-zone API** — headless terminal agents write `request.json`; extension responds to `startSession`, `endSession`, `status`, `health` actions and writes `result.json`.
- **Handoff routing** — structured JSON records with schema validation; zero-touch automation available but off by default.
- **Security hardening** — command injection prevention (no `shell: true`), atomic file writes, drop-zone race-condition guard, regex injection fix, ISO date validation.

---

## 8. Missing Pieces / TODOs

| Gap | Notes |
|---|---|
| **Monolithic `extension.js`** | ~5,000 lines; no module boundaries. Maintainability risk. Split into `tracker`, `git`, `session`, `ui`, `handoff` modules is documented in `docs/agentsync-documentation.md`. |
| **Integration tests** | Only 10 unit tests for pure utility functions. No tests for command flows (`startSession`, `endSession`, `init`), section-replacement logic, workspace selection, or dashboard rendering. |
| **Zero-touch automation disabled** | `automation.endSessionZeroTouch.enabled` defaults to `false`; the feature is implemented but not validated end-to-end in CI. |
| **`auto` owner-mode routing** | `required_capabilities` matching is stubbed; capability-based routing is not yet implemented. |
| **Health check observability** | Only last 20 lines of failed output are captured; no telemetry or persistent log for repeated failures. |
| **Markdown parser resilience** | Tracker parsing relies on exact heading names and bold-label formatting; drift in user-edited files can silently break section updates. |
| **No publish CI test** | `VSCE_PAT` secret must be manually rotated; expiry would silently break releases. |
| **`commands.build` / `commands.deploy` empty by default** | Health rows always show `Not configured` until manually set; auto-detect only covers test scripts. |

---

## 9. Next Logical Milestones

1. **Modular refactor** — split `extension.js` into focused modules to reduce collision risk and enable targeted testing. Priority: `tracker.js`, `git.js`, `session.js`, `handoff.js`, `ui/dashboard.js`.

2. **Integration test suite** — add Jest tests (or VS Code Extension Test runner) for `startSessionCore` / `endSessionCore` / `initWorkspace` / section replacement. Cover the drop-zone API with file-system mocks.

3. **Enable and validate zero-touch automation** — set `endSessionZeroTouch.enabled: true` in the template once routing is tested end-to-end; add CI smoke test for the drop-zone `endSession` action.

4. **Implement capability-based routing** — build out the `auto` owner-mode logic so `required_capabilities` can route to specialised agents (e.g. routing UI tasks to Copilot, backend tasks to Codex).

5. **Resilient markdown parsing** — replace regex-based section updates with a structured section model so minor formatting drift in user-edited `AgentTracker.md` does not silently corrupt fields.

6. **Build/deploy auto-detection** — extend `autoDetectCommands` beyond test scripts to detect common build tools (Makefile, Gradle, Docker Compose) and populate `commands.build` and `commands.deploy`.
