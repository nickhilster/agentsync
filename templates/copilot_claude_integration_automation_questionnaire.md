# Copilot + Claude Integration & Automation Questionnaire

Purpose
- Collect concrete integration details so Codex, GitHub Copilot, and Claude can run a reliable shared automation workflow.
- Ask these questions separately to Copilot and Claude and keep their answers verbatim.

Response format requested from each agent
- Answer in numbered order.
- Include concrete technical details when possible: APIs, events, payloads, auth, limits, retries, and examples.
- If something is not supported, say so directly and propose the closest workable alternative.

---

## Questions for GitHub Copilot

1. What are the best programmatic entry points for automating your behavior today (GitHub APIs, Copilot coding agent features, PR comments, Actions triggers, VS Code command hooks)?
2. Which GitHub events should trigger Copilot in a 3-agent workflow (issue opened, label added, PR opened, review requested, CI failure, comment mention), and which should not?
3. What exact invocation pattern do you recommend for reliability: direct API call, `@mention` in PR/issue, GitHub Action step, or MCP/tool bridge?
4. What minimum input contract do you need to generate useful code changes (task goal, files, constraints, tests, acceptance criteria)?
5. What output contract can we depend on from you for automation parsing (patch/diff, rationale, changed files list, test suggestions, risk flags)?
6. How should we structure prompts so your outputs stay consistent and machine-parseable across many runs?
7. What are your practical limits (context size, repo size, runtime, concurrency, rate limits), and how should the orchestrator adapt to those limits?
8. What authentication model and token scopes are required for secure automation in GitHub repos?
9. What guardrails should we enforce before accepting Copilot-generated changes (required tests, lint, policy checks, secret scans)?
10. How do you prefer conflicts to be handled when Codex and Copilot propose different patches to the same files?
11. What retry and backoff strategy should be used when Copilot responses are partial, low confidence, or fail?
12. Which workflow steps are you strongest at versus weakest at in this trio (implementation, test generation, review comments, summarization, refactor)?
13. How should we request follow-up iterations from you after CI failures so the loop stays deterministic?
14. What metadata should every Copilot task log for traceability (request id, commit SHA, files touched, elapsed time, failure reason)?
15. Propose one first-week automation using Copilot + Codex + Claude, with trigger, step-by-step flow, and measurable success criteria.

---

## Questions for Claude

1. What is the best role for you in a 3-agent system: planner, policy/safety reviewer, conflict arbiter, summarizer, or workflow orchestrator?
2. What programmatic interfaces should we use to integrate you into automation (Anthropic API patterns, tool-calling format, expected message schema)?
3. Which events should trigger Claude to step in (new spec, ambiguous task, failed CI retries, conflicting patches, merge decision point)?
4. What minimum structured context do you need to make high-quality decisions (goal, candidate diffs, test results, risk level, deadlines)?
5. What output schema should we require from Claude so downstream automation can parse decisions (decision, confidence, rationale, next action, owner)?
6. How should Claude evaluate and rank competing proposals from Codex and Copilot in a deterministic way?
7. Which policy and safety checks should Claude always run before merge recommendations (security, licensing, compliance, data handling)?
8. What escalation thresholds should force human approval instead of autonomous continuation?
9. How should Claude coordinate iterative fix loops after failing tests: who gets the next task, with what context, and when to stop?
10. What retry strategy and timeout policy do you recommend for Claude-in-the-loop orchestration steps?
11. What are your practical limits (context length, throughput, latency sensitivity), and how should workflows be partitioned because of them?
12. What audit log fields should always be captured from Claude decisions for later review and compliance?
13. How should confidential or regulated content be redacted or transformed before being sent to Claude?
14. What is the best way for Claude to return concise human-facing status updates while still giving machine-usable structured output?
15. Propose one first-week automation using Claude + Codex + Copilot, with trigger, step-by-step flow, and measurable success criteria.

---

## Alignment Questions to Ask Both (same wording)

1. Define the exact handoff object schema you want agents to exchange (required fields, optional fields, example JSON).
2. Define explicit state transitions for a task: `queued -> in_progress -> blocked -> ready_for_review -> approved -> merged`.
3. Define what "done" means for automated code changes in this team (tests, docs, risk review, rollback plan).
4. Define your preferred conflict-resolution protocol when two agents disagree and CI is still green.
5. Identify the top 3 integration mistakes likely to break this multi-agent setup and how to prevent each one.
