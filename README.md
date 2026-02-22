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

From the VS Code Marketplace: search for **AgentSync** or install from the [Marketplace page](https://marketplace.visualstudio.com/items?itemName=Teambotics.agentsync).

From a `.vsix`:

1. Download the latest `.vsix` from [Releases](https://github.com/nickhilster/agentsync/releases)
2. In VS Code, open `Extensions` -> `...` -> `Install from VSIX`

## Local one-command refresh (no Marketplace publish)

Use this during development to package and reinstall the extension locally:

```text
npm run vsix:refresh
```

Related commands:

```text
npm run vsix:package   # package only -> agentsync-local.vsix
npm run vsix:install   # install existing agentsync-local.vsix
```

If VS Code CLI is not on PATH, set `CODE_CLI` before running (Windows example):

```powershell
$env:CODE_CLI="C:\Users\<you>\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd"
npm run vsix:refresh
```

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

## 4. Live dashboard

Run:

```text
AgentSync: Open Live Dashboard
```

The **AgentSync Live** view includes:
- a live operational state (`Ready`, `Busy`, `Waiting`)
- quick action buttons (Initialize, Start/End Session, open tracker/handoffs)
- an **Action Center** that shows running/completed command feedback in real time
- a built-in 3-step onboarding checklist (`Initialize -> Start -> End`)
- failure recovery shortcuts (`Open Tracker`, `Refresh`) surfaced directly in the dashboard
- handoff buckets (`Assigned to me`, `Shared with me`, `Blocked/Stale`)
- animated matrix-style background for at-a-glance activity feedback

## 5. Multi-root behavior

In multi-root workspaces, AgentSync targets the active editor's workspace folder and labels status with the folder name.

## Optional configuration

AgentSync reads optional config from `.agentsync.json` in the repo root.

Example:

```json
{
  "staleAfterHours": 24,
  "autoStaleSessionMinutes": 0,
  "commands": {
    "build": "npm run build",
    "test": "npm test",
    "deploy": "npm run deploy"
  }
}
```

If commands are empty or missing, that health check is marked `Not configured`.

`autoStaleSessionMinutes` controls stale busy-state behavior:
- `0` = disabled (default)
- `>0` = if an active session is older than this threshold, UI shows `Waiting` instead of `Busy`

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
