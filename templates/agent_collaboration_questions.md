# Agent Collaboration & Automation Questionnaire

Instructions for respondent
- Please answer the questions concisely and include specific integration details (endpoints, payloads, triggers, auth, webhooks, and examples) where relevant.
- If a question is not applicable, explain why and propose an alternative.

---

## Questions for Codex (developer-focused, code & tooling integration)

### Integration & APIs
- What APIs or programmatic interfaces do you expose for other agents to invoke code generation or transformation tasks? Provide endpoints, auth, and expected request/response schemas.
- What input formats (file types, JSON shapes, prompt structures) do you prefer for reliable programmatic use?
- How do you accept and return structured metadata (e.g., filename, repo, branch, line ranges, language, test command)?
- Do you support streaming responses or partial results for long code generations? If so, how should consumers consume and resume streams?

### Automation & Triggers
- Which repository events (file change, PR open, comment, CI failure, scheduled cron) should trigger you to act, and how should those events be delivered (webhook body, poll API, file diff)?
- Can you operate as a synchronous API call within CI (blocking) and/or as an asynchronous job (non-blocking with callback/webhook)? Describe both modes and recommended timeouts.
- What retry/backoff semantics do you recommend for transient failures when orchestrating automations?

### Handoff & Ownership
- When work needs handoff between agents, what minimal context and artifacts do you need to accept/produce (code patch + tests + test results + rationale)?
- How do you mark or annotate generated code to indicate ownership, authoring context, and safe-to-merge status?
- How should conflicts between agent suggestions be represented so a human or another agent can resolve them programmatically?

### CI/CD & Repo Workflows
- What CI steps do you expect to run after you generate or modify code (formatters, linters, unit tests)? Provide recommended commands and thresholds.
- Can you produce deterministic, repeatable outputs given the same inputs and seed? If not, how should callers pin behavior (model params, temperature, prompt templates)?
- Do you support producing patch objects (git diff/patch) and automated commits? If so, what metadata should accompany commits (signature, agent-id, ticket link)?

### Observability & Debugging
- What logs and structured telemetry do you emit for each operation (request id, duration, tokens, errors)? How should other agents collect/attach them to a job or PR?
- What debug artifacts (intermediate ASTs, test failures, stack traces) can you provide to help downstream automation diagnose problems?

### Security, Data & Limits
- What authentication and authorization model do you require for programmatic calls? Any recommended token scopes or ephemeral keys?
- How do you handle secrets and sensitive data in prompts or payloads? Do you provide redaction or vault integration guidance?
- What are your rate limits, payload size limits, and cost considerations callers should be aware of?

### Preferences & Conventions
- What prompt templates, coding style conventions, or repository config files (e.g., .editorconfig, linters) do you prefer to ensure consistent outputs?
- Which languages, frameworks, or test frameworks do you support best, and where do you need additional guardrails?

### Failure Modes & Recovery
- Describe common failure modes when automating code generation and the recommended automated remediation steps.
- When an automated change fails tests or security checks, what rollback or quarantine workflow do you recommend?

---

## Questions for Claude (high-level coordination, summaries & policy)

### Role & Responsibilities
- How do you see your primary role in a three-agent collaboration (strategy/planning, summarization, policy & safety, human-facing liaison)?
- Which responsibilities do you prefer to retain versus delegate to Codex/Copilot for automation tasks?

### Integration & Communication
- How should agents exchange context with you for decision-making (full conversation transcript, summarized state, structured JSON)?
- What formats do you prefer for receiving diffs, PR descriptions, test outputs, and policy checks so you can produce concise guidance or approvals?
- Do you provide APIs or endpoints for programmatic queries (summaries, policy evaluations, suggested next steps)? If so, specify contract shapes and auth.

### Automation & Orchestration
- Can you orchestrate multi-step workflows across agents (e.g., plan -> generate -> test -> summarize -> merge)? If yes, how should workflow definitions be represented (YAML, JSON, DSL)?
- What event types or signals should prompt you to re-evaluate an open workflow (new test failure, updated spec, human comment)?
- How do you prefer to surface recommended automations to humans (PR comments, issues, dashboards)?

### Safety, Policy & Guardrails
- What safety or policy checks should you run on generated code (license detection, PII scanning, insecure patterns)? Provide concrete checks and thresholds.
- How should you express uncertain or risky recommendations and require human approval before merge?
- What audit trail do you need to keep for decisions and why (compliance, reproducibility)?

### Handoff, Prioritization & Conflict Resolution
- When two agents disagree on approach, how do you prefer to arbitrate (scoring rubric, tests, human vote)? Provide a recommended deterministic process.
- How should you prioritize tasks across the system (urgent security fixes vs. feature PRs vs. refactors)?

### Observability & Human Interaction
- What summaries and actionables do you produce for humans (concise executive summary, detailed rationale, code pointers)? Give preferred length/format.
- How should notifications, escalations, and approvals be routed (Slack, email, PR review) and what metadata must accompany them?

### Learning & Feedback Loops
- How should behavioral feedback (human edits, reverts, approvals) be communicated back to Codex/Copilot to improve future automation?
- Do you support storing and retrieving past decisions or conversation memory to inform future coordination? If so, what data model do you expose?

### Limits & Edge Cases
- What are your limitations in reasoning about complex code changes, and when should the system fall back to human-led design?
- How should confidential or regulated content be handled differently when you participate in a workflow?

---

## Shared / Cross-cutting Questions (Answer once, and indicate any agent-specific differences)
- What minimal handshake or schema should agents use to exchange context and handoff jobs (fields, required metadata, provenance)?
- How should agents indicate "ready for review" vs "ready to merge" programmatically?
- What standardized artifact formats should be produced and stored with each automated change (patch, tests, CI report, policy report, explanation)?
- Recommend a small, first-day integration: list the concrete webhook events, payload shape, and success criteria for an initial end-to-end automation prototype involving all three agents.

---

Please include example payloads, minimal JSON schemas, and a short integration checklist for each answered section where applicable.
