# CDSP Codebase Audit and Recommendations

## 1. Overview

The codebase implements the **Canadian Digital Safety Protocol (CDSP)**, focused on providing secure, reliable tech help for seniors. It consists of a Next.js web application and an underlying suite of protocol packages managing safety, guardrails, and workflows.

### Architecture Highlights

- **Monorepo Structure (Turborepo):** Clean segregation between the `apps/web` (Next.js MVP interface) and `packages/*` for business logic (`protocol-engine`, `guardrails`, `flows`). This allows the logic to be reused across web, CLI, or potential mobile applications.
- **Supabase Backend:** Provides data persistence for analysis requests/results, escalation intakes, and raw artifact uploads. Heavy use of Row Level Security (RLS) ensures that sessions can only access their respective data via JWT `session_id` claims.
- **AI Agent Coordination:** The project uses `AgentSync` protocols (`AGENTS.md`, `CLAUDE.md`, `AgentTracker.md`) indicating that development is designed to be highly compatible with AI coding agents operating autonomously.

## 2. Core Business Logic Breakdown

The safety protocol is primarily enforced through deterministic rules which dictate risk scores and escalation logic:

- **`protocol-engine`**: Risk is clamped to `LOW`, `MEDIUM`, or `HIGH`. Contains explicit algorithms (with weighted keywords) to flag domain mismatch, urgency, or impersonation.
- **Floor Policies**: Critical triggers (e.g., entered personal information) force the risk tier to `HIGH` automatically regardless of other semantics.
- **`guardrails`**: Enforces specific compliance rules. Responses cannot use extreme terms like "danger", "critical", or "emergency", and the system is strictly forbidden from claiming a situation is "safe".
- **Database Automations**: Uses `pg_cron` for hourly purging of expired raw artifacts and daily sweeps to track/audit potential PII leaks in escalated queries.

## 3. Recommendations & Opportunities for Improvement

### A. Enhancing Data Privacy and PII Scrubbing

- **Current State:** The database uses a daily `pg_cron` script to verify PII scrubs via a simple regex (`password|sin|social insurance|card number|cvv`).
- **Recommendation:** Implement a robust, dedicated **Data Loss Prevention (DLP)** or NLP-based PII redaction layer _before_ data reaches the database. Using simple regex leaves wide gaps for variations in how seniors might type sensitive data.

### B. Risk Scoring Algorithm Enhancements

- **Current State:** `scoring.ts` uses static regex patterns and hardcoded weights.
- **Recommendation:**
  1. Add **Fuzz Testing** to `scoring.test.ts` to ensure edge cases in semantic patterns do not throw unexpected errors.
  2. Implement an LLM categorization fallback to catch socially engineered text that evades standard static regex.

### C. Database Architecture

- **Current State:** `analysis_results` and `escalation_intakes` use `on delete cascade` referencing `analysis_requests`.
- **Recommendation:** For a compliance and safety tool, **Soft Deletes** (e.g., setting a `deleted_at` timestamp) are generally safer than hard cascade deletes to preserve historical auditability inside `audit_events`.

### D. Observability & Analytics

- **Current State:** Minimal `metrics_daily` rollup table exists.
- **Recommendation:** Integrate an external telemetry provider (like Datadog, Sentry, or PostHog) to monitor pipeline drop-offs (e.g., from `LOW` risk -> escalation) or latency in Next.js API endpoints.

I am ready to implement any of these recommendations if you confirm, or we can discuss other directions!
