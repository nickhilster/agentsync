# Agent Protocol Standards Integration Plan

**Source:** Agent Protocol Master Standards for Token Optimization and Context Engineering  
**Date:** 2026-03-01  
**Status:** Phase 2 Complete (Updated 2026-03-06)

## Overview

This document tracks integration of protocol standards into AgentSync and reflects the implementation state in `src/extension.js`, schema files, and templates.

## Edit Tracker

| # | Feature | Effort | Priority | Status |
|---|---------|--------|----------|--------|
| 1 | Model tier config in `.agentsync.json` | Low | Medium | Done |
| 2 | Model tier + justification fields in handoff schema | Medium | High | Done |
| 3 | Model recommendation badge in dashboard | Low | Medium | Done |
| 4 | Model tier in handoff prompt lines | Low | Medium | Done |
| 5 | Token budget advisory config | Low | Low | Done |
| 6 | Token budget guidance in templates | Low | High | Done |
| 7 | Retry/backoff guidance in handoff prompts | Low | Low | Done |
| 8 | Context Capsule generator command | Medium | High | Done (v1 deterministic capsule) |
| 9 | Context management hints in handoff prompts | Low | Low | Done |
| 10 | `contextHints` field in handoff schema | Medium | High | Done |
| 11 | Stale observation detection on hot files | Medium | Medium | Done |
| 12 | Failed approaches section in tracker template | Low | High | Done |
| 13 | Signature change detection in endSession | Medium | Medium | Done |
| 14 | `agentsync.contextStatus` command | Low | High | Done |
| 15 | Session metrics tracking in state.json | Medium | Low | Done |
| 16 | Budget/duration warning in dashboard | Medium | Low | Done |

## Files Modified

- `templates/CLAUDE.md`
- `templates/AGENTS.md`
- `templates/copilot-instructions.md`
- `templates/AgentTracker.md`
- `templates/agentsync.json`
- `schemas/handoffs.schema.json`
- `src/extension.js`
- `package.json`

## Remaining Work (Future)

- Optional v2 upgrade: tree-sitter-backed context capsule enrichment (dependency graph and symbol-level scoping)
- Optional observability extension: richer structured telemetry export for orchestration pipelines

## Implementation Order (Historical)

1. Quick wins (template/schema)
2. Schema + handoff enrichment
3. New command integration
4. Handoff prompt enrichment
5. Config additions
6. Dashboard integration
7. Advanced items (#8 v1, #13, #15)
