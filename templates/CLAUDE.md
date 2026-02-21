# AgentSync Protocol

This workspace uses the **AgentSync** multi-agent coordination protocol. It enables Claude, Codex,
GitHub Copilot, and other AI agents to work on the same codebase without stepping on each other.

## On every session start

1. **Read `AgentTracker.md`** — what the last agent did, which files are hot, and what's suggested next
2. **`git status` + `git pull`** — get the latest changes before touching anything
3. **Run the project's test command** — confirm a clean baseline before making changes

## During work

- Work on a feature branch when possible: `[agent-name]/[feature]` (e.g. `claude/accessibility-pass`)
- Treat files listed in **Hot Files** (AgentTracker) as potentially conflicting — coordinate before editing
- Do not leave partial implementations without a comment — document incomplete work in AgentTracker

## Before ending your session

1. Run build and tests — confirm they pass
2. Commit all changes with a descriptive message
3. **Update `AgentTracker.md`**:
   - **Last Session**: your agent name, today's date, a one-line summary, commit hash
   - **Current Health**: update build / tests / deploy status
   - **Hot Files**: list files you touched
   - **In Progress**: clear this section if your work is complete
   - **Suggested Next Work**: leave notes for the next agent
   - **Known Issues & Gotchas**: add anything that surprised you or will matter later
   - **Conventions**: record any patterns or rules you discovered
