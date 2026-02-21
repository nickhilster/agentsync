# AgentSync

Multi-agent coordination protocol for VS Code.

AgentSync helps Claude, Codex, and GitHub Copilot work in the same repository without stepping on each other. It installs shared handoff docs and adds workflow commands that keep status current.

## How it works

Each agent reads a different workspace instruction file:

| Agent | File |
| --- | --- |
| Claude Code | `CLAUDE.md` |
| OpenAI Codex | `AGENTS.md` |
| GitHub Copilot | `.github/copilot-instructions.md` |

All instructions point to `AgentTracker.md`, the shared handoff file.

`AgentTracker.md` tracks:

- Last session metadata (agent/date/summary/branch/commit)
- Current health (build/test/deploy)
- Hot files touched recently
- Active work in progress
- Suggested next work and known gotchas

## Install

From the VS Code Marketplace (coming soon): search for `AgentSync`.

From a `.vsix`:

1. Download the latest `.vsix` from [Releases](https://github.com/nickhilster/agentsync/releases)
2. In VS Code, open `Extensions` -> `...` -> `Install from VSIX`

## Usage

## 1. Initialize a workspace

Run from Command Palette:

```text
AgentSync: Initialize Workspace
```

This creates:

```text
CLAUDE.md
AGENTS.md
.github/copilot-instructions.md
AgentTracker.md
.agentsync.json
```

## 2. Start and end sessions

At the beginning of work:

```text
AgentSync: Start Session
```

This appends an item to **In Progress** with agent, timestamp, and goal.

At the end of work:

```text
AgentSync: End Session
```

This updates:

- **Last Session** (agent/date/summary/branch/commit)
- **Current Health** (configured checks)
- **Hot Files** (from git changes)
- **In Progress** (cleans completed entry)
- **Suggested Next Work** (optional note)

## 3. Status bar

The status bar item shows the current workspace's latest session agent.

It also warns when:

- tracker data is stale (older than configured threshold)
- tracker branch differs from current branch
- tracker commit is not in current HEAD history

Click the status item to open `AgentTracker.md`.

## 4. Multi-root behavior

In multi-root workspaces, AgentSync targets the active editor's workspace folder and labels status with the folder name.

## Optional configuration

AgentSync reads optional config from `.agentsync.json` in the repo root.

Example:

```json
{
  "staleAfterHours": 24,
  "commands": {
    "build": "npm run build",
    "test": "npm test",
    "deploy": "npm run deploy"
  }
}
```

If commands are empty or missing, that health check is marked `Not configured`.

## AgentTracker reference

Update these sections at the end of every session:

| Section | What to write |
| --- | --- |
| Last Session | Agent name, date, summary, branch, commit |
| Current Health | Build/test/deploy status |
| Hot Files | Files touched recently |
| In Progress | Active work (clear when complete) |
| Suggested Next Work | Notes for the next agent |
| Known Issues & Gotchas | Bugs, environment quirks, deployment gotchas |
| Conventions | Project patterns and rules discovered during work |

## Recommended workflow

```text
1. Agent: Start Session
2. Agent: Implement work on a branch
3. Agent: Run checks
4. Agent: End Session
5. Human: Review and merge
```

## License

MIT
