# AgentSync

Multi-agent coordination for VS Code.

AgentSync is built for design and product teams using AI agents (Claude, Codex, Copilot) in the same repo. It reduces collisions, keeps handoffs visible, and provides clear status feedback while work is in progress.

## Quick Start

1. Install **AgentSync** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Teambotics.agentsync).
2. Run `AgentSync: Initialize Workspace`.
3. Open `AgentSync: Open Live Dashboard`.
4. (Optional) Run `AgentSync: Open Interactive Tutorial` for guided onboarding.
5. Start work with `AgentSync: Start Session`, then close with `AgentSync: End Session`.

## Why AgentSync

- Prevents multi-agent conflicts with shared workspace conventions.
- Keeps current status visible through a live dashboard and status bar signals.
- Standardizes handoffs and end-of-session notes in one place.
- Supports non-technical contributors with guided checklist and recovery actions.

## Core Workflow

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

## Live Dashboard

Run:

```text
AgentSync: Open Live Dashboard
```

The **AgentSync Live** view includes:

- live operational state (`Ready`, `Busy`, `Waiting`)
- quick action buttons (Initialize, Start/End Session, open tracker/handoffs)
- **Action Center** with running/completed/failed command feedback
- built-in onboarding checklist (`Initialize -> Start -> End`)
- failure recovery shortcuts (`Open Tracker`, `Refresh`)
- handoff buckets (`Assigned to me`, `Shared with me`, `Blocked/Stale`)

## Interactive Tutorial

Run:

```text
AgentSync: Open Interactive Tutorial
```

This opens a VS Code Getting Started walkthrough with clickable steps for:

- opening the live dashboard
- initializing the workspace
- starting a session
- ending a session with updated tracker state

## Command Usage

### 1. Initialize a workspace

```text
AgentSync: Initialize Workspace
```

Creates:

```text
CLAUDE.md
AGENTS.md
.github/copilot-instructions.md
AgentTracker.md
.agentsync.json
```

### 2. Start and end sessions

Start:

```text
AgentSync: Start Session
```

End:

```text
AgentSync: End Session
```

`End Session` updates:

- **Last Session** (agent/date/summary/branch/commit)
- **Current Health** (configured checks)
- **Hot Files** (from git changes)
- **In Progress** (cleans completed entry)
- **Suggested Next Work** (optional note)

### 3. Status bar feedback

The status bar item shows the latest session agent and warns when:

- tracker data is stale (older than configured threshold)
- tracker branch differs from current branch
- tracker commit is not in current HEAD history

Clicking the status item opens `AgentTracker.md`.

### 4. Multi-root behavior

In multi-root workspaces, AgentSync targets the active editor's workspace folder and labels status with the folder name.

## Optional Configuration

AgentSync reads optional config from `.agentsync.json`:

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

If commands are empty or missing, that check is marked `Not configured`.

`autoStaleSessionMinutes`:

- `0` disables stale-session detection (default)
- `>0` shows `Waiting` instead of `Busy` when active session age exceeds threshold

## Requirements

- VS Code `^1.86.0`
- A folder/workspace open in VS Code
- Git available on PATH for hot-file and branch/commit checks

## Privacy and Data

- AgentSync stores coordination files in your workspace (`AgentTracker.md`, `.agentsync/` files).
- It does not require an external service to function.
- Review your workspace and extension telemetry settings for your environment policy.

## Install from VSIX

1. Download the latest `.vsix` from [Releases](https://github.com/nickhilster/agentsync/releases).
2. In VS Code, open `Extensions -> ... -> Install from VSIX`.

## AgentTracker Reference

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

## Recommended Team Flow

```text
1. Agent: Start Session
2. Agent: Implement work on a branch
3. Agent: Run checks
4. Agent: End Session
5. Human: Review and merge
```

## Development Packaging

Local refresh:

```text
npm run vsix:refresh
```

Related commands:

```text
npm run vsix:package   # package only -> agentsync-local.vsix
npm run vsix:install   # install existing agentsync-local.vsix
```

If VS Code CLI is not on PATH (Windows example):

```powershell
$env:CODE_CLI="C:\Users\<you>\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd"
npm run vsix:refresh
```

## License

MIT
