#!/usr/bin/env node
/**
 * publish-to-gamma.js
 * Publishes the AgentSync leadership presentation to Gamma via their Generate API.
 *
 * Usage:
 *   node scripts/publish-to-gamma.js
 *
 * Requirements:
 *   Node.js 18+ (uses built-in fetch)
 *   GAMMA_API_KEY env var  OR  edit the API_KEY constant below
 */

const API_KEY = process.env.GAMMA_API_KEY || "sk-gamma-6apCJxR25mBgOkPnFo9r0oN4Px7y21VTV34Ce0UmjQ";
const BASE_URL = "https://public-api.gamma.app/v1.0";

// ── Presentation content ────────────────────────────────────────────────────
// Each block separated by \n---\n becomes one Gamma card.

const PRESENTATION_TEXT = `
# AgentSync: Structured Async Collaboration for AI-Driven Development
How to coordinate multiple AI agents — Claude, Copilot, Codex — on the same codebase without stepping on each other, and reduce rework by **40%**.

**Key stats:**
- 47+ development scripts maintained
- 0 merge conflicts on hot files (last 30 days)
- 40% reduction in rework
- 3–5× more frequent deploys

> "Let me show you how we're solving the multi-agent problem — and why it matters for every team shipping with AI."

---

# The Challenge: Coordinating Multiple AI Agents
Multiple AI agents working on the same codebase creates four compounding problems.

**1 · Context Loss**
Each agent starts fresh. No agent knows what others are doing. Result: repeated work, duplicated efforts, high context-switching cost.

**2 · File Conflicts**
Two agents edit the same file simultaneously. Result: merge conflicts waste time, inconsistent architectural decisions compound.

**3 · Quality Degradation**
No shared understanding of constraints, uncoordinated token budgets, inconsistent code patterns. Result: tech debt accumulates faster than it's cleared.

**4 · Trust Issues**
Leadership loses visibility: "too many cooks," no clear handoff protocol, no audit trail. Result: reluctance to invest in AI tooling.

**Measured Cost (Before AgentSync):**
- 30% of developer time lost to rework and merge-conflict resolution
- 45 minutes average context-switching overhead per session
- 1× deploy frequency — bottlenecked by coordination failures

---

# AgentSync Protocol: Structured Async Collaboration
**Core Principle:** Treat your codebase like a shared workspace with explicit handoff protocols — not a free-for-all. *Structure beats synchronization.*

**Step 1 — Pre-Work Assessment**
- Read \`AgentTracker.md\` — understand what changed, hot files, active work
- Run \`git status\` & \`git pull\` — ensure a clean state
- Run baseline tests — verify nothing is broken before touching code

**Step 2 — Session Start**
- Run *AgentSync: Start Session*
- Declare your goal clearly in AgentTracker
- Set token budget to match task complexity

**Step 3 — Work Execution**
- Feature branch naming: \`[agent-name]/[feature]\`
- Keep edits small in hot files — minimize merge risk
- Document partial work in AgentTracker.md immediately

**Step 4 — Health Checks**
- Run build & tests before every handoff
- Verify no regressions introduced
- Document blockers so the next agent learns

**Step 5 — Handoff**
- Run *AgentSync: End Session*
- Commit with a descriptive message
- Update AgentTracker.md with suggested next work & constraints

**Why This Works:**
- Explicit handoffs reduce context switching from **45 min → 5 min**
- Hot file tracking prevents merge conflicts entirely
- Token budgets match task complexity
- Health checks catch issues before they compound

---

# The Decision Framework: Matching Tool to Task

**Model Selection by Task Complexity**

| Task Type | Recommended Model | Tier |
|---|---|---|
| Routine edits, syntax fixes, boilerplate | Claude Haiku 4.5 | Fast · Cheap |
| Feature implementation, bug fixes, testing | Claude Sonnet 4.6 | Balanced |
| Architecture, multi-file refactor, security | Claude Opus 4.6 | Most Capable |

**Risk Assessment — When to Ask Permission**

| Action | Decision |
|---|---|
| Local edit / local tests (reversible) | ✅ Proceed |
| Branch creation / shared config changes | ⚠️ Coordinate |
| Force push / production changes / destructive ops | ❌ Ask first |

**Token Budget by Task Complexity**
- ⭐ Simple · 500–2K tokens — single function edit, unit tests, code review
- ⭐⭐ Medium · 2K–8K tokens — component implementation, integration tests
- ⭐⭐⭐ Complex · 8K–20K tokens — multi-file refactor, architecture design
- ⭐⭐⭐⭐ Expert · 20K+ tokens — protocol design, system redesign

**Context Efficiency Rules:**
- Set \`max_tokens\` to match expected output size — not as a safety net
- Batch similar small tasks into single requests
- Use prompt caching for static content
- Record failed approaches so the next agent learns

---

# Measured Impact: How AgentSync Improves Delivery

**Deployment Metrics**
- Deploy Frequency: **3–5× / week** (was 1×)
- Mean Time to Recovery: **15 min** (was 45)
- Release Stability: **99.2%** (was 94%)
- Hot File Conflicts: **0 in last 30 days**

**Developer Productivity**
- Context Switching Time: **5 min** (was 45)
- Rework Percentage: **8%** (was 30%)
- Feature Velocity: **+40% stories / sprint**
- Code Review Time: **3 hrs** (was 8)

**Codebase Health**
- Test Coverage: 82%
- Build Success Rate: 99.1%
- Critical Security Issues: 0
- Contentious Merges: 0

**ROI Summary**
- 30 hrs saved on merge conflict resolution / mo
- 20 hrs saved on duplicate work / mo
- 15 hrs saved on context switching / mo
- **~$50K estimated monthly value recovered**

---

# Getting Started: Implement AgentSync in Your Team

**Phase 1 — Foundation (Week 1–2) · ~4 hours setup**
- Set up AgentTracker.md template
- Configure .agentsync.json (build/test commands)
- Document your Hot Files (critical paths)
- Brief team on the 5-part protocol

**Phase 2 — Pilot (Week 3–4) · Minutes per session**
- Run "AgentSync: Start Session" for all new work
- Track handoffs in AgentTracker.md
- Measure baseline rework % and conflicts
- Team checkpoint: friction & wins

**Phase 3 — Optimization (Week 5–8) · ~2 hrs + feedback loop**
- Refine token budget guidelines from real data
- Add model selection framework to runbooks
- Implement health check commands
- Weekly retros on coordination

**Phase 4 — Scaling (Week 9+) · ~8 hrs + ongoing ops**
- Roll out to all teams
- Create org-level agent catalog
- Set up AgentSync dashboards (GitHub + Notion)
- Measure org-level improvements

**Investment vs. Return**
- ⏱️ Setup: 4 hours
- ⏱️ Per session: ~5 minutes
- 💰 Monthly payoff: 2 dev-weeks recovered
- 📈 Scale: Works with 2 agents or 200+

**To Start Today:** Create \`AgentTracker.md\`, add \`.agentsync.json\`, brief your team, run "AgentSync: Start Session" on your next task.
`.trim();

// ── Helpers ─────────────────────────────────────────────────────────────────

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-API-KEY": API_KEY },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GET ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "X-API-KEY": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔑  Verifying API key…");
  let themes;
  try {
    themes = await apiGet("/themes");
  } catch (err) {
    console.error("❌  Could not reach Gamma API:", err.message);
    process.exit(1);
  }

  // Pick first available theme (or fall back to no themeId)
  const themeId = themes?.data?.[0]?.id ?? themes?.[0]?.id ?? null;
  console.log(`✅  Connected. Theme selected: ${themeId ?? "(default)"}`);

  console.log("📤  Generating presentation (6 cards)…");
  const payload = {
    format: "presentation",
    inputText: PRESENTATION_TEXT,
    cardSplit: "inputTextBreaks",
    numCards: 6,
    textOptions: { amount: "detailed" },
    ...(themeId && { themeId }),
  };

  let result;
  try {
    result = await apiPost("/generations", payload);
  } catch (err) {
    console.error("❌  Generation failed:", err.message);
    process.exit(1);
  }

  const url = result?.url ?? result?.gamma?.url ?? result?.data?.url;
  const id  = result?.id  ?? result?.gamma?.id  ?? result?.data?.id;

  console.log("\n🎉  Done!");
  if (url) {
    console.log(`🔗  View your presentation: ${url}`);
  }
  if (id) {
    console.log(`   Gamma ID: ${id}`);
  }
  if (!url && !id) {
    console.log("   Full response:", JSON.stringify(result, null, 2));
  }
}

main();
