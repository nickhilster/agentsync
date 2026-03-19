# Dallay Feature Adoption Plan

> Native port of best-in-class features from [dallay/agentsync](https://github.com/dallay/agentsync) (Rust CLI) into the AgentSync VS Code Extension.
>
> **Decision:** All features will be implemented natively in JavaScript — no external CLI dependency.
> **Baseline:** AgentSync v0.3.7 | Dallay v1.28.0 (reference source)
> **Created:** 2026-03-14

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Feature Inventory](#2-feature-inventory)
3. [Phase 1 — Expanded Agent Registry (25+ agents)](#3-phase-1--expanded-agent-registry)
4. [Phase 2 — Symlink-Based File Sync](#4-phase-2--symlink-based-file-sync)
5. [Phase 3 — MCP Config Generation](#5-phase-3--mcp-config-generation)
6. [Phase 4 — Managed .gitignore](#6-phase-4--managed-gitignore)
7. [Phase 5 — Init Wizard (Migration Mode)](#7-phase-5--init-wizard)
8. [Phase 6 — Symlink Diagnostics (Doctor)](#8-phase-6--symlink-diagnostics)
9. [Phase 7 — Skills Registry Integration](#9-phase-7--skills-registry)
10. [Architecture & File Map](#10-architecture--file-map)
11. [Testing Strategy](#11-testing-strategy)
12. [Migration & Backwards Compatibility](#12-migration--backwards-compatibility)
13. [Release Plan](#13-release-plan)

---

## 1. Overview & Goals

### What we're borrowing from Dallay

Dallay's AgentSync CLI solves **config file distribution** — write agent instructions once, symlink them to every AI tool's expected location. Our extension already does **runtime session coordination** (sessions, handoffs, health checks, dashboard). By adopting Dallay's best features natively, we get:

- **Single source of truth** for agent instruction files (no more copy drift)
- **MCP server synchronization** across all agents from one config
- **Support for 25+ AI coding tools** (not just Claude/Codex/Copilot/Gemini)
- **Interactive migration** for projects with existing scattered agent files
- **Infrastructure health checks** (symlink integrity, not just build/test)
- **Smart .gitignore management** (auto-add symlink targets)
- **Skills marketplace** access via skills.sh registry

### What we keep (our strengths Dallay doesn't have)

- Live webview dashboard with session state visualization
- Session lifecycle management (Start/End/Stale detection)
- Handoff protocol with structured records and routing
- Health checks for build/test/deploy (project health, not just symlink health)
- 60+ personality catalog with role-based customization
- Zero-touch automation for session management
- Context capsule generation for agent onboarding
- Execution channels (clipboard + drop-zone prompt delivery)

### Design Principles

1. **Additive, not breaking** — existing users' `.agentsync.json` and `AgentTracker.md` workflows keep working
2. **Progressive enhancement** — symlink mode is opt-in; copy-based init remains the default until stable
3. **No external dependencies** — everything runs inside the VS Code extension process
4. **Config-first** — new features are driven by `.agentsync.json` configuration
5. **Platform-safe** — Windows symlinks require Developer Mode; always detect and warn

---

## 2. Feature Inventory

| # | Feature | Dallay Source | Our Target Module | Priority | Phase |
|---|---------|--------------|-------------------|----------|-------|
| 1 | Expanded agent registry (25+ agents) | `src/agent_ids.rs` | `src/utils/agentRegistry.js` | High | 1 |
| 2 | Agent config locations map | `src/agent_ids.rs` (known_ignore_patterns) | `src/utils/agentRegistry.js` | High | 1 |
| 3 | Symlink creation/management | `src/linker.rs` | `src/sync/linker.js` | High | 2 |
| 4 | Symlink-based init mode | `src/init.rs` | `src/sync/linker.js` + extension.js | High | 2 |
| 5 | MCP config generation (JSON) | `src/mcp.rs` | `src/sync/mcpSync.js` | High | 3 |
| 6 | MCP merge strategy | `src/mcp.rs` | `src/sync/mcpSync.js` | Medium | 3 |
| 7 | MCP multi-format (TOML for Codex, settings.json for Gemini) | `src/mcp.rs` | `src/sync/mcpSync.js` | Medium | 3 |
| 8 | Managed .gitignore block | `src/gitignore.rs` | `src/sync/gitignoreManager.js` | Medium | 4 |
| 9 | Init wizard (scan + migrate existing files) | `src/init.rs` (wizard mode) | extension.js command | Medium | 5 |
| 10 | Symlink status/diagnostics | `src/commands/status.rs`, `doctor.rs` | `src/sync/doctor.js` | Medium | 6 |
| 11 | Skills install/update/uninstall | `src/skills/*.rs` | `src/sync/skillsManager.js` | Lower | 7 |
| 12 | Skills registry client (skills.sh) | `src/skills/registry.rs` | `src/sync/skillsManager.js` | Lower | 7 |

---

## 3. Phase 1 — Expanded Agent Registry

**Goal:** Grow from 4 agents to 30+ with proper config location awareness.

### New file: `src/utils/agentRegistry.js`

```
Module responsibilities:
- Canonical agent ID normalization (aliases → canonical)
- Config file location map per agent (instructions, commands, skills, MCP)
- Instruction file path per agent
- MCP config path per agent (for Phase 3)
- Gitignore patterns per agent (for Phase 4)
```

### Agent registry data (ported from Dallay's `agent_ids.rs`)

**MCP-native agents (7):**
| Agent | ID | Instructions File | MCP Config |
|-------|----|----|-----|
| Claude Code | `claude` | `CLAUDE.md` | `.mcp.json` |
| GitHub Copilot | `copilot` | `.github/copilot-instructions.md` | `.vscode/mcp.json` |
| OpenAI Codex | `codex` | — | `.codex/config.toml` |
| Gemini CLI | `gemini` | `GEMINI.md` | `.gemini/settings.json` |
| Cursor | `cursor` | `AGENTS.md` | `.cursor/mcp.json` |
| VS Code | `vscode` | `AGENTS.md` | `.vscode/mcp.json` |
| OpenCode | `opencode` | `AGENTS.md` | `opencode.json` |

**Configurable agents (20+):**
| Agent | ID | Key Config Locations |
|-------|----|----|
| Windsurf | `windsurf` | `.windsurf/mcp_config.json` |
| Cline | `cline` | `.clinerules` |
| Amazon Q | `amazonq` | `.amazonq/rules/`, `.amazonq/mcp.json` |
| Aider | `aider` | `.aider.conf.yml` |
| Firebase/IDX | `firebase` | `.idx/airules.md`, `.idx/mcp.json` |
| OpenHands | `openhands` | `.openhands/microagents/` |
| Junie | `junie` | `.junie/` |
| Augment | `augment` | `.augment/rules/` |
| KiloCode | `kilocode` | `.kilocode/mcp.json` |
| Goose | `goose` | `.goosehints` |
| RooCode | `roo` | `.roo/mcp.json`, `.roo/rules/` |
| Zed | `zed` | `.zed/settings.json` |
| Trae | `trae` | `.trae/rules/` |
| Warp | `warp` | `WARP.md` |
| Kiro | `kiro` | `.kiro/steering/` |
| JetBrains AI | `jetbrains` | `.aiassistant/rules/` |
| Crush | `crush` | `CRUSH.md`, `.crush.json` |
| Amp | `amp` | — |
| Factory | `factory` | `.factory/mcp.json`, `.factory/skills/` |
| Vibe (Mistral) | `vibe` | `.vibe/config.toml` |
| Qwen | `qwen` | `.qwen/settings.json` |

### Changes to existing code

- `src/session/providers.js` — `EXECUTION_PROVIDER_DEFS` grows from 4 to 30+ entries
- Dashboard QuickPick for "Select Agent" uses the full registry
- `canonicalAgentId()` in `src/utils/index.js` delegates to `agentRegistry.js`
- Handoff records support any agent ID from the registry

### Config addition to `.agentsync.json`

```jsonc
{
  "agents": {
    // Which agents to sync instruction files for (default: ["claude", "copilot", "gemini"])
    "enabled": ["claude", "copilot", "gemini", "cursor", "codex"],
    // Session-capable agents shown in Start Session picker (subset of above)
    "sessionProviders": ["claude", "codex", "copilot", "gemini"]
  }
}
```

### Tests

- `test/utils/agentRegistry.test.js` — canonical ID normalization, alias resolution, config paths per agent
- Update existing provider tests

---

## 4. Phase 2 — Symlink-Based File Sync

**Goal:** Replace copy-based instruction file creation with symlinks. Single source of truth.

### New file: `src/sync/linker.js`

```
Module responsibilities:
- Create/update/remove symlinks (platform-aware)
- Detect existing files and back them up (.bak) before replacing with symlinks
- Track sync state (created/updated/skipped/errors)
- Windows Developer Mode detection and warning
- Dry-run mode for preview
```

### Core logic (ported from Dallay's `linker.rs`)

```javascript
// Pseudo-code for the sync engine
function syncAgentFiles(workspaceRoot, config) {
  const sourceDir = path.join(workspaceRoot, '.agents')
  const sourceMd = path.join(sourceDir, 'AGENTS.md')
  const results = { created: 0, updated: 0, skipped: 0, errors: 0 }

  for (const agentId of config.agents.enabled) {
    const agent = AGENT_REGISTRY[agentId]
    if (!agent?.instructionsPath) continue

    const destination = path.join(workspaceRoot, agent.instructionsPath)
    // Check if destination is already a correct symlink
    // If real file exists, back it up
    // Create symlink: destination → sourceMd
    // Track result
  }

  return results
}
```

### Symlink types

| Type | Behavior | Example |
|------|----------|---------|
| `symlink` | Single file symlink | `CLAUDE.md` → `.agents/AGENTS.md` |
| `symlink-contents` | Per-file symlinks for directory contents | `.claude/commands/review.md` → `.agents/command/review.md` |

### Platform handling

```javascript
// Windows requires Developer Mode for symlinks
function createSymlink(target, linkPath, type = 'file') {
  if (process.platform === 'win32') {
    // Check Developer Mode via registry key
    // HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock\AllowDevelopmentWithoutDevLicense
    // If not enabled, show warning with instructions
    // Use fs.symlinkSync(target, linkPath, type === 'dir' ? 'junction' : 'file')
    // Note: junctions don't require elevated privileges for directories
  } else {
    fs.symlinkSync(target, linkPath)
  }
}
```

### Changes to Initialize Workspace command

Current behavior (preserved as default):
1. Copy templates for CLAUDE.md, AGENTS.md, copilot-instructions.md
2. Create AgentTracker.md

New behavior when `sync.mode: "symlink"` in config:
1. Create `.agents/` directory with `AGENTS.md` (merged from existing instructions)
2. Create symlinks from each agent's expected location → `.agents/AGENTS.md`
3. Create AgentTracker.md (not symlinked — unique per project)
4. Update `.gitignore` (Phase 4)

### Config addition to `.agentsync.json`

```jsonc
{
  "sync": {
    "mode": "symlink",        // "copy" (default/legacy) or "symlink"
    "sourceDir": ".agents",   // Where the canonical files live
    "backupExisting": true,   // Back up real files before replacing with symlinks
    "dryRun": false           // Preview mode
  }
}
```

### New commands

- `AgentSync: Apply Sync` — create/update symlinks based on config
- `AgentSync: Clean Sync` — remove all managed symlinks
- `AgentSync: Sync Status` — show current symlink state

### Tests

- `test/sync/linker.test.js` — symlink creation, backup, skip-if-correct, Windows junction fallback
- Cross-platform path handling (forward/back slashes)

---

## 5. Phase 3 — MCP Config Generation

**Goal:** Define MCP servers once, generate configs for all agents.

### New file: `src/sync/mcpSync.js`

```
Module responsibilities:
- Read MCP server definitions from .agentsync.json
- Generate agent-specific MCP config files
- Support merge vs overwrite strategies
- Handle format differences: JSON (most agents), TOML (Codex), JSON+trust (Gemini)
```

### MCP config format per agent (from Dallay's `mcp.rs`)

| Agent | Config Path | Format |
|-------|------------|--------|
| Claude | `.mcp.json` | `{ "mcpServers": { "<name>": { "command": "...", "args": [...] } } }` |
| Copilot | `.vscode/mcp.json` | Same as Claude |
| Cursor | `.cursor/mcp.json` | Same as Claude |
| VS Code | `.vscode/mcp.json` | Same as Claude (shares with Copilot) |
| OpenCode | `opencode.json` | Same as Claude |
| Gemini | `.gemini/settings.json` | `{ "mcpServers": { ..., "trust": true } }` per server |
| Codex | `.codex/config.toml` | TOML format: `[mcp_servers.<name>]` tables |
| Windsurf | `.windsurf/mcp_config.json` | Similar JSON format |
| Amazon Q | `.amazonq/mcp.json` | Similar JSON format |
| KiloCode | `.kilocode/mcp.json` | Similar JSON format |
| Roo | `.roo/mcp.json` | Similar JSON format |
| Firebase/IDX | `.idx/mcp.json` | Similar JSON format |
| Kiro | `.kiro/settings/mcp.json` | Similar JSON format |
| Factory | `.factory/mcp.json` | Similar JSON format |

### Merge strategy

```javascript
function mergeMcpConfig(existingConfig, newServers, strategy) {
  if (strategy === 'overwrite') return { mcpServers: newServers }

  // "merge" (default):
  // 1. Start with existing config
  // 2. Add/overwrite servers from our config
  // 3. Preserve user-added servers not in our config
  const merged = { ...existingConfig.mcpServers }
  for (const [name, config] of Object.entries(newServers)) {
    merged[name] = config  // Our config wins on conflict
  }
  return { mcpServers: merged }
}
```

### Config addition to `.agentsync.json`

```jsonc
{
  "mcp": {
    "enabled": true,
    "mergeStrategy": "merge",  // "merge" or "overwrite"
    "servers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
      },
      "git": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-git", "--repository", "."]
      }
    }
  }
}
```

### New commands

- `AgentSync: Sync MCP Configs` — generate/update MCP configs for all enabled agents
- MCP sync also runs automatically during `Apply Sync` (Phase 2)

### Tests

- `test/sync/mcpSync.test.js` — JSON generation, TOML generation (Codex), Gemini trust flag, merge behavior, overwrite behavior

---

## 6. Phase 4 — Managed .gitignore

**Goal:** Automatically manage .gitignore entries for symlinked files.

### New file: `src/sync/gitignoreManager.js`

```
Module responsibilities:
- Read .gitignore in project root
- Add/update a managed block between markers
- List all symlink destinations as gitignore entries
- Preserve user content outside the managed block
```

### Managed block format (from Dallay's `gitignore.rs`)

```gitignore
# BEGIN AgentSync Managed Symlinks (DO NOT EDIT THIS BLOCK)
CLAUDE.md
GEMINI.md
.github/copilot-instructions.md
.claude/commands/
.mcp.json
.vscode/mcp.json
.gemini/settings.json
# END AgentSync Managed Symlinks
```

### Logic

```javascript
function updateGitignore(workspaceRoot, managedEntries, marker = 'AgentSync Managed Symlinks') {
  const gitignorePath = path.join(workspaceRoot, '.gitignore')
  let content = ''
  try { content = fs.readFileSync(gitignorePath, 'utf8') } catch {}

  const beginMarker = `# BEGIN ${marker} (DO NOT EDIT THIS BLOCK)`
  const endMarker = `# END ${marker}`

  // Remove existing managed block
  const re = new RegExp(`${escapeRegExp(beginMarker)}[\\s\\S]*?${escapeRegExp(endMarker)}\\n?`, 'g')
  content = content.replace(re, '')

  // Append new managed block
  const block = [beginMarker, ...managedEntries, endMarker, ''].join('\n')
  content = content.trimEnd() + '\n\n' + block

  fs.writeFileSync(gitignorePath, content, 'utf8')
}
```

### Config addition to `.agentsync.json`

```jsonc
{
  "gitignore": {
    "enabled": true,          // Auto-manage .gitignore
    "marker": "AgentSync Managed Symlinks",
    "extraEntries": []        // Additional custom entries
  }
}
```

### Tests

- `test/sync/gitignoreManager.test.js` — add block, update block, preserve user content, no duplicate blocks

---

## 7. Phase 5 — Init Wizard

**Goal:** Interactive migration for projects that already have scattered agent config files.

### New command: `AgentSync: Initialize Workspace (Wizard)`

```
Flow:
1. Scan workspace for existing agent files:
   - CLAUDE.md, AGENTS.md, GEMINI.md, WARP.md, CRUSH.md
   - .github/copilot-instructions.md
   - .cursor/*, .windsurf/*, .roo/*, .trae/*, etc.
   - .mcp.json, .vscode/mcp.json, .gemini/settings.json
   - opencode.json, .codex/config.toml

2. Show QuickPick multi-select:
   "Found these existing agent files. Select which to migrate to .agents/:"
   ☑ CLAUDE.md (542 bytes)
   ☑ .github/copilot-instructions.md (542 bytes, identical to CLAUDE.md)
   ☑ .mcp.json (1.2KB)
   ☐ .vscode/mcp.json (800 bytes, different from .mcp.json)

3. For each selected file:
   a. If instruction file → move content to .agents/AGENTS.md (merge if multiple)
   b. If MCP config → parse servers, add to .agentsync.json mcp.servers
   c. If command/skill dir → move to .agents/command/ or .agents/skills/
   d. Back up original to .bak

4. Create symlinks for all migrated files

5. Update .gitignore

6. Show summary: "Migrated 3 files, created 5 symlinks, backed up 2 originals"
```

### Duplicate detection

When multiple instruction files exist, compare content:
- If identical → use one, symlink the rest
- If different → show diff summary, ask user which to use as canonical or merge

### Tests

- `test/sync/initWizard.test.js` — scan detection, migration flow, duplicate handling, MCP extraction

---

## 8. Phase 6 — Symlink Diagnostics

**Goal:** Verify symlink infrastructure health alongside existing project health checks.

### New file: `src/sync/doctor.js`

```
Module responsibilities:
- Check if .agents/ directory exists and has AGENTS.md
- Verify each expected symlink exists and points to correct target
- Detect broken symlinks (target deleted)
- Detect replaced symlinks (user manually overwrote with real file)
- Report MCP config freshness (out of sync with .agentsync.json)
- Windows: check Developer Mode status
```

### Diagnostic checks (from Dallay's `doctor.rs`)

| Check | Pass | Fail |
|-------|------|------|
| Config exists | `.agentsync.json` found | Not found — run Initialize |
| Source dir exists | `.agents/` exists | Missing — run Initialize |
| Source file exists | `.agents/AGENTS.md` found | Missing source file |
| Symlink valid | `CLAUDE.md` → `.agents/AGENTS.md` (correct) | Broken, wrong target, or real file |
| MCP in sync | Generated config matches .agentsync.json | Stale — run Sync MCP |
| Platform support | Windows Developer Mode enabled | Symlinks will fail |
| Gitignore managed | Managed block present in .gitignore | Missing — run Apply Sync |

### Integration with existing health checks

The End Session flow already runs `runHealthChecks()` for build/test/deploy. We'll add sync diagnostics:

```javascript
// In endSessionCore():
const projectHealth = await runHealthChecks(workspaceFolder)  // existing
const syncHealth = runSyncDiagnostics(workspaceFolder)        // new

// Both written to AgentTracker.md Current Health section
```

### New commands

- `AgentSync: Run Diagnostics` — full diagnostic report (project + sync health)
- Dashboard shows sync health alongside project health

### Tests

- `test/sync/doctor.test.js` — all check scenarios, broken symlink detection, Windows mode detection

---

## 9. Phase 7 — Skills Registry

**Goal:** Install, update, and uninstall skills from the skills.sh registry.

### New file: `src/sync/skillsManager.js`

```
Module responsibilities:
- Download skills from skills.sh registry (HTTP fetch)
- Install to .agents/skills/<skill-id>/
- Parse SKILL.md manifest
- Track installed skills in .agentsync.json
- Symlink skills to each agent's skills directory
- Update to latest version (semver resolution)
- Uninstall and clean up symlinks
```

### Skills directory structure

```
.agents/skills/
├── registry.json         ← tracks installed skills + versions
├── design-ux-architect/
│   ├── SKILL.md
│   └── ...
└── testing-api-tester/
    ├── SKILL.md
    └── ...
```

After sync, skills are symlinked:
```
.claude/skills/design-ux-architect/ → .agents/skills/design-ux-architect/
.gemini/skills/design-ux-architect/ → .agents/skills/design-ux-architect/
.cursor/skills/design-ux-architect/ → .agents/skills/design-ux-architect/
```

### New commands

- `AgentSync: Install Skill` — QuickPick with search, downloads from registry
- `AgentSync: Update Skill` — check for newer version, download and replace
- `AgentSync: Uninstall Skill` — remove skill + symlinks
- `AgentSync: List Skills` — show installed skills with versions

### Config addition to `.agentsync.json`

```jsonc
{
  "skills": {
    "installed": {
      "design-ux-architect": { "version": "1.0.0", "source": "skills.sh" },
      "testing-api-tester": { "version": "2.1.0", "source": "skills.sh" }
    }
  }
}
```

### Tests

- `test/sync/skillsManager.test.js` — install flow, update resolution, uninstall cleanup, registry HTTP mocking

---

## 10. Architecture & File Map

### New files to create

```
src/
├── sync/                          ← NEW: all Dallay-ported features
│   ├── index.js                   ← public API surface for sync module
│   ├── linker.js                  ← Phase 2: symlink engine
│   ├── mcpSync.js                 ← Phase 3: MCP config generation
│   ├── gitignoreManager.js        ← Phase 4: .gitignore managed block
│   ├── doctor.js                  ← Phase 6: sync diagnostics
│   └── skillsManager.js           ← Phase 7: skills registry client
├── utils/
│   └── agentRegistry.js           ← Phase 1: expanded agent registry (NEW)
test/
├── sync/
│   ├── linker.test.js
│   ├── mcpSync.test.js
│   ├── gitignoreManager.test.js
│   ├── doctor.test.js
│   └── skillsManager.test.js
└── utils/
    └── agentRegistry.test.js
```

### Files to modify

| File | Change |
|------|--------|
| `src/session/providers.js` | Import from `agentRegistry.js`, expand `EXECUTION_PROVIDER_DEFS` |
| `src/extension.js` | Register new commands (Apply Sync, Clean Sync, Sync Status, Install Skill, etc.) |
| `src/dashboard/dashboardModel.js` | Add sync health data to dashboard model |
| `src/dashboard/dashboardHtml.js` | Add sync status section to dashboard UI |
| `src/utils/index.js` | Re-export agentRegistry utilities |
| `src/utils/health.js` | Integrate sync diagnostics into health output |
| `package.json` | Add new command contributions, bump version |

### Config schema evolution

`.agentsync.json` grows to include:

```jsonc
{
  // === EXISTING (unchanged) ===
  "commands": { "build": "...", "test": "...", "deploy": "..." },
  "staleAfterHours": 8,
  "automation": { ... },
  "requireHandoffOnEndSession": false,

  // === NEW (Phases 1-7) ===
  "agents": {
    "enabled": ["claude", "copilot", "gemini", "cursor", "codex"],
    "sessionProviders": ["claude", "codex", "copilot", "gemini"]
  },
  "sync": {
    "mode": "symlink",
    "sourceDir": ".agents",
    "backupExisting": true
  },
  "mcp": {
    "enabled": false,
    "mergeStrategy": "merge",
    "servers": {}
  },
  "gitignore": {
    "enabled": true,
    "marker": "AgentSync Managed Symlinks"
  },
  "skills": {
    "installed": {}
  }
}
```

---

## 11. Testing Strategy

### Unit tests (per module)

Each new file under `src/sync/` gets a corresponding test file under `test/sync/`.

### Integration tests

- **Full init → sync → verify** flow in a temp directory
- **Wizard migration** with pre-seeded agent files
- **MCP merge** with existing user-defined servers
- **Cross-platform symlink** (mock Windows platform behavior)

### Regression tests

- Existing session/handoff/health tests continue passing
- Existing dashboard rendering tests unchanged
- Copy-based init still works when `sync.mode: "copy"`

### Test commands

```bash
npm test                    # All tests
npm test -- --grep sync     # Only sync module tests
npm test -- --grep registry # Only registry tests
```

---

## 12. Migration & Backwards Compatibility

### Existing users (v0.3.x)

- **No breaking changes.** Default `sync.mode` is `"copy"` (current behavior).
- Users can opt in to symlink mode by adding `"sync": { "mode": "symlink" }` to `.agentsync.json`.
- `Initialize Workspace` command keeps current copy behavior by default.
- New `Initialize Workspace (Wizard)` command is the entry point for migration.

### Migration path

1. User updates extension to v0.4.0+
2. Runs `AgentSync: Initialize Workspace (Wizard)`
3. Wizard scans existing files, offers migration to `.agents/` + symlinks
4. User approves, wizard migrates, creates symlinks
5. `.agentsync.json` updated with `sync.mode: "symlink"`
6. Future `Apply Sync` commands maintain symlinks

### Rollback

If a user wants to revert from symlinks to copies:
1. Run `AgentSync: Clean Sync` — removes all managed symlinks
2. Set `sync.mode: "copy"` in config
3. Run `AgentSync: Initialize Workspace` — creates fresh copies from `.agents/AGENTS.md`

---

## 13. Release Plan

### v0.4.0 — Foundation
- Phase 1: Expanded agent registry (25+ agents)
- Phase 4: Managed .gitignore

### v0.5.0 — Symlink Engine
- Phase 2: Symlink-based file sync
- Phase 5: Init Wizard

### v0.6.0 — MCP & Diagnostics
- Phase 3: MCP config generation
- Phase 6: Symlink diagnostics (doctor)

### v0.7.0 — Skills
- Phase 7: Skills registry integration

### Version naming

Each release gets a clear CHANGELOG entry crediting the Dallay project as inspiration:

> "Inspired by [dallay/agentsync](https://github.com/dallay/agentsync), this release adds native symlink-based file synchronization to the AgentSync extension."

---

## Appendix A: Dallay Source Reference Map

For each feature, the canonical Dallay source file to reference during implementation:

| Feature | Dallay file | Key functions/structs |
|---------|-----------|----------------------|
| Agent IDs | `src/agent_ids.rs` | `canonical_mcp_agent_id()`, `known_ignore_patterns()` |
| Config parsing | `src/config.rs` | `Config`, `AgentConfig`, `TargetConfig`, `SyncType` |
| Symlink engine | `src/linker.rs` | `Linker::sync()`, `SyncOptions`, `SyncResult` |
| MCP generation | `src/mcp.rs` | `McpAgent`, `McpGenerator`, `McpSyncResult` |
| Gitignore | `src/gitignore.rs` | `update_gitignore()` |
| Init/wizard | `src/init.rs` | `DEFAULT_CONFIG`, `DEFAULT_AGENTS_MD`, wizard scan |
| Doctor | `src/commands/doctor.rs` | `run_doctor()` |
| Status | `src/commands/status.rs` | `run_status()` |
| Skills | `src/skills/*.rs` | `install_skill_async()`, `update_skill_async()` |

## Appendix B: Agent Config Locations Quick Reference

Complete mapping of where each AI tool expects its files:

| Agent | Instructions | Commands | Skills | MCP Config |
|-------|-------------|----------|--------|------------|
| Claude | `CLAUDE.md` | `.claude/commands/` | `.claude/skills/` | `.mcp.json` |
| Copilot | `.github/copilot-instructions.md` | `.github/agents/` | — | `.vscode/mcp.json` |
| Gemini | `GEMINI.md` | `.gemini/commands/` | `.gemini/skills/` | `.gemini/settings.json` |
| Cursor | `AGENTS.md` | `.cursor/commands/` | `.cursor/skills/` | `.cursor/mcp.json` |
| VS Code | `AGENTS.md` | `.vscode/` | — | `.vscode/mcp.json` |
| OpenCode | `AGENTS.md` | `.opencode/command/` | `.opencode/skills/` | `opencode.json` |
| Codex | — | — | `.codex/skills/` | `.codex/config.toml` |
| Windsurf | — | — | — | `.windsurf/mcp_config.json` |
| Cline | `.clinerules` | — | — | — |
| Amazon Q | — | — | — | `.amazonq/mcp.json` |
| Aider | `.aider.conf.yml` | — | — | — |
| Firebase/IDX | `.idx/airules.md` | — | — | `.idx/mcp.json` |
| RooCode | — | — | `.roo/skills/` | `.roo/mcp.json` |
| Zed | — | — | — | `.zed/settings.json` |
| Trae | — | — | — | — |
| Warp | `WARP.md` | — | — | — |
| Kiro | — | — | — | `.kiro/settings/mcp.json` |
| JetBrains | — | — | — | — |
| Crush | `CRUSH.md` | — | — | `.crush.json` |
| Factory | — | — | `.factory/skills/` | `.factory/mcp.json` |
| Vibe | — | — | `.vibe/skills/` | `.vibe/config.toml` |
