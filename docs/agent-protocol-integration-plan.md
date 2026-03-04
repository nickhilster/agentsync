# Agent Protocol Standards Integration Plan

**Source:** Agent Protocol Master Standards for Token Optimization and Context Engineering
**Date:** 2026-03-01
**Status:** Phase 1 Complete

## Overview

This plan maps the Agent Protocol Master Standards document against the AgentSync extension (v0.3.5) and identifies concrete edits to integrate its behaviors.

---

## Edit Tracker

| # | Feature | Effort | Priority | Status |
|---|---------|--------|----------|--------|
| 1 | Model tier config in `.agentsync.json` | Low | Medium | Done |
| 2 | Model tier + justification fields in handoff schema | Medium | High | Done |
| 3 | Model recommendation badge in dashboard | Low | Medium | Done |
| 4 | Model tier in handoff prompt lines | Low | Medium | Done |
| 5 | Token budget advisory config | Low | Low | Done |
| 6 | Token budget guidance in templates | Low | High | Done |
| 7 | Retry/backoff guidance in handoff prompts | Low | Low | Done (via templates) |
| 8 | Context Capsule generator command | Medium | High | Future — requires tree-sitter integration |
| 9 | Context management hints in handoff prompts | Low | Low | Done |
| 10 | `contextHints` field in handoff schema | Medium | High | Done |
| 11 | Stale Observation detection on hot files | Medium | Medium | Done |
| 12 | "Failed Approaches" section in tracker template | Low | High | Done |
| 13 | Signature change detection in endSession | Medium | Medium | Done |
| 14 | `agentsync.contextStatus` command | Low | High | Done |
| 15 | Session cost/metrics tracking in state.json | Medium | Low | Done |
| 16 | Budget/duration warning in dashboard | Medium | Low | Done |

## Files Modified

- `templates/CLAUDE.md` — Added token budget guidance, model selection guidance
- `templates/AGENTS.md` — Added token budget guidance, model selection guidance
- `templates/copilot-instructions.md` — Added token budget guidance
- `templates/AgentTracker.md` — Added "Failed Approaches" section
- `templates/agentsync.json` — Added `modelTiers` and `tokenBudget` config sections
- `schemas/handoffs.schema.json` — Added `recommended_model_tier`, `model_justification`, `context_hints`, `stale_observation`
- `extension.js` — Added contextStatus command, model tier in handoff prompt lines, model badge in dashboard cards, session duration warning, config parsing for new fields.
- `extension.js` — Added stale observation detection, signature change detection, and session metrics tracking.
- `package.json` — Registered `agentsync.contextStatus` command

## Remaining Work (Future)

- **#8 Context Capsule generator** — Requires tree-sitter or lightweight parser integration to produce AST-based dependency graphs

## Implementation Order

1. **Quick wins (template/schema):** #6, #12 — Done
2. **Schema + handoff enrichment:** #2, #10 — Done
3. **New command:** #14 — Done
4. **Handoff prompt enrichment:** #4, #7, #9 — Done
5. **Config additions:** #1, #5 — Done
6. **Dashboard integration:** #3, #11, #16 — Done
7. **Advanced:** #8 (Context Capsule), #13 (signature detection), #15 (metrics) — Done
