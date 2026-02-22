# Copilot — Integration & Automation Answers

Response format: numbered answers matching the questionnaire.

1. Best programmatic entry points
- GitHub REST/GraphQL APIs (create PRs, fetch files, post comments).
- GitHub Actions steps for CI-integrated, blocking automation.
- Webhooks for event-driven triggers (PR opened, comment, check_suite).
- VS Code extension command hooks for local/manual workflows.
- MCP/tool bridge or internal RPC for high-throughput orchestrators.

2. Recommended trigger events
- Trigger: PR opened, PR updated, PR comment mention (explicit trigger), CI failure (on failing suite), label added (e.g., `autofix`), scheduled cron for periodic audits.
- Do not trigger on every push to long-lived branches or trivial doc-only commits (config rule to opt-out).

3. Invocation pattern for reliability
- Preferred: GitHub Action step (idempotent, authenticated via GitHub token) for CI/blocking runs.
- Alternative: REST API call from orchestrator (GitHub App token) for async jobs with callback webhook.
- Human-initiated: `@copilot-bot run` comment in PR (action listens and enqueues job).

4. Minimum input contract
- JSON object with: `task_id`, `repo`, `branch`, `target_files` (globs or paths), `goal` (1–2 sentence), `constraints` (max LOC, banned APIs), `acceptance` (test command), `agent_id`, `timeout_seconds`.

5. Output contract
- Machine-parsable response including: `patch` (unified diff), `changed_files` (array), `rationale` (short), `tests_to_run` (commands), `risk_flags` (enum), `confidence` (0-1), `task_id`.

6. Prompt / input structure
- Use strict JSON envelope between clear markers (e.g., `---BEGIN TASK---\n{...}\n---END TASK---`) and include a `template_version` field.
- Keep natural-language goal brief; place constraints and tests in structured fields.

7. Practical limits & orchestrator adaptation
- Operate best with per-task context under a large-but-bounded window (recommend splitting tasks by file or module for very large repos).
- Limit concurrent tasks per-repo (e.g., 3) to avoid merge contention.
- If a task exceeds context, provide file-level diffs and run on smaller scopes.

8. Authentication model
- GitHub App installation tokens for repo actions (least-privilege scopes: `contents`, `pull_requests`, `checks`, `statuses`).
- Use short-lived tokens and verify webhooks via HMAC signature.

9. Guardrails before accepting changes
- Mandatory: pass unit tests, required linters, secret-scan, and policy checks.
- For high-risk or infra changes: require human approval label (`needs-review-by-owner`).

10. Conflict handling between Codex and Copilot
- Each agent opens a separate branch/PR with metadata tag (agent id, score).
- Run automated merge conflict detection; if both modify same hunks, create a combined "conflict PR" with both patches and ask Claude/human to arbitrate.
- Optionally run deterministic test-based ranking to auto-choose if confidence/test delta exceeds threshold.

11. Retry & backoff strategy
- Exponential backoff with jitter: retry up to 3 times for transient failures, increase prompt specificity and reduce temperature on retries, escalate after third failure.

12. Strengths vs weaknesses
- Strengths: rapid implementation, small refactors, test generation, code completion, applied patches.
- Weaker: long-range architecture tradeoffs, legal/licensing judgment, deep domain-specific correctness—delegate high-level design/policy to Claude.

13. Deterministic follow-up iterations after CI failures
- Provide failing test logs, failing file paths, previous patch, and specific failing assertions.
- Use deterministic params (seed/temperature=0, fixed prompt template) for iteration; limit to N attempts then escalate to human/Claude.

14. Required task metadata for traceability
- `request_id`, `agent_id`, `commit_sha` (base), `pr_number` (if any), `files_touched`, `elapsed_ms`, `confidence`, `failure_reason`, `retry_count`, `timestamp`.

15. First-week automation proposal — "Auto-fix Lint & Minor Test Flakes"
- Trigger: CI failure where failures are only linter or flaky test categories.
- Flow:
  1. CI posts failure webhook with failure classification to orchestrator.
  2. Codex produces one or more candidate patches for fixes (e.g., linter fixes, flaky test retries).
  3. Copilot checks candidates, applies the most promising patch to a new branch, runs quick local checks (format, lint), and opens a PR with patch + rationale.
  4. Claude reviews PR, runs policy/safety checks and ranks confidence; if passes thresholds Claude may auto-approve for merge or request human review.
  5. CI runs full test suite; on success the PR is merged; on failure iterate once with deterministic params, then escalate.
- Success criteria: >70% of targeted lint/flaky failures auto-fixed and merged without human edit; average time-to-fix < 30 minutes.


---

Notes
- All outputs should include the `task_id` to correlate telemetry across agents and CI.
- If you want these answers in a different format (per-question files or JSON schemas), tell me which and I will generate them.
