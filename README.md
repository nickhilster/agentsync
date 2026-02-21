# AgentSync

**Multi-agent coordination protocol for VS Code.**

AgentSync lets Claude, Codex, and GitHub Copilot work on the same codebase without stepping on each other. It installs a shared handoff document (`AgentTracker.md`) and the per-agent instruction files each tool reads natively — so every agent starts oriented, and leaves notes for the next one.

---

## How it works

Each AI agent reads a different file for workspace context:

| Agent | File |
| --- | --- |
| Claude Code | `CLAUDE.md` |
| OpenAI Codex | `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |

All three files contain the same protocol: read `AgentTracker.md` first, work cleanly, update the tracker before finishing.

`AgentTracker.md` is the live handoff doc — it records who last worked on the repo, which files are hot, what's in progress, and what to do next.

---

## Install

**From the VS Code marketplace** *(coming soon)*:
Search for `AgentSync` in the Extensions panel.

**From a `.vsix` file**:

1. Download the latest `.vsix` from [Releases](https://github.com/nickhilster/agentsync/releases)
2. In VS Code: `Extensions` → `...` → `Install from VSIX`

---

## Usage

### 1. Initialize any workspace

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
AgentSync: Initialize Workspace
```

This creates four files in your project root:

```
CLAUDE.md
AGENTS.md
.github/copilot-instructions.md
AgentTracker.md
```

`AgentTracker.md` opens automatically so you can fill in the project context.

### 2. Status bar

The AgentSync status bar item (bottom-left) shows the last agent who updated the tracker:

```
⟳ Claude
```

Click it to open `AgentTracker.md`.

### 3. Open the tracker anytime

```
AgentSync: Open AgentTracker
```

---

## AgentTracker.md reference

Update these sections at the end of every session:

| Section | What to write |
| --- | --- |
| **Last Session** | Your agent name, date, one-line summary, commit hash |
| **Current Health** | Build / tests / deploy status |
| **Hot Files** | Files you touched (other agents should coordinate before editing) |
| **In Progress** | Active work — clear when complete |
| **Suggested Next Work** | Notes for the next agent |
| **Known Issues & Gotchas** | Bugs, environment quirks, deployment gotchas |
| **Conventions** | Patterns and rules discovered during work |

---

## Recommended workflow

```
1. Claude:  Plan + spec work
2. Codex:   Feature implementation on a branch
3. Claude:  Review, tests, accessibility pass
4. Human:   Merge
5. Claude:  Confirm deploy, update AgentTracker
```

Each agent reads AgentTracker at the start of their turn and updates it at the end. No manual relay required.

---

## License

MIT
