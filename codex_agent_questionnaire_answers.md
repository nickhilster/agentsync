# Codex Responses to Agent Coordination Questionnaires

Date: 2026-02-21
Scope: These answers describe Codex running as a terminal coding agent in this workspace (file edits + shell tools), not a standalone always-on service.

## A) Answers to `agent-coordination-questions.md`

### For Codex

1. Are you session-based or always-on?
Codex is session-based in this setup. Work starts when a user or orchestrator sends a prompt/request and ends when the task response is complete.

2. Do you work on files sequentially or in parallel?
Reads/searches can be parallelized safely. Writes should be treated as serialized per file to avoid collisions. Use file-level locks, not repo-wide locks.

3. Can you write to `AgentTracker.md` before and after your session?
Yes, if instructed. I can update `AgentTracker.md` directly. I cannot click VS Code UI commands from terminal-only orchestration, but I can write equivalent tracker updates as files.

4. What is your default branching behavior?
No hardcoded branch policy. Recommended policy is always use feature branches named `codex/<task-slug>` and avoid direct commits to `main`.

5. How do you handle merge conflicts with your commits?
Default behavior is to surface conflicts and avoid destructive auto-resolution. Recommended automation rule: stop, report conflicting files, and request rebase/cherry-pick workflow.

6. Can you be triggered by a webhook or GitHub Action?
Not as a direct inbound webhook endpoint in this runtime. Yes through an orchestrator that receives webhooks/events and invokes Codex with task context.

7. Can you read and act on structured instructions in files?
Yes. I can consume task files such as `AGENTS.md` and `next-task.md` when asked. I do not autonomously poll files between sessions.

8. Do you support a "done" signal?
Yes by convention. Recommended done signals:
- Update `AgentTracker.md` sections (`Last Session`, `In Progress`, `Suggested Next Work`)
- Create commit with structured footer fields
- Optionally write `.agentsync/result.json` style completion artifact

9. What files/directories should Claude avoid while Codex runs?
Avoid files actively listed in `Hot Files` and `In Progress`. Also avoid writing lock/temp files such as `.git/index.lock` and build output dirs unless task explicitly targets them.

10. Can you run external tools and health checks?
Yes. I can run shell commands, build/test scripts, and write outputs into tracker artifacts. In this repo, `.agentsync.json` commands are currently empty, so explicit commands must be provided.

### Shared / Open Questions

1. Best task format?
Use structured JSON plus short natural-language objective:

```json
{
  "task_id": "AS-142",
  "goal": "Implement X and add tests",
  "repo": "org/repo",
  "branch": "codex/as-142-implement-x",
  "constraints": ["Do not change public API", "Keep Node 20 compatibility"],
  "acceptance_criteria": ["Unit tests pass", "No lint errors"],
  "files_in_scope": ["src/**", "tests/**"],
  "commands": {
    "build": "npm run build",
    "test": "npm test"
  }
}
```

2. Conflict handling when two agents need the same file?
Use first-to-claim lock with TTL plus branch isolation.
- Agent claims file in `Hot Files` with timestamp and owner.
- If lock stale beyond TTL, next agent can take over and record takeover.
- Final merge uses CI + reviewer arbitration, not silent auto-merge.

3. Minimum metadata in `AgentTracker.md`?
- Agent name
- Start/end timestamp (UTC)
- Branch and commit SHA
- Files changed (or glob summary)
- Commands run + pass/fail
- Known risks/blockers
- Suggested next action

## B) Answers to `templates/agent_collaboration_questions.md` (Codex section + shared)

### Integration & APIs

1. Programmatic interfaces exposed?
In this runtime, Codex is invoked through host/orchestrator calls, not a direct public endpoint. Practical interfaces:
- Prompt invocation from orchestrator or CLI wrapper
- File-based handoff artifacts (`AgentTracker.md`, task JSON)
- Shell command execution + patch application

Recommended request/response contract:

```json
{
  "request": {
    "task_id": "AS-210",
    "goal": "Fix auth timeout bug",
    "branch": "codex/as-210-auth-timeout",
    "files_in_scope": ["src/auth/**", "tests/auth/**"],
    "commands": {"test": "npm test -- auth"}
  },
  "response": {
    "task_id": "AS-210",
    "status": "ready_for_review",
    "summary": "Adjusted timeout handling and added regression test",
    "files_changed": ["src/auth/session.ts", "tests/auth/session.test.ts"],
    "checks": [{"name": "npm test -- auth", "status": "pass"}]
  }
}
```

2. Preferred input formats?
- Markdown for human instructions
- JSON for machine contracts
- Unified diff for code deltas
- Explicit file paths and commands

3. Metadata in/out?
Input metadata should include `task_id`, `repo`, `branch`, `files_in_scope`, `acceptance_criteria`, `commands`.
Output metadata should include `status`, `files_changed`, `checks`, `risks`, `next_steps`, `commit_sha` if committed.

4. Streaming or partial results?
Yes at session level (incremental progress updates and final output). For automation, treat completion artifact as source of truth and progress updates as advisory.

### Automation & Triggers

1. Which events should trigger Codex?
Recommended triggers:
- `pull_request` labeled `codex-task`
- `issue_comment` with explicit command token
- `workflow_run` failure for auto-fix loops
- Scheduled maintenance tasks for low-risk chores

2. Sync vs async in CI?
Both are workable:
- Sync/blocking: short tasks under strict timeout (5-20 min)
- Async/non-blocking: larger tasks with status artifact polling and callback comment

3. Retry/backoff semantics?
- Retry only transient failures (network/tooling), not logic failures
- Exponential backoff: 15s, 45s, 120s (max 3 retries)
- Attach prior failure summary to retry request

### Handoff & Ownership

1. Minimal handoff context/artifacts?
- Task goal + constraints
- Target branch
- Patch/diff
- Tests added/updated
- Command results
- Risk notes

2. Marking ownership/safe-to-merge?
Use commit trailer or PR metadata:
- `Co-Authored-By: Codex`
- `Agent: codex`
- `Task-ID: AS-210`
- `Merge-Readiness: review-required|ready-to-merge`

3. Representing conflicts between agent suggestions?
Store competing patches as separate artifacts and include a compare manifest:

```json
{
  "task_id": "AS-210",
  "candidates": [
    {"agent": "codex", "patch": "artifacts/as-210-codex.patch"},
    {"agent": "copilot", "patch": "artifacts/as-210-copilot.patch"}
  ],
  "decision_inputs": ["test_results.json", "security_report.json"]
}
```

### CI/CD & Repo Workflows

1. Expected CI steps after edits?
Minimum:
- formatter
- linter
- targeted tests
- full test suite for merge gate
- security scan if available

2. Deterministic repeatability?
Fully deterministic output is not guaranteed. Improve stability by pinning:
- model/version
- prompt template
- task schema
- toolchain versions
- seed/temperature controls when available

3. Patch objects and automated commits?
Yes, patch/diff artifacts are straightforward. Automated commits should include task ID, agent ID, and CI/check summary.

### Observability & Debugging

1. Logs/telemetry emitted?
This runtime exposes command outputs, exit codes, file edits, and task messages. Orchestrator should capture:
- timestamp
- task_id
- command
- exit_code
- changed_files
- failure_reason

2. Debug artifacts available?
- Failing test output
- lint/build logs
- generated patch/diff
- step-by-step action transcript

### Security, Data & Limits

1. Auth/authz model?
Agent permissions are defined by host environment plus provided credentials. Use least-privilege tokens and short-lived credentials for GitHub/API operations.

2. Secrets handling?
Do not place secrets in prompts/files. Pass secrets through environment or vault-backed runtime. Redact logs before storing artifacts.

3. Rate limits/payload/cost limits?
Limits are provider/runtime dependent. Recommended guardrails:
- hard timeout per task
- max file count per task
- token/input size budgets
- queue concurrency controls

### Preferences & Conventions

1. Prompt templates and coding conventions?
Best results with explicit templates:
- objective
- scope
- constraints
- acceptance criteria
- commands to run

Respect repo configs (`.editorconfig`, linter rules, formatter configs, test conventions).

2. Strong/weak areas?
Strong: implementation, refactors, test updates, CLI/tool-driven workflows.
Needs guardrails: ambiguous product decisions, policy/legal judgments, requirements with missing acceptance criteria.

### Failure Modes & Recovery

1. Common failure modes and remediation?
- Ambiguous task -> enforce schema validation before execution
- Stale branch/conflict -> rebase + rerun tests
- Flaky tests -> rerun threshold + quarantine label
- Missing dependency/tool -> preflight environment check

2. Rollback/quarantine workflow?
- Revert offending commit on feature branch
- Mark PR `quarantined` with failure reason
- Preserve artifacts/logs
- Re-queue task only after human or policy approval

### Shared / Cross-cutting

1. Minimal handshake/schema?
Use this base schema for all agents:

```json
{
  "task_id": "AS-300",
  "agent": "codex",
  "goal": "string",
  "priority": "low|normal|high|urgent",
  "repo": "string",
  "branch": "string",
  "files_in_scope": ["glob"],
  "acceptance_criteria": ["string"],
  "commands": {"build": "string", "test": "string"},
  "inputs": [{"type": "spec|diff|log", "ref": "path-or-url"}],
  "status": "queued|in_progress|blocked|ready_for_review|ready_to_merge|done",
  "provenance": {"requested_by": "user-or-system", "timestamp_utc": "ISO-8601"}
}
```

2. Programmatic `ready_for_review` vs `ready_to_merge`?
- `ready_for_review`: code + local checks complete, human/policy review pending
- `ready_to_merge`: required CI + policy checks passed and no blocking comments

3. Standard artifact set per automated change?
- `*.patch` or PR diff
- `checks.json` (build/lint/test results)
- `risk_report.md`
- `change_summary.md`
- optional `security_report.json`

4. First-day integration prototype (all three agents)?
Suggested thin-slice:
- Trigger: PR labeled `triage-ai`
- Flow:
  1. Copilot proposes quick fix branch
  2. Codex applies deterministic patch + tests
  3. Claude evaluates risks/conflicts and posts merge recommendation
- Payload: use shared task schema above
- Success criteria:
  - end-to-end cycle under 20 minutes
  - all required checks pass
  - artifacts generated for every run
  - zero manual copy-paste between agents

## Short Integration Checklist

1. Standardize one task JSON schema and one artifact directory layout.
2. Enforce branch naming (`codex/*`, `copilot/*`, `claude/*`).
3. Require `AgentTracker.md` updates at start and finish.
4. Run required checks before any `ready_to_merge` state.
5. Capture logs and artifacts for every task ID.
6. Add conflict protocol and lock TTL for hot files.
