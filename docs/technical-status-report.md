# AgentSync – Technical Status Report

_Generated: 2026-03-11 | Version: 0.3.7_

---

## 1. Project Overview

**What it does:** AgentSync is a VS Code extension that enables safe multi-agent AI collaboration on a shared codebase. It prevents conflicts between agents (Claude, Codex, GitHub Copilot, Gemini) by maintaining a single source of truth for session state, handoffs, and coordination metadata. Humans and AI agents follow the same protocol: read `AgentTracker.md` before touching code, update it when done.

**Primary technologies:**

- **Runtime:** Node.js + VS Code Extension API (Activation: `onStartupFinished`)
- **Language:** JavaScript (ES2020, CommonJS modules)
- **Build:** esbuild (bundles `src/extension.js` → `out/extension.js`)
- **Testing:** Jest (17 test files, mocked VS Code API in `__mocks__/vscode.js`)
- **Linting/Formatting:** ESLint + Prettier (single quotes, no semicolons)
- **Distribution:** VSIX package via `@vscode/vsce`; published to VS Code Marketplace

**Current maturity:** MVP — core coordination loop is complete and tested. Advanced features (zero-touch automation, role presets, capability routing) were added iteratively and are partially stabilised. Not yet production-hardened at scale.

---

## 2. Core Architecture

### Main modules and responsibilities

| Directory / File | Responsibility |
|---|---|
| `src/extension.js` | Extension entry point: registers 23+ VS Code commands, manages status bar, handles all top-level command dispatch |
| `src/session/` | Session lifecycle (start/end), operational state computation, provider and personality metadata |
| `src/dashboard/` | WebView-based live dashboard: HTML generation, data model, message handling, handoff action processing |
| `src/utils/` | 19 domain-specific utilities: I/O, git integration, handoff logic, health checks, context capsules, automation routing, agent catalog, execution channels |
| `templates/` | Seed files for workspace init: `AgentTracker.md`, `CLAUDE.md`, `AGENTS.md`, `copilot-instructions.md`, agent personalities (40+), role presets (5) |
| `schemas/` | `handoffs.schema.json` — JSON Schema for `.agentsync/handoffs.json` |
| `scripts/` | Build/packaging helpers |
| `docs/` | Architecture docs, integration plans, EOD notes |
| `test/` | Jest unit tests covering utilities, handoff lifecycle, session identity, prompt assembly |

### How agents/personas are implemented

Agent personalities are defined as Markdown files with YAML frontmatter in `templates/agents/` (10 categories, 40+ personalities). At runtime, `src/utils/agentCatalog.js` loads and indexes them into a searchable catalog. A personality provides a system-prompt body, capability tags (`capabilities: [architecture, implementation]`), and shortcut keys. When a session starts with a specific agent, its personality prompt is assembled via `src/utils/executionChannels.js` and delivered to the chosen LLM interface.

### How LLM providers are integrated

Providers are **not called directly via API**. Instead, each provider reads a workspace instruction file that the extension maintains:

- Claude Code → `CLAUDE.md`
- OpenAI Codex → `AGENTS.md`
- GitHub Copilot → `.github/copilot-instructions.md`

All instruction files point agents to `AgentTracker.md`. Direct LLM API integration is absent by design — the extension orchestrates _human-in-the-loop_ handoffs.

### Orchestration / routing layer

`src/utils/automation.js` implements `resolveAutomationRoute()`, which reads `automation.handoffRoutingDefaults` from `.agentsync.json` and maps the current agent to a default next agent and `owner_mode` (`single | shared | auto`). Capability-based scoring (`src/utils/` `scoreNextTaskCapabilities`) can recommend a model tier based on required capabilities declared in a handoff.

---

## 3. Agent System

### Agent personas (templates/agents/ categories)

| Category | Example Personas |
|---|---|
| `engineering/` | Software Developer, Engineering Architect |
| `design/` | UX Designer, Brand Designer |
| `marketing/` | Content Strategist, Campaign Manager |
| `product/` | Product Manager, Business Analyst |
| `project-management/` | Project Coordinator, Sprint Planner |
| `support/` | Technical Writer, Support Specialist |
| `testing/` | QA Engineer, Performance Tester, Results Analyst |
| `specialized/` | Data Engineer, Automation Specialist |
| `spatial-computing/` | XR Designer, Spatial Developer |
| `strategy/` | Strategy Lead, Market Analyst |

### Responsibilities

Each persona provides a focused system-prompt that constrains the LLM's behaviour to a domain. For example, the Engineering Architect persona emphasises system design and ADRs, while the QA Engineer persona focuses on test coverage and regression analysis.

### Agent handoff flow

1. Agent A ends a session (`agentsync.endSession`) — the extension writes a record to `AgentTracker.md` (**Last Session**), updates `.agentsync/state.json`, and appends a handoff entry to `.agentsync/handoffs.json`.
2. Agent B starts a session (`agentsync.startSession`) — reads `AgentTracker.md`, optionally auto-claims the top queued handoff.
3. The Live Dashboard (`agentsync.openDashboard`) shows queued handoffs as action cards. Agent B can **Claim** a handoff, work, then **Complete** it.

Context can be packaged deterministically via `agentsync.contextCapsule` and delivered either to the clipboard or written to `.agentsync/agent-prompt.md` (drop-zone channel) for terminal-based agents.

---

## 4. LLM / Service Routing

### Supported providers

| Provider ID | Instruction file | Interface type |
|---|---|---|
| `claude` | `CLAUDE.md` | Claude Code (terminal) |
| `codex` | `AGENTS.md` | OpenAI Codex CLI |
| `copilot` | `.github/copilot-instructions.md` | VS Code Copilot Chat |
| `gemini` | (future) | Gemini CLI / API |

### Model selection

The extension does not call LLM APIs directly. Model selection is the responsibility of the human or the agent's own tooling. The extension provides a **capability scoring** helper (`scoreNextTaskCapabilities`) that maps a handoff's `required_capabilities` array to a `recommended_model_tier` field (`basic | standard | advanced`), written into the handoff record for guidance.

### Token usage / rate-limit management

`tokenBudget` is configurable in `.agentsync.json`:

```json
"tokenBudget": {
  "maxTokensDefault": 4000,
  "batchSimilarTasks": true,
  "enableCaching": true
}
```

Context capsules include an estimated token count (`context_hints.token_estimate`). Actual enforcement is not yet implemented — this is a placeholder for future integration.

---

## 5. Repo Structure

### Key directories

```
agentsync/
├── src/
│   ├── extension.js          # Entry point (3 993 lines)
│   ├── session/              # SessionManager, state, providers, personalities
│   ├── dashboard/            # DashboardProvider, HTML, model, handoff actions
│   └── utils/                # 19 utility modules (index.js re-exports all)
├── templates/
│   ├── agents/               # 40+ personality markdown files (10 categories)
│   └── roles/                # 5 role preset JSON files
├── schemas/
│   └── handoffs.schema.json  # Handoff record JSON Schema
├── docs/                     # Architecture docs and planning notes
├── test/                     # 17 Jest unit tests
├── scripts/                  # Build helpers
├── out/                      # Compiled extension bundle (esbuild output)
└── .github/
    ├── workflows/ci.yml       # Lint → Test → Package
    └── workflows/release.yml  # Tag-triggered Marketplace publish
```

### Key architecture files

| File | Role |
|---|---|
| `src/extension.js` | Command registration and top-level orchestration |
| `src/session/SessionManager.js` | Session start/end core logic |
| `src/utils/automation.js` | Zero-touch session end and handoff routing |
| `src/utils/handoffs.js` | Handoff CRUD and lifecycle transitions |
| `src/utils/agentCatalog.js` | Personality catalog loader |
| `src/utils/executionChannels.js` | Prompt assembly and delivery |
| `src/utils/health.js` | Build/test/deploy health check runner |
| `src/utils/storage.js` | Atomic file write helpers |
| `schemas/handoffs.schema.json` | Canonical handoff data contract |
| `.agentsync.json` | Workspace-level runtime configuration |
| `AgentTracker.md` | Human-readable shared state document |

### Entry points

- **Extension:** `out/extension.js` (bundled from `src/extension.js`, declared in `package.json` as `"main"`)
- **Tests:** `jest` (via `npm test`), targeting `test/**/*.test.js`
- **Build:** `npm run compile` → esbuild bundles to `out/`

---

## 6. Development Workflow

### Branch strategy

- `main` — stable release branch; CI runs on push; releases triggered by `v*.*.*` tags
- Feature branches follow `[agent-name]/[feature]` convention (e.g., `copilot/generate-technical-status-report-again`)
- No long-lived `dev` branch observed; features merge directly to `main`

### How agents and humans contribute

1. Agent (or human) reads `AgentTracker.md` and the relevant instruction file (`CLAUDE.md` / `AGENTS.md` / `copilot-instructions.md`)
2. Runs `AgentSync: Start Session` (or `agentsync.startSession`) — logs agent, goal, start time
3. Makes changes on a feature branch
4. Runs `AgentSync: End Session` — updates tracker, generates handoff, surfaces health check results
5. Opens PR; CI pipeline (lint + test + VSIX package) validates the branch

### CI/CD

**CI (`ci.yml`):** ESLint → Prettier check → Jest → `vsce package` (VSIX validation) → Upload artifact (30-day retention, main/master only)

**Release (`release.yml`):** Tag push (`v*.*.*`) → lint/test → package VSIX → publish to VS Code Marketplace → create GitHub Release with VSIX attachment and changelog excerpt

---

## 7. Current Capabilities

- ✅ Workspace initialisation: seeds `AgentTracker.md`, `CLAUDE.md`, `AGENTS.md`, `.agentsync.json`, state and handoff files
- ✅ Session start/end with atomic state writes and tracker updates
- ✅ Live WebView dashboard (compact / full modes) with real-time status, hot files, handoff queue
- ✅ Handoff lifecycle: create → claim → complete, with schema-validated JSON records
- ✅ Capability-based `recommended_model_tier` scoring for handoff routing
- ✅ Zero-touch session end: deterministic summary, auto-routed handoff draft, clipboard copy
- ✅ Role presets (5 profiles) with dynamic dashboard shortcuts and routing defaults
- ✅ Agent personality catalog (40+ personalities, 10 categories) with capability mapping
- ✅ Execution channels: clipboard and drop-zone (`.agentsync/agent-prompt.md`)
- ✅ Health checks: spawn build/test/deploy commands, record pass/fail in tracker
- ✅ Stale session detection with status bar warnings
- ✅ Hot-file tracking via git, with explorer decorations and on-open collision warnings
- ✅ Context capsule generation with token estimate hints
- ✅ Agency runs ingestion from external `.agencysync/` directories
- ✅ Getting Started walkthrough (VS Code interactive tutorial)
- ✅ 17 Jest unit tests covering critical paths; VSCode API mocked

---

## 8. Missing Pieces / TODOs

| Area | Gap |
|---|---|
| **Direct LLM API calls** | No API integration exists; prompt delivery relies entirely on clipboard or drop-zone. Gemini provider is registered but has no instruction-file template. |
| **Token budget enforcement** | `tokenBudget` config fields are parsed but not enforced; `batchSimilarTasks` and `enableCaching` are placeholders. |
| **Multi-root workspace** | `src/utils/workspace.js` has multi-root scaffolding but commands operate on the active-editor folder only; cross-folder session coordination is untested. |
| **Pipeline creation** | `agentsync.createPipeline` command is registered but the implementation is incomplete (stub in `src/extension.js`). |
| **`agentsync.runNextStep`** | Command is registered; execution logic delegates to an external drop-zone request but the full automation loop is not closed. |
| **Gemini instruction file** | No `GEMINI.md` template exists; Gemini agents have no workspace instruction file to read. |
| **E2E / integration tests** | All tests are unit-level; there is no VS Code extension integration test suite (e.g., using `@vscode/test-electron`). |
| **Tracker conflict resolution** | Concurrent writes by two agents to `AgentTracker.md` rely on OS-level atomic rename but have no application-level merge or CRDT strategy. |
| **Publish documentation** | `docs/publish-todo.md` lists outstanding documentation and marketplace listing tasks. |
| **Context capsule size limits** | Token estimate is computed but not capped; large workspaces could produce oversized capsules. |

---

## 9. Next Logical Milestones

1. **Close the automation loop** — Complete `agentsync.runNextStep` and `agentsync.createPipeline` so a fully automated multi-step pipeline can run without human intervention at each handoff boundary.

2. **Gemini support** — Add `GEMINI.md` instruction template and wire up the `gemini` provider in workspace init, matching the pattern used for Claude, Codex, and Copilot.

3. **Integration test suite** — Introduce `@vscode/test-electron`-based tests to cover command registration, session start/end, and dashboard rendering in a real VS Code host, reducing reliance on the manual QA loop.

4. **Token budget enforcement** — Implement the `maxTokensDefault` cap in context capsule generation and add `batchSimilarTasks` logic to the handoff router to limit per-session context size.

5. **Conflict detection / merge strategy** — Implement a last-write-wins or section-level merge for `AgentTracker.md` when two agents end sessions nearly simultaneously, preventing silent overwrites.

6. **Direct API channel (optional)** — Add an opt-in LLM API channel (OpenAI / Anthropic) so the extension can autonomously trigger agent runs without requiring the human to paste prompts, moving from coordination tool to orchestration platform.

7. **Marketplace and documentation polish** — Address `docs/publish-todo.md` items: marketplace screenshots, demo GIF, detailed role-preset documentation, and a public `docs/` site.
