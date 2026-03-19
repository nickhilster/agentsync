var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/utils/constants.js
var require_constants = __commonJS({
  "src/utils/constants.js"(exports2, module2) {
    "use strict";
    var PLACEHOLDER2 = "-";
    var EM_DASH = "\u2014";
    var DEFAULT_STALE_HOURS2 = 24;
    var OPEN_HANDOFF_STATUSES2 = /* @__PURE__ */ new Set([
      "queued",
      "in_progress",
      "blocked",
      "ready_for_review",
      "approved"
    ]);
    var DEFAULT_END_SESSION_ZERO_TOUCH2 = Object.freeze({
      enabled: false,
      autonomy: "mostly_full_auto",
      copyPromptToClipboard: true,
      maxSummaryLength: 180
    });
    var DEFAULT_START_SESSION_ZERO_TOUCH2 = Object.freeze({
      enabled: false,
      autoClaimHandoff: false,
      promptPreFill: true
    });
    var DEFAULT_HANDOFF_ROUTING_DEFAULTS = Object.freeze({
      claude: { owner_mode: "single", to_agents: ["codex"], required_capabilities: [] },
      codex: { owner_mode: "single", to_agents: ["claude"], required_capabilities: [] },
      copilot: { owner_mode: "single", to_agents: ["codex"], required_capabilities: [] }
    });
    var EXECUTION_PROVIDER_DEFS2 = Object.freeze([
      { id: "claude", label: "Claude" },
      { id: "codex", label: "Codex" },
      { id: "gemini", label: "Gemini" },
      { id: "copilot", label: "Copilot" }
    ]);
    var EXECUTION_PROVIDER_BY_ID2 = Object.freeze(
      Object.fromEntries(EXECUTION_PROVIDER_DEFS2.map((provider) => [provider.id, provider]))
    );
    var ROLE_LIST2 = [
      "founder_pm",
      "ux_designer",
      "software_developer",
      "non_technical",
      "systems_designer"
    ];
    var AGENT_CATEGORY_COLORS = Object.freeze({
      engineering: "#00d4aa",
      design: "#a855f7",
      marketing: "#3b82f6",
      product: "#22c55e",
      "project-management": "#eab308",
      support: "#14b8a6",
      testing: "#f97316",
      specialized: "#6366f1",
      "spatial-computing": "#06ffd0",
      strategy: "#10b981"
    });
    var DEFAULT_EXECUTION_CHANNELS_CONFIG = Object.freeze({
      preferred: "clipboard",
      fallback: "clipboard"
    });
    var CHAIN_STATUSES = Object.freeze({
      BLOCKED: "blocked",
      QUEUED: "queued",
      IN_PROGRESS: "in_progress",
      COMPLETED: "merged"
    });
    module2.exports = {
      PLACEHOLDER: PLACEHOLDER2,
      EM_DASH,
      DEFAULT_STALE_HOURS: DEFAULT_STALE_HOURS2,
      OPEN_HANDOFF_STATUSES: OPEN_HANDOFF_STATUSES2,
      DEFAULT_END_SESSION_ZERO_TOUCH: DEFAULT_END_SESSION_ZERO_TOUCH2,
      DEFAULT_START_SESSION_ZERO_TOUCH: DEFAULT_START_SESSION_ZERO_TOUCH2,
      DEFAULT_HANDOFF_ROUTING_DEFAULTS,
      EXECUTION_PROVIDER_DEFS: EXECUTION_PROVIDER_DEFS2,
      EXECUTION_PROVIDER_BY_ID: EXECUTION_PROVIDER_BY_ID2,
      ROLE_LIST: ROLE_LIST2,
      AGENT_CATEGORY_COLORS,
      DEFAULT_EXECUTION_CHANNELS_CONFIG,
      CHAIN_STATUSES
    };
  }
});

// src/utils/paths.js
var require_paths = __commonJS({
  "src/utils/paths.js"(exports2, module2) {
    "use strict";
    var path2 = require("path");
    function getTemplatesDir2(context) {
      return path2.join(context.extensionPath, "templates");
    }
    function getTrackerPath2(workspaceFolder) {
      return path2.join(workspaceFolder.uri.fsPath, "AgentTracker.md");
    }
    function getConfigPath2(workspaceFolder) {
      return path2.join(workspaceFolder.uri.fsPath, ".agentsync.json");
    }
    function getAgentSyncDir2(workspaceFolder) {
      return path2.join(workspaceFolder.uri.fsPath, ".agentsync");
    }
    function getStatePath2(workspaceFolder) {
      return path2.join(getAgentSyncDir2(workspaceFolder), "state.json");
    }
    function getRequestPath2(workspaceFolder) {
      return path2.join(getAgentSyncDir2(workspaceFolder), "request.json");
    }
    function getResultPath2(workspaceFolder) {
      return path2.join(getAgentSyncDir2(workspaceFolder), "result.json");
    }
    function getHandoffsPath2(workspaceFolder) {
      return path2.join(getAgentSyncDir2(workspaceFolder), "handoffs.json");
    }
    function getContextCapsulePath2(workspaceFolder) {
      return path2.join(getAgentSyncDir2(workspaceFolder), "context-capsule.json");
    }
    module2.exports = {
      getTemplatesDir: getTemplatesDir2,
      getTrackerPath: getTrackerPath2,
      getConfigPath: getConfigPath2,
      getAgentSyncDir: getAgentSyncDir2,
      getStatePath: getStatePath2,
      getRequestPath: getRequestPath2,
      getResultPath: getResultPath2,
      getHandoffsPath: getHandoffsPath2,
      getContextCapsulePath: getContextCapsulePath2
    };
  }
});

// src/utils/text.js
var require_text = __commonJS({
  "src/utils/text.js"(exports2, module2) {
    "use strict";
    var { PLACEHOLDER: PLACEHOLDER2, EM_DASH } = require_constants();
    function isEmptyValue2(value) {
      const normalized = (value || "").trim();
      return normalized.length === 0 || normalized === PLACEHOLDER2 || normalized === EM_DASH;
    }
    function escapeRegExp2(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function parseTracker2(content) {
      const pick = (label) => {
        const match = content.match(new RegExp(`\\*\\*${escapeRegExp2(label)}:\\*\\*\\s*(.+)`));
        return match?.[1]?.trim() ?? PLACEHOLDER2;
      };
      return {
        agent: pick("Agent"),
        date: pick("Date"),
        summary: pick("Summary"),
        branch: pick("Branch"),
        commit: pick("Commit")
      };
    }
    function getSectionBody2(content, heading) {
      const matcher = new RegExp(
        `## ${escapeRegExp2(heading)}\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`,
        "m"
      );
      const match = content.match(matcher);
      return match?.[1]?.trim() ?? "";
    }
    function setSectionBody2(content, heading, body) {
      const normalizedBody = body.trimEnd();
      const matcher = new RegExp(
        `(## ${escapeRegExp2(heading)}\\r?\\n\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |$)`,
        "m"
      );
      if (matcher.test(content)) {
        return content.replace(matcher, `$1${normalizedBody}
`);
      }
      return `${content.trimEnd()}

## ${heading}

${normalizedBody}
`;
    }
    function canonicalAgentId2(value) {
      return String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
    }
    function toSingleLine2(value) {
      return String(value || "").replace(/[\r\n]+/g, " ").trim();
    }
    function truncateSingleLine(value, maxLength) {
      const line = toSingleLine2(value);
      if (maxLength && line.length > maxLength) {
        return line.slice(0, maxLength - 3) + "...";
      }
      return line;
    }
    function formatElapsed2(ms) {
      const totalMinutes = Math.floor(ms / 6e4);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    function getInProgressLines(trackerContent) {
      if (!trackerContent) return [];
      const body = getSectionBody2(trackerContent, "In Progress");
      return body.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && line !== "*Nothing active*" && !line.startsWith("<!--"));
    }
    module2.exports = {
      isEmptyValue: isEmptyValue2,
      escapeRegExp: escapeRegExp2,
      parseTracker: parseTracker2,
      getSectionBody: getSectionBody2,
      setSectionBody: setSectionBody2,
      getInProgressLines,
      canonicalAgentId: canonicalAgentId2,
      toSingleLine: toSingleLine2,
      truncateSingleLine,
      formatElapsed: formatElapsed2
    };
  }
});

// src/utils/io.js
var require_io = __commonJS({
  "src/utils/io.js"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    function atomicWriteFileSync(filePath, content, encoding = "utf8") {
      const tmpPath = `${filePath}.tmp`;
      fs2.writeFileSync(tmpPath, content, encoding);
      fs2.renameSync(tmpPath, filePath);
    }
    function parseISODate2(str) {
      if (!str || typeof str !== "string") return NaN;
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return NaN;
      return Date.parse(str);
    }
    function parseCommandArgv2(cmd) {
      const args = [];
      let current = "";
      let i = 0;
      while (i < cmd.length) {
        const ch = cmd[i];
        if (ch === '"' || ch === "'") {
          const quote = ch;
          i++;
          while (i < cmd.length && cmd[i] !== quote) {
            if (cmd[i] === "\\" && i + 1 < cmd.length) {
              i++;
              current += cmd[i];
            } else {
              current += cmd[i];
            }
            i++;
          }
        } else if (ch === " " || ch === "	") {
          if (current.length > 0) {
            args.push(current);
            current = "";
          }
        } else {
          current += ch;
        }
        i++;
      }
      if (current.length > 0) args.push(current);
      return args;
    }
    function createNonce() {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let text = "";
      for (let i = 0; i < 32; i += 1) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return text;
    }
    module2.exports = {
      atomicWriteFileSync,
      parseISODate: parseISODate2,
      parseCommandArgv: parseCommandArgv2,
      createNonce
    };
  }
});

// src/utils/git.js
var require_git = __commonJS({
  "src/utils/git.js"(exports2, module2) {
    "use strict";
    var cp = require("child_process");
    var HOT_FILES_CACHE_TTL_MS = 4e3;
    var _hotFilesCache = /* @__PURE__ */ new Map();
    function runGit2(workspaceFolder, args) {
      const result = cp.spawnSync("git", args, {
        cwd: workspaceFolder.uri.fsPath,
        encoding: "utf8"
      });
      if (result.error || result.status !== 0) return null;
      return result.stdout.trim();
    }
    function runGitExitCode2(workspaceFolder, args) {
      const result = cp.spawnSync("git", args, {
        cwd: workspaceFolder.uri.fsPath,
        encoding: "utf8"
      });
      if (result.error || typeof result.status !== "number") return 1;
      return result.status;
    }
    function detectHotFiles(workspaceFolder) {
      const collected = /* @__PURE__ */ new Set();
      const addLines = (output) => {
        if (!output) return;
        output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((line) => collected.add(line));
      };
      addLines(runGit2(workspaceFolder, ["diff", "--name-only"]));
      addLines(runGit2(workspaceFolder, ["diff", "--cached", "--name-only"]));
      addLines(runGit2(workspaceFolder, ["ls-files", "--others", "--exclude-standard"]));
      if (collected.size === 0) {
        addLines(runGit2(workspaceFolder, ["show", "--pretty=format:", "--name-only", "HEAD"]));
      }
      return [...collected].sort((a, b) => a.localeCompare(b));
    }
    function getHotFilesCached2(workspaceFolder, options = {}) {
      const { force = false } = options;
      const key = workspaceFolder.uri.fsPath;
      const cached = _hotFilesCache.get(key);
      const now = Date.now();
      if (!force && cached && now - cached.fetchedAt <= HOT_FILES_CACHE_TTL_MS && Array.isArray(cached.files)) {
        return cached.files;
      }
      const files = detectHotFiles(workspaceFolder);
      _hotFilesCache.set(key, { files, fetchedAt: now });
      return files;
    }
    function normalizeRepoRelativePath2(filePath) {
      return String(filePath || "").trim().replace(/\\/g, "/").replace(/^\.\//, "");
    }
    function parseDiffHeaderPath(rawPath) {
      let value = String(rawPath || "").trim();
      if (!value || value === "/dev/null") return "";
      value = value.replace(/^"|"$/g, "");
      if (value.startsWith("a/") || value.startsWith("b/")) {
        value = value.slice(2);
      }
      return normalizeRepoRelativePath2(value);
    }
    function scoreNextTaskCapabilities2(hotFiles, signatureChanges, metrics = {}, priorAttempts = 0) {
      const caps = [];
      let tier = "worker";
      if (priorAttempts >= 2) {
        tier = "lead";
        caps.push("repeat-fix");
      }
      if (signatureChanges && signatureChanges.length > 0) {
        tier = "lead";
        caps.push("interface/signature change");
      }
      if (hotFiles && hotFiles.length > 8) {
        tier = "lead";
        caps.push("multi-file refactor");
      }
      if (metrics.filesModified && metrics.filesModified > 15) {
        tier = "lead";
        caps.push("heavy edit");
      }
      if (hotFiles && hotFiles.length > 0) {
        const extensions = new Set(
          hotFiles.map((file) => {
            const dot = file.lastIndexOf(".");
            return dot >= 0 ? file.slice(dot).toLowerCase() : "";
          }).filter(Boolean)
        );
        const testFiles = hotFiles.filter(
          (file) => /\.(test|spec|e2e)\./i.test(file) || /\/__tests__\//i.test(file) || /\/test\//i.test(file)
        );
        if (testFiles.length > 0) caps.push("testing");
        if (extensions.has(".css") || extensions.has(".scss") || extensions.has(".figma")) {
          caps.push("design");
        }
        if (extensions.has(".md") || extensions.has(".txt") || extensions.has(".rst")) {
          caps.push("documentation");
        }
        if (extensions.has(".yml") || extensions.has(".yaml") || extensions.has(".dockerfile") || hotFiles.some((file) => file.includes("Dockerfile") || file.includes(".github/workflows"))) {
          caps.push("automation");
        }
      }
      const reason = caps.length ? "Detected " + caps.join(", ") : "Routine change";
      return { tier, capabilities: caps, reason };
    }
    function detectSignatureChanges(workspaceFolder, hotFiles) {
      if (!hotFiles || hotFiles.length === 0) return [];
      const normalizedHotFiles = hotFiles.map((file) => normalizeRepoRelativePath2(file)).filter((file) => file.length > 0);
      if (normalizedHotFiles.length === 0) return [];
      const diff = runGit2(workspaceFolder, [
        "diff",
        "HEAD~1",
        "--unified=0",
        "--",
        ...normalizedHotFiles
      ]);
      if (!diff) return [];
      const changes = [];
      let currentFile = "";
      const signatureRegex = /(?:\basync\s+function\b|\bfunction\b|=>|\bdef\b|\bclass\b|:\s*\()/;
      for (const line of diff.split(/\r?\n/)) {
        if (line.startsWith("+++ ") || line.startsWith("--- ")) {
          const headerPath = parseDiffHeaderPath(line.slice(4));
          if (headerPath) currentFile = headerPath;
          continue;
        }
        if (line.startsWith("@@")) continue;
        if (changes.length >= 10) break;
        const marker = line[0];
        if (marker !== "+" && marker !== "-" || line.startsWith("+++") || line.startsWith("---")) {
          continue;
        }
        const content = line.slice(1).trim();
        if (!content) continue;
        if (signatureRegex.test(content)) {
          changes.push({
            file: currentFile || "unknown",
            change: line
          });
        }
      }
      return changes;
    }
    module2.exports = {
      runGit: runGit2,
      runGitExitCode: runGitExitCode2,
      detectHotFiles,
      getHotFilesCached: getHotFilesCached2,
      normalizeRepoRelativePath: normalizeRepoRelativePath2,
      parseDiffHeaderPath,
      scoreNextTaskCapabilities: scoreNextTaskCapabilities2,
      detectSignatureChanges
    };
  }
});

// src/utils/workspace.js
var require_workspace = __commonJS({
  "src/utils/workspace.js"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    var { workspace, window } = require("vscode");
    var { getConfigPath: getConfigPath2 } = require_paths();
    var {
      canonicalAgentId: canonicalAgentId2,
      DEFAULT_STALE_HOURS: DEFAULT_STALE_HOURS2,
      DEFAULT_END_SESSION_ZERO_TOUCH: DEFAULT_END_SESSION_ZERO_TOUCH2,
      DEFAULT_HANDOFF_ROUTING_DEFAULTS,
      DEFAULT_EXECUTION_CHANNELS_CONFIG
    } = require_constants();
    var { atomicWriteFileSync } = require_io();
    function getActiveWorkspaceFolder2() {
      const activeUri = window.activeTextEditor?.document?.uri;
      if (activeUri) {
        const activeFolder = workspace.getWorkspaceFolder(activeUri);
        if (activeFolder) return activeFolder;
      }
      return workspace.workspaceFolders?.[0] ?? null;
    }
    async function resolveWorkspaceFolder2(options = {}) {
      const { allowPick = true } = options;
      const folders = workspace.workspaceFolders;
      if (!folders || folders.length === 0) return null;
      const activeFolder = getActiveWorkspaceFolder2();
      if (activeFolder) return activeFolder;
      if (folders.length === 1 || !allowPick) {
        return folders[0];
      }
      const picks = folders.map((folder) => ({
        label: folder.name,
        description: folder.uri.fsPath,
        folder
      }));
      const selected = await window.showQuickPick(picks, {
        placeHolder: "Select a workspace folder for AgentSync"
      });
      return selected?.folder ?? null;
    }
    function getWorkspaceLabelPrefix2(workspaceFolder) {
      const folders = workspace.workspaceFolders;
      if (!folders || folders.length <= 1) return "";
      return `[${workspaceFolder.name}] `;
    }
    function readAgentSyncConfig2(workspaceFolder) {
      const settings = workspace.getConfiguration("agentsync", workspaceFolder?.uri);
      const settingsAutoStale = Number(settings.get("autoStaleSessionMinutes", 0));
      const toNumber = (value, fallback) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };
      const normalizeStartSessionAutomation = (value = {}) => ({
        enabled: value.enabled === true,
        autoClaimHandoff: value.autoClaimHandoff === true,
        promptPreFill: value.promptPreFill === void 0 ? true : value.promptPreFill === true
      });
      const normalizeEndSessionAutomation = (value = {}) => {
        const maxSummaryLength = Math.max(
          60,
          Math.min(
            260,
            Math.round(
              toNumber(value.maxSummaryLength, DEFAULT_END_SESSION_ZERO_TOUCH2.maxSummaryLength)
            )
          )
        );
        return {
          enabled: value.enabled === true,
          autonomy: String(value.autonomy || DEFAULT_END_SESSION_ZERO_TOUCH2.autonomy).trim() || DEFAULT_END_SESSION_ZERO_TOUCH2.autonomy,
          copyPromptToClipboard: value.copyPromptToClipboard === void 0 ? DEFAULT_END_SESSION_ZERO_TOUCH2.copyPromptToClipboard : value.copyPromptToClipboard === true,
          maxSummaryLength
        };
      };
      const normalizeRoute = (route = {}) => {
        const ownerMode = String(route.owner_mode || "").toLowerCase();
        const toAgents = Array.isArray(route.to_agents) ? route.to_agents.map((agent) => canonicalAgentId2(agent)).filter(Boolean) : [];
        const requiredCapabilities = Array.isArray(route.required_capabilities) ? route.required_capabilities.map((cap) => String(cap || "").trim()).filter(Boolean) : [];
        if (ownerMode === "single" && toAgents.length === 1) {
          return { owner_mode: ownerMode, to_agents: toAgents, required_capabilities: [] };
        }
        if (ownerMode === "shared" && toAgents.length === 2) {
          return { owner_mode: ownerMode, to_agents: toAgents, required_capabilities: [] };
        }
        if (ownerMode === "auto" && requiredCapabilities.length > 0) {
          return { owner_mode: ownerMode, to_agents: [], required_capabilities: requiredCapabilities };
        }
        return null;
      };
      const defaultRoutes = Object.fromEntries(
        Object.entries(DEFAULT_HANDOFF_ROUTING_DEFAULTS).map(([agentId, route]) => [
          agentId,
          { ...route }
        ])
      );
      const normalizeAutomation = (automation = {}) => {
        const endSessionZeroTouch = normalizeEndSessionAutomation(automation.endSessionZeroTouch || {});
        const startSessionZeroTouch = normalizeStartSessionAutomation(
          automation.startSessionZeroTouch || {}
        );
        const configured = automation.handoffRoutingDefaults || {};
        const handoffRoutingDefaults = { ...defaultRoutes };
        if (configured && typeof configured === "object") {
          for (const [rawAgentId, route] of Object.entries(configured)) {
            const agentId = canonicalAgentId2(rawAgentId);
            if (!agentId) continue;
            const normalizedRoute = normalizeRoute(route);
            if (normalizedRoute) handoffRoutingDefaults[agentId] = normalizedRoute;
          }
        }
        return { endSessionZeroTouch, startSessionZeroTouch, handoffRoutingDefaults };
      };
      const DEFAULT_TOKEN_BUDGET = Object.freeze({
        maxTokensDefault: 4e3,
        batchSimilarTasks: true,
        enableCaching: true,
        sessionDurationWarningMinutes: 0
      });
      const normalizeTokenBudget = (value = {}) => ({
        maxTokensDefault: toNumber(value.maxTokensDefault, DEFAULT_TOKEN_BUDGET.maxTokensDefault),
        batchSimilarTasks: value.batchSimilarTasks === void 0 ? true : value.batchSimilarTasks === true,
        enableCaching: value.enableCaching === void 0 ? true : value.enableCaching === true,
        sessionDurationWarningMinutes: Math.max(
          0,
          Math.round(
            toNumber(
              value.sessionDurationWarningMinutes,
              DEFAULT_TOKEN_BUDGET.sessionDurationWarningMinutes
            )
          )
        )
      });
      const normalizeModelTiers = (value = {}) => {
        const result = {};
        for (const [tier, def] of Object.entries(value)) {
          if (tier !== "worker" && tier !== "lead") continue;
          result[tier] = {
            models: Array.isArray(def?.models) ? def.models.map((model) => String(model).trim()).filter(Boolean) : [],
            useCases: Array.isArray(def?.useCases) ? def.useCases.map((useCase) => String(useCase).trim()).filter(Boolean) : []
          };
        }
        return Object.keys(result).length > 0 ? result : null;
      };
      const defaults = {
        staleAfterHours: DEFAULT_STALE_HOURS2,
        autoStaleSessionMinutes: Number.isFinite(settingsAutoStale) && settingsAutoStale >= 0 ? settingsAutoStale : 0,
        commands: {},
        requireHandoffOnEndSession: false,
        automation: normalizeAutomation({}),
        modelTiers: null,
        tokenBudget: normalizeTokenBudget({}),
        userProfile: null,
        dashboardShortcuts: null,
        sessionDurationWarningMinutes: 0,
        executionChannels: { ...DEFAULT_EXECUTION_CHANNELS_CONFIG },
        agentCatalog: null
      };
      const configPath = getConfigPath2(workspaceFolder);
      if (!fs2.existsSync(configPath)) return defaults;
      try {
        const raw = fs2.readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
        const parsed = JSON.parse(raw);
        const staleAfterHours = Number(parsed.staleAfterHours);
        const autoStaleSessionMinutes = Number(parsed.autoStaleSessionMinutes);
        return {
          staleAfterHours: Number.isFinite(staleAfterHours) && staleAfterHours >= 0 ? staleAfterHours : DEFAULT_STALE_HOURS2,
          autoStaleSessionMinutes: Number.isFinite(autoStaleSessionMinutes) && autoStaleSessionMinutes >= 0 ? autoStaleSessionMinutes : 0,
          commands: parsed.commands && typeof parsed.commands === "object" ? parsed.commands : {},
          requireHandoffOnEndSession: parsed.requireHandoffOnEndSession === true,
          automation: normalizeAutomation(parsed.automation || {}),
          modelTiers: normalizeModelTiers(parsed.modelTiers || {}),
          tokenBudget: normalizeTokenBudget(parsed.tokenBudget || {}),
          userProfile: parsed.userProfile && typeof parsed.userProfile === "object" ? parsed.userProfile : null,
          dashboardShortcuts: Array.isArray(parsed.dashboardShortcuts) ? parsed.dashboardShortcuts : null,
          sessionDurationWarningMinutes: toNumber(parsed.sessionDurationWarningMinutes, 0),
          executionChannels: parsed.executionChannels && typeof parsed.executionChannels === "object" ? parsed.executionChannels : { ...DEFAULT_EXECUTION_CHANNELS_CONFIG },
          agentCatalog: parsed.agentCatalog && typeof parsed.agentCatalog === "object" ? parsed.agentCatalog : null
        };
      } catch {
        return defaults;
      }
    }
    function writeConfigFile2(workspaceFolder, data) {
      const configPath = getConfigPath2(workspaceFolder);
      atomicWriteFileSync(configPath, JSON.stringify(data, null, 2));
    }
    module2.exports = {
      getActiveWorkspaceFolder: getActiveWorkspaceFolder2,
      resolveWorkspaceFolder: resolveWorkspaceFolder2,
      getWorkspaceLabelPrefix: getWorkspaceLabelPrefix2,
      readAgentSyncConfig: readAgentSyncConfig2,
      writeConfigFile: writeConfigFile2
    };
  }
});

// src/utils/storage.js
var require_storage = __commonJS({
  "src/utils/storage.js"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    var {
      getTrackerPath: getTrackerPath2,
      getStatePath: getStatePath2,
      getHandoffsPath: getHandoffsPath2,
      getAgentSyncDir: getAgentSyncDir2
    } = require_paths();
    var { atomicWriteFileSync } = require_io();
    function readTracker2(workspaceFolder) {
      try {
        return fs2.readFileSync(getTrackerPath2(workspaceFolder), "utf8");
      } catch {
        return null;
      }
    }
    function writeTracker(workspaceFolder, content) {
      atomicWriteFileSync(getTrackerPath2(workspaceFolder), content);
    }
    function readStateFile2(workspaceFolder) {
      const statePath = getStatePath2(workspaceFolder);
      if (!fs2.existsSync(statePath)) return null;
      try {
        return JSON.parse(fs2.readFileSync(statePath, "utf8"));
      } catch {
        return null;
      }
    }
    function writeStateFile2(workspaceFolder, data) {
      try {
        fs2.mkdirSync(getAgentSyncDir2(workspaceFolder), { recursive: true });
        const statePath = getStatePath2(workspaceFolder);
        atomicWriteFileSync(statePath, JSON.stringify(data, null, 2));
      } catch (err) {
        console.error("[AgentSync] writeStateFile error:", err);
      }
    }
    function readHandoffs2(workspaceFolder) {
      const handoffsPath = getHandoffsPath2(workspaceFolder);
      if (!fs2.existsSync(handoffsPath)) {
        return { exists: false, handoffs: [], error: null };
      }
      try {
        const raw = fs2.readFileSync(handoffsPath, "utf8").replace(/^\uFEFF/, "");
        const parsed = JSON.parse(raw);
        const handoffs = Array.isArray(parsed?.handoffs) ? parsed.handoffs : [];
        return { exists: true, handoffs, error: null };
      } catch (err) {
        return {
          exists: true,
          handoffs: [],
          error: err && err.message ? err.message : "Invalid JSON"
        };
      }
    }
    function writeHandoffs2(workspaceFolder, data) {
      try {
        fs2.mkdirSync(getAgentSyncDir2(workspaceFolder), { recursive: true });
        const handoffsPath = getHandoffsPath2(workspaceFolder);
        atomicWriteFileSync(handoffsPath, JSON.stringify(data, null, 2));
      } catch (err) {
        console.error("[AgentSync] writeHandoffs error:", err);
      }
    }
    module2.exports = {
      readTracker: readTracker2,
      writeTracker,
      readStateFile: readStateFile2,
      writeStateFile: writeStateFile2,
      readHandoffs: readHandoffs2,
      writeHandoffs: writeHandoffs2
    };
  }
});

// src/utils/workspaceSnapshot.js
var require_workspaceSnapshot = __commonJS({
  "src/utils/workspaceSnapshot.js"(exports2, module2) {
    "use strict";
    var { PLACEHOLDER: PLACEHOLDER2 } = require_constants();
    var { parseTracker: parseTracker2, getInProgressLines } = require_text();
    var { readTracker: readTracker2, readStateFile: readStateFile2, readHandoffs: readHandoffs2 } = require_storage();
    var { readAgentSyncConfig: readAgentSyncConfig2 } = require_workspace();
    var WorkspaceSnapshotService = class {
      /**
       * @param {{
       *   readTracker: (workspaceFolder: any) => string | null,
       *   parseTracker: (content: string) => any,
       *   readStateFile: (workspaceFolder: any) => any | null,
       *   readConfig: (workspaceFolder: any) => any,
       *   readHandoffs: (workspaceFolder: any) => { exists: boolean, handoffs: any[], error: string | null },
       *   getInProgressLines: (content: string | null) => string[],
       *   placeholder: string
       * }} loaders
       */
      constructor(loaders) {
        this.loaders = loaders;
        this.cache = /* @__PURE__ */ new Map();
      }
      /**
       * @param {any} workspaceFolder
       * @returns {string}
       */
      key(workspaceFolder) {
        return workspaceFolder.uri.fsPath;
      }
      /**
       * @param {any} workspaceFolder
       */
      invalidate(workspaceFolder) {
        if (!workspaceFolder) return;
        const key = this.key(workspaceFolder);
        const existing = this.cache.get(key);
        if (!existing) return;
        existing.dirty = true;
        this.cache.set(key, existing);
      }
      invalidateAll() {
        for (const [key, entry] of this.cache.entries()) {
          entry.dirty = true;
          this.cache.set(key, entry);
        }
      }
      /**
       * @param {any} workspaceFolder
       * @returns {{ version: number, hash: string | null }}
       */
      getMetadata(workspaceFolder) {
        if (!workspaceFolder) return { version: 0, hash: null };
        const entry = this.cache.get(this.key(workspaceFolder));
        if (!entry || !entry.snapshot) return { version: 0, hash: null };
        return { version: entry.version, hash: entry.snapshot.hash || null };
      }
      /**
       * @param {any} workspaceFolder
       * @param {{ force?: boolean }} [options]
       * @returns {any}
       */
      getSnapshot(workspaceFolder, options = {}) {
        const { force = false } = options;
        const key = this.key(workspaceFolder);
        const current = this.cache.get(key);
        if (current && current.snapshot && !current.dirty && !force) {
          return current.snapshot;
        }
        const trackerContent = this.loaders.readTracker(workspaceFolder);
        const placeholder = this.loaders.placeholder;
        const tracker = trackerContent ? this.loaders.parseTracker(trackerContent) : {
          agent: placeholder,
          date: placeholder,
          summary: placeholder,
          branch: placeholder,
          commit: placeholder
        };
        const state = this.loaders.readStateFile(workspaceFolder);
        const config = this.loaders.readConfig(workspaceFolder);
        const handoffInfo = this.loaders.readHandoffs(workspaceFolder);
        const inProgressLines = Array.isArray(state?.inProgress) && state.inProgress.length > 0 ? state.inProgress : this.loaders.getInProgressLines(trackerContent);
        const nextVersion = (current?.version || 0) + 1;
        const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
        const hash = this.computeHash(
          JSON.stringify({
            tracker,
            state,
            config,
            handoffCount: handoffInfo.handoffs.length,
            inProgressCount: inProgressLines.length,
            generatedAt
          })
        );
        const snapshot = {
          trackerContent,
          tracker,
          state,
          config,
          handoffInfo,
          inProgressLines,
          generatedAt,
          version: nextVersion,
          hash
        };
        this.cache.set(key, { snapshot, dirty: false, version: nextVersion });
        return snapshot;
      }
      /**
       * @param {string} value
       * @returns {string}
       */
      computeHash(value) {
        let hash = 0;
        for (let i = 0; i < value.length; i += 1) {
          hash = hash * 31 + value.charCodeAt(i) | 0;
        }
        return Math.abs(hash).toString(16);
      }
    };
    var _workspaceSnapshotService = null;
    function getWorkspaceSnapshotService() {
      if (_workspaceSnapshotService) return _workspaceSnapshotService;
      _workspaceSnapshotService = new WorkspaceSnapshotService({
        readTracker: readTracker2,
        parseTracker: parseTracker2,
        readStateFile: readStateFile2,
        readConfig: readAgentSyncConfig2,
        readHandoffs: readHandoffs2,
        getInProgressLines,
        placeholder: PLACEHOLDER2
      });
      return _workspaceSnapshotService;
    }
    function getWorkspaceSnapshot2(workspaceFolder, options = {}) {
      return getWorkspaceSnapshotService().getSnapshot(workspaceFolder, options);
    }
    function invalidateWorkspaceCaches2(workspaceFolder) {
      if (!workspaceFolder) {
        getWorkspaceSnapshotService().invalidateAll();
        return;
      }
      getWorkspaceSnapshotService().invalidate(workspaceFolder);
    }
    module2.exports = {
      WorkspaceSnapshotService,
      getWorkspaceSnapshotService,
      getWorkspaceSnapshot: getWorkspaceSnapshot2,
      invalidateWorkspaceCaches: invalidateWorkspaceCaches2
    };
  }
});

// src/utils/trackerWarnings.js
var require_trackerWarnings = __commonJS({
  "src/utils/trackerWarnings.js"(exports2, module2) {
    "use strict";
    var { isEmptyValue: isEmptyValue2 } = require_text();
    var { runGit: runGit2, runGitExitCode: runGitExitCode2 } = require_git();
    var { readAgentSyncConfig: readAgentSyncConfig2 } = require_workspace();
    function getTrackerWarnings2(workspaceFolder, tracker) {
      const warnings = [];
      const config = readAgentSyncConfig2(workspaceFolder);
      if (!isEmptyValue2(tracker.date)) {
        const parsed = Date.parse(tracker.date);
        if (Number.isFinite(parsed)) {
          const ageMs = Date.now() - parsed;
          if (ageMs > config.staleAfterHours * 60 * 60 * 1e3) {
            const ageHours = Math.floor(ageMs / (60 * 60 * 1e3));
            warnings.push(`Tracker is stale (${ageHours}h old).`);
          }
        }
      }
      const currentBranch = runGit2(workspaceFolder, ["rev-parse", "--abbrev-ref", "HEAD"]);
      if (currentBranch && !isEmptyValue2(tracker.branch) && tracker.branch !== currentBranch) {
        warnings.push(`Branch mismatch: tracker=${tracker.branch}, current=${currentBranch}.`);
      }
      if (!isEmptyValue2(tracker.commit)) {
        const exitCode = runGitExitCode2(workspaceFolder, [
          "merge-base",
          "--is-ancestor",
          tracker.commit,
          "HEAD"
        ]);
        if (exitCode !== 0) {
          warnings.push(`Tracker commit ${tracker.commit} is not in current HEAD history.`);
        }
      }
      return warnings;
    }
    module2.exports = { getTrackerWarnings: getTrackerWarnings2 };
  }
});

// src/utils/agentCatalog.js
var require_agentCatalog = __commonJS({
  "src/utils/agentCatalog.js"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    var path2 = require("path");
    var DEFAULT_CATEGORY_DIRS = [
      "engineering",
      "design",
      "marketing",
      "product",
      "project-management",
      "support",
      "testing",
      "specialized",
      "spatial-computing",
      "strategy"
    ];
    var CATEGORY_COLOR_FALLBACKS = {
      engineering: "cyan",
      design: "purple",
      marketing: "blue",
      product: "green",
      "project-management": "gold",
      support: "teal",
      testing: "orange",
      specialized: "indigo",
      "spatial-computing": "neon-cyan",
      strategy: "emerald"
    };
    var CATEGORY_CAPABILITY_MAP = {
      engineering: ["implementation", "architecture"],
      design: ["design", "ux"],
      marketing: ["content", "marketing"],
      product: ["product_planning", "analysis"],
      "project-management": ["coordination", "planning"],
      support: ["documentation", "support"],
      testing: ["testing", "qa"],
      specialized: ["data", "automation"],
      "spatial-computing": ["xr", "spatial"],
      strategy: ["strategy", "analysis"]
    };
    var FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
    var _catalogCache = /* @__PURE__ */ new Map();
    function parseFrontmatter(content) {
      const warnings = [];
      const match = content.match(FRONTMATTER_REGEX);
      if (!match) {
        return { frontmatter: {}, body: content, warnings: ["Frontmatter block is missing."] };
      }
      const frontmatterBlock = match[1] || "";
      const body = content.slice(match[0].length);
      const frontmatter = {};
      for (const rawLine of frontmatterBlock.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
          warnings.push('Invalid frontmatter line: "' + line + '"');
          continue;
        }
        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        if (!key) {
          warnings.push('Frontmatter key is empty in line: "' + line + '"');
          continue;
        }
        frontmatter[key] = stripWrappingQuotes(value);
      }
      return { frontmatter, body, warnings };
    }
    function normalizePath(value) {
      return value.replace(/\\/g, "/");
    }
    function stripWrappingQuotes(value) {
      if (!value) return value;
      const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"');
      const hasSingleQuotes = value.startsWith("'") && value.endsWith("'");
      if (hasDoubleQuotes || hasSingleQuotes) return value.slice(1, -1);
      return value;
    }
    function parseTools(rawTools) {
      if (!rawTools || !rawTools.trim()) return [];
      return rawTools.split(",").map((v) => v.trim()).filter((v) => v.length > 0);
    }
    function extractFirstHeading(body) {
      const headingMatch = body.match(/^#\s+(.+)$/m);
      if (!headingMatch) return "";
      return (headingMatch[1] || "").trim();
    }
    function headingContainsName(heading, name) {
      return heading.toLowerCase().includes(name.toLowerCase());
    }
    function listMarkdownFilesSync(rootDir) {
      const files = [];
      function walk(currentDir) {
        let entries;
        try {
          entries = fs2.readdirSync(currentDir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const entry of entries) {
          const absolutePath = path2.join(currentDir, entry.name);
          if (entry.isDirectory()) {
            walk(absolutePath);
          } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
            files.push(absolutePath);
          }
        }
      }
      walk(rootDir);
      return files.sort();
    }
    function parseAgentFile(content, context) {
      const { frontmatter, body, warnings } = parseFrontmatter(content);
      const validationWarnings = [...warnings];
      const fallbackName = path2.basename(context.filePath, ".md");
      const name = (frontmatter.name || "").trim() || fallbackName;
      if (!(frontmatter.name || "").trim()) {
        validationWarnings.push("Missing frontmatter field: name");
      }
      const description = (frontmatter.description || "").trim() || "No description provided.";
      if (!(frontmatter.description || "").trim()) {
        validationWarnings.push("Missing frontmatter field: description");
      }
      const categoryFallback = CATEGORY_COLOR_FALLBACKS[context.category] || "slate";
      const color = (frontmatter.color || "").trim() || categoryFallback;
      if (!(frontmatter.color || "").trim()) {
        validationWarnings.push('Missing frontmatter field: color. Using fallback "' + categoryFallback + '".');
      }
      const tools = parseTools(frontmatter.tools);
      const title = extractFirstHeading(body);
      if (title && !headingContainsName(title, name)) {
        validationWarnings.push(
          'Heading/title mismatch. First heading "' + title + '" does not include agent name "' + name + '".'
        );
      }
      return {
        id: context.category + "/" + path2.basename(context.sourcePath, ".md"),
        name,
        description,
        category: context.category,
        color,
        tools,
        promptBody: body.trim(),
        sourcePath: context.sourcePath,
        validationWarnings,
        frontmatter,
        title
      };
    }
    function annotateDuplicateNameWarnings(agents) {
      const groups = /* @__PURE__ */ new Map();
      for (const agent of agents) {
        const key = agent.name.trim().toLowerCase();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(agent);
      }
      for (const [nameKey, groupedAgents] of groups) {
        if (groupedAgents.length < 2) continue;
        for (const agent of groupedAgents) {
          agent.validationWarnings.push(
            'Duplicate agent name detected ("' + nameKey + '"). Review uniqueness across categories.'
          );
        }
      }
    }
    function buildCatalog2(options) {
      const categories = Array.isArray(options.categories) && options.categories.length > 0 ? options.categories : [...DEFAULT_CATEGORY_DIRS];
      const rootDirs = Array.isArray(options.rootDirs) ? options.rootDirs : [options.rootDir || "."];
      const agents = [];
      const seenIds = /* @__PURE__ */ new Set();
      for (const rootDir of rootDirs) {
        if (!fs2.existsSync(rootDir)) continue;
        for (const category of categories) {
          const categoryDir = path2.join(rootDir, category);
          if (!fs2.existsSync(categoryDir)) continue;
          const markdownFiles = listMarkdownFilesSync(categoryDir);
          for (const filePath of markdownFiles) {
            let content;
            try {
              content = fs2.readFileSync(filePath, "utf8");
            } catch {
              continue;
            }
            const relativePath = normalizePath(path2.relative(rootDir, filePath));
            const agent = parseAgentFile(content, {
              category,
              sourcePath: relativePath,
              filePath
            });
            if (seenIds.has(agent.id)) {
              const idx = agents.findIndex((a) => a.id === agent.id);
              if (idx >= 0) agents[idx] = agent;
            } else {
              seenIds.add(agent.id);
              agents.push(agent);
            }
          }
        }
      }
      annotateDuplicateNameWarnings(agents);
      return {
        schemaVersion: "1.0.0",
        agents,
        categories: Array.from(new Set(agents.map((a) => a.category))).sort(),
        lastIndexedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    function createCatalogWatcher(options, onChange) {
      const categories = Array.isArray(options.categories) && options.categories.length > 0 ? options.categories : [...DEFAULT_CATEGORY_DIRS];
      const rootDirs = Array.isArray(options.rootDirs) ? options.rootDirs : [options.rootDir || "."];
      const watchers = [];
      let timer = null;
      const scheduleRefresh = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            const updated = buildCatalog2(options);
            onChange(updated);
          } catch {
          }
        }, 200);
      };
      for (const rootDir of rootDirs) {
        for (const category of categories) {
          const categoryDir = path2.join(rootDir, category);
          if (!fs2.existsSync(categoryDir)) continue;
          try {
            const watcher = fs2.watch(categoryDir, { recursive: true }, scheduleRefresh);
            watchers.push(watcher);
          } catch {
          }
        }
      }
      return {
        close: () => {
          if (timer) clearTimeout(timer);
          for (const watcher of watchers) {
            watcher.close();
          }
        }
      };
    }
    function createSystemPrompt(agent) {
      return [
        "You are " + agent.name + ".",
        agent.description,
        "Follow your role definition and deliver concise, actionable output.",
        "If handing off to another agent, provide a clear summary of decisions and outputs."
      ].join("\n\n");
    }
    function createPrompt(agent, userInstruction, previousOutput, contextFiles) {
      const lines = [
        "## Agent Prompt Body",
        agent.promptBody,
        "",
        "## User Instruction",
        userInstruction
      ];
      if (contextFiles && contextFiles.length > 0) {
        lines.push("", "## Context Files", ...contextFiles.map((entry) => "- " + entry));
      }
      if (previousOutput && previousOutput.trim()) {
        lines.push("", "## Previous Agent Output", previousOutput);
      }
      return lines.join("\n");
    }
    function mapAgentToCapabilities2(agentDef) {
      if (!agentDef || !agentDef.category) return [];
      return CATEGORY_CAPABILITY_MAP[agentDef.category] || [];
    }
    function matchAgentsByCapabilities2(agents, requiredCapabilities) {
      if (!requiredCapabilities || requiredCapabilities.length === 0) return [];
      const requiredSet = new Set(requiredCapabilities.map((c) => c.toLowerCase()));
      const scored = agents.map((agent) => {
        const agentCaps = mapAgentToCapabilities2(agent);
        const matchCount = agentCaps.filter((c) => requiredSet.has(c.toLowerCase())).length;
        return { agent, score: matchCount };
      });
      return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.agent);
    }
    function getAgentCatalog2(workspaceFolder) {
      const cacheKey = workspaceFolder?.uri?.fsPath || "__global__";
      const cached = _catalogCache.get(cacheKey);
      if (cached) return cached;
      const bundledDir = path2.join(__dirname, "..", "..", "templates", "agents");
      const rootDirs = [bundledDir];
      if (workspaceFolder) {
        const workspaceAgentsDir = path2.join(workspaceFolder.uri.fsPath, ".agentsync", "agents");
        if (fs2.existsSync(workspaceAgentsDir)) {
          rootDirs.push(workspaceAgentsDir);
        }
      }
      const catalog = buildCatalog2({ rootDirs });
      _catalogCache.set(cacheKey, catalog);
      return catalog;
    }
    module2.exports = {
      DEFAULT_CATEGORY_DIRS,
      CATEGORY_COLOR_FALLBACKS,
      CATEGORY_CAPABILITY_MAP,
      buildCatalog: buildCatalog2,
      createCatalogWatcher,
      parseFrontmatter,
      parseAgentFile,
      createSystemPrompt,
      createPrompt,
      mapAgentToCapabilities: mapAgentToCapabilities2,
      matchAgentsByCapabilities: matchAgentsByCapabilities2,
      getAgentCatalog: getAgentCatalog2
    };
  }
});

// src/utils/executionChannels.js
var require_executionChannels = __commonJS({
  "src/utils/executionChannels.js"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    var path2 = require("path");
    var { createSystemPrompt, createPrompt } = require_agentCatalog();
    function assembleAgentPrompt2(agent, instruction, options = {}) {
      const systemPrompt = createSystemPrompt(agent);
      const userPrompt = createPrompt(
        agent,
        instruction,
        options.previousOutput || "",
        options.contextFiles
      );
      return [
        "# System Prompt",
        "",
        systemPrompt,
        "",
        "---",
        "",
        userPrompt
      ].join("\n");
    }
    async function copyToClipboard(vscodeEnv, assembledPrompt) {
      try {
        await vscodeEnv.clipboard.writeText(assembledPrompt);
        return true;
      } catch {
        return false;
      }
    }
    function writeToDropZone(workspaceRoot, assembledPrompt) {
      try {
        const agentSyncDir = path2.join(workspaceRoot, ".agentsync");
        fs2.mkdirSync(agentSyncDir, { recursive: true });
        const promptPath = path2.join(agentSyncDir, "agent-prompt.md");
        fs2.writeFileSync(promptPath, assembledPrompt, "utf8");
        return true;
      } catch {
        return false;
      }
    }
    async function deliverPrompt2(channel, context, assembledPrompt) {
      if (channel === "drop-zone" && context.workspaceRoot) {
        const ok = writeToDropZone(context.workspaceRoot, assembledPrompt);
        return { ok, channel: "drop-zone" };
      }
      if (context.vscodeEnv) {
        const ok = await copyToClipboard(context.vscodeEnv, assembledPrompt);
        return { ok, channel: "clipboard" };
      }
      return { ok: false, channel };
    }
    var PERSONALITY_SECTION_HEADER = "## Active Agent Personality";
    var PERSONALITY_SECTION_REGEX = /\n## Active Agent Personality[\s\S]*?(?=\n## [^\n]|\n# [^\n]|$)/;
    function injectPersonalitySection(filePath, agent) {
      let content = "";
      try {
        content = fs2.readFileSync(filePath, "utf8");
      } catch {
        return;
      }
      content = content.replace(PERSONALITY_SECTION_REGEX, "");
      const section = [
        "",
        PERSONALITY_SECTION_HEADER,
        "",
        "**Agent:** " + agent.name + " (" + agent.id + ")",
        "**Category:** " + agent.category,
        "**Description:** " + agent.description,
        "",
        agent.promptBody,
        ""
      ].join("\n");
      content += section;
      fs2.writeFileSync(filePath, content, "utf8");
    }
    function removePersonalitySection(filePath) {
      let content = "";
      try {
        content = fs2.readFileSync(filePath, "utf8");
      } catch {
        return;
      }
      const updated = content.replace(PERSONALITY_SECTION_REGEX, "");
      if (updated !== content) {
        fs2.writeFileSync(filePath, updated, "utf8");
      }
    }
    function injectPersonalityToWorkspace2(workspaceRoot, agent) {
      const files = [
        path2.join(workspaceRoot, "CLAUDE.md"),
        path2.join(workspaceRoot, "AGENTS.md"),
        path2.join(workspaceRoot, ".github", "copilot-instructions.md")
      ];
      for (const filePath of files) {
        injectPersonalitySection(filePath, agent);
      }
    }
    function removePersonalityFromWorkspace(workspaceRoot) {
      const files = [
        path2.join(workspaceRoot, "CLAUDE.md"),
        path2.join(workspaceRoot, "AGENTS.md"),
        path2.join(workspaceRoot, ".github", "copilot-instructions.md")
      ];
      for (const filePath of files) {
        removePersonalitySection(filePath);
      }
    }
    module2.exports = {
      assembleAgentPrompt: assembleAgentPrompt2,
      copyToClipboard,
      writeToDropZone,
      deliverPrompt: deliverPrompt2,
      injectPersonalitySection,
      removePersonalitySection,
      injectPersonalityToWorkspace: injectPersonalityToWorkspace2,
      removePersonalityFromWorkspace
    };
  }
});

// src/utils/handoffs.js
var require_handoffs = __commonJS({
  "src/utils/handoffs.js"(exports2, module2) {
    var {
      OPEN_HANDOFF_STATUSES: OPEN_HANDOFF_STATUSES2
    } = require_constants();
    var {
      canonicalAgentId: canonicalAgentId2,
      toSingleLine: toSingleLine2
    } = require_text();
    var {
      readHandoffs: readHandoffs2,
      writeHandoffs: writeHandoffs2,
      readTracker: readTracker2,
      writeTracker
    } = require_storage();
    var { setSectionBody: setSectionBody2 } = require_text();
    var HANDOFF_ALLOWED_STATUSES = /* @__PURE__ */ new Set([
      "queued",
      "in_progress",
      "blocked",
      "ready_for_review",
      "approved",
      "merged",
      "escalated"
    ]);
    function isOpenHandoff(handoff) {
      return OPEN_HANDOFF_STATUSES2.has(String(handoff?.status || "").toLowerCase());
    }
    function validateHandoff2(handoff) {
      const errors = [];
      const skipReason = handoff.no_handoff_reason !== null && handoff.no_handoff_reason !== void 0 ? String(handoff.no_handoff_reason || "").trim() : null;
      const isSkip = Boolean(skipReason);
      if (!handoff.from_agent) errors.push("from_agent is required");
      if (!handoff.summary && !isSkip) errors.push("summary is required");
      if (!handoff.owner_mode) errors.push("owner_mode is required");
      if (!handoff.status) errors.push("status is required");
      const mode = String(handoff.owner_mode || "").toLowerCase();
      const toAgents = Array.isArray(handoff.to_agents) ? handoff.to_agents : [];
      if (mode === "single") {
        if (toAgents.length !== 1) errors.push('owner_mode "single" requires exactly 1 to_agents entry');
      } else if (mode === "shared") {
        if (toAgents.length !== 2) {
          errors.push('owner_mode "shared" requires exactly 2 to_agents entries');
        }
      } else if (mode === "auto") {
        const caps = Array.isArray(handoff.required_capabilities) ? handoff.required_capabilities : [];
        if (caps.length === 0) {
          errors.push('owner_mode "auto" requires at least one required_capabilities entry');
        }
      } else if (mode !== "") {
        errors.push(`owner_mode must be "single", "shared", or "auto" (got "${mode}")`);
      }
      if (handoff.no_handoff_reason !== null && handoff.no_handoff_reason !== void 0) {
        if (typeof handoff.no_handoff_reason !== "string" || !handoff.no_handoff_reason.trim()) {
          errors.push("no_handoff_reason must be a non-empty string when provided");
        } else {
          if (mode !== "auto") {
            errors.push('skip/no_handoff records must use owner_mode "auto"');
          }
          if (toAgents.length > 0) {
            errors.push("skip/no_handoff records must not set to_agents");
          }
        }
      }
      if (!handoff.created_at) {
        errors.push("created_at is required");
      } else if (typeof handoff.created_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(handoff.created_at)) {
        errors.push("created_at must be an ISO 8601 timestamp");
      }
      return { valid: errors.length === 0, errors };
    }
    function normalizeHandoffStatus2(status, fallback = "queued") {
      const normalized = String(status || "").toLowerCase().trim();
      if (HANDOFF_ALLOWED_STATUSES.has(normalized)) return normalized;
      return fallback;
    }
    function buildHandoffId2(handoffs, now) {
      const dateStr = now.slice(0, 10).replace(/-/g, "");
      const existing = new Set((handoffs || []).map((h) => toSingleLine2(h?.handoff_id)));
      let seq = Math.max(1, (handoffs || []).length + 1);
      while (seq < 1e4) {
        const id = `HO-${dateStr}-${String(seq).padStart(3, "0")}`;
        if (!existing.has(id)) return id;
        seq += 1;
      }
      return `HO-${dateStr}-${Date.now().toString().slice(-6)}`;
    }
    function createHandoffRecord2(workspaceFolder, input = {}) {
      const store = readHandoffs2(workspaceFolder);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const fromAgent = canonicalAgentId2(input.from_agent || input.agent || "agency");
      const toAgents = Array.isArray(input.to_agents) ? input.to_agents.map((a) => canonicalAgentId2(a)).filter(Boolean) : [];
      const requiredCaps = Array.isArray(input.required_capabilities) ? input.required_capabilities.map((c) => toSingleLine2(c)).filter(Boolean) : [];
      const skipReason = input.no_handoff_reason !== null && input.no_handoff_reason !== void 0 ? toSingleLine2(input.no_handoff_reason) : null;
      const modeInput = String(input.owner_mode || "").toLowerCase();
      let ownerMode = modeInput;
      if (!ownerMode) {
        ownerMode = toAgents.length >= 2 ? "shared" : toAgents.length === 1 ? "single" : "auto";
      }
      const record = {
        handoff_id: toSingleLine2(input.handoff_id) || buildHandoffId2(store.handoffs, now),
        task_id: toSingleLine2(input.task_id) || null,
        from_agent: fromAgent || "agency",
        to_agents: toAgents,
        owner_mode: ownerMode,
        status: normalizeHandoffStatus2(input.status, "queued"),
        required_capabilities: requiredCaps,
        summary: toSingleLine2(input.summary) || (skipReason ? "Handoff skipped by agent" : "Agency handoff"),
        notes: toSingleLine2(input.notes || ""),
        no_handoff_reason: skipReason || null,
        files: Array.isArray(input.files) ? input.files.map((f) => toSingleLine2(f)).filter(Boolean) : [],
        branch: toSingleLine2(input.branch) || null,
        commit: toSingleLine2(input.commit) || null,
        prior_attempts: Number.isFinite(Number(input.prior_attempts)) ? Math.max(0, Math.round(Number(input.prior_attempts))) : 0,
        recommended_model_tier: input.recommended_model_tier === "lead" || input.recommended_model_tier === "worker" ? input.recommended_model_tier : null,
        model_justification: toSingleLine2(input.model_justification) || null,
        context_hints: input.context_hints && typeof input.context_hints === "object" ? input.context_hints : null,
        source_system: toSingleLine2(input.source_system) || null,
        source_run_id: toSingleLine2(input.source_run_id) || null,
        source_event_id: toSingleLine2(input.source_event_id) || null,
        created_at: now,
        updated_at: now,
        state_history: [
          {
            status: normalizeHandoffStatus2(input.status, "queued"),
            agent: fromAgent || "agency",
            timestamp: now,
            reason: skipReason ? "created (skip)" : "created"
          }
        ]
      };
      if (skipReason) {
        record.owner_mode = "auto";
        record.to_agents = [];
        if (!record.required_capabilities.length) {
          record.required_capabilities = ["skip-handoff"];
        }
      } else if (record.owner_mode === "single" && record.to_agents.length !== 1) {
        record.owner_mode = "auto";
        record.to_agents = [];
        if (record.required_capabilities.length === 0) record.required_capabilities = ["handoff"];
      } else if (record.owner_mode === "shared" && record.to_agents.length !== 2) {
        record.owner_mode = "auto";
        record.to_agents = [];
        if (record.required_capabilities.length === 0) record.required_capabilities = ["handoff"];
      } else if (record.owner_mode === "auto" && record.required_capabilities.length === 0) {
        record.required_capabilities = ["handoff"];
      }
      const { valid, errors } = validateHandoff2(record);
      if (!valid) throw new Error("Invalid handoff: " + errors.join("; "));
      writeHandoffs2(workspaceFolder, { version: 1, handoffs: [...store.handoffs, record] });
      syncTrackerHandoffsSection2(workspaceFolder);
      return record;
    }
    function completeHandoffRecord2(workspaceFolder, handoffId, status, agentId, reason = null) {
      const normalizedId = toSingleLine2(handoffId);
      const nextStatus = normalizeHandoffStatus2(status, "merged");
      const actor = canonicalAgentId2(agentId);
      if (!normalizedId) return { ok: false, reason: "missing_handoff_id" };
      if (!actor) return { ok: false, reason: "missing_agent" };
      const store = readHandoffs2(workspaceFolder);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      let found = false;
      const updated = store.handoffs.map((h) => {
        if (toSingleLine2(h?.handoff_id) !== normalizedId) return h;
        found = true;
        return {
          ...h,
          status: nextStatus,
          updated_at: now,
          state_history: [
            ...Array.isArray(h.state_history) ? h.state_history : [],
            {
              status: nextStatus,
              agent: actor,
              timestamp: now,
              reason: toSingleLine2(reason) || "completed via agentsync"
            }
          ]
        };
      });
      if (!found) return { ok: false, reason: "not_found" };
      const completedRecord = updated.find((h) => toSingleLine2(h?.handoff_id) === normalizedId);
      if (completedRecord) {
        const validation = validateHandoff2(completedRecord);
        if (!validation.valid) {
          return { ok: false, reason: "invalid_handoff", errors: validation.errors };
        }
      }
      writeHandoffs2(workspaceFolder, { version: 1, handoffs: updated });
      syncTrackerHandoffsSection2(workspaceFolder);
      advanceChainOnCompletion(workspaceFolder, normalizedId);
      return { ok: true, handoffId: normalizedId, status: nextStatus };
    }
    function advanceChainOnCompletion(workspaceFolder, completedHandoffId) {
      const store = readHandoffs2(workspaceFolder);
      const completed = store.handoffs.find(
        (h) => toSingleLine2(h?.handoff_id) === toSingleLine2(completedHandoffId)
      );
      if (!completed || !completed.chain_id) return;
      const completedStatus = String(completed.status || "").toLowerCase();
      const isTerminal = completedStatus === "merged" || completedStatus === "approved" || completedStatus === "ready_for_review";
      if (!isTerminal) return;
      const nextStep = completed.chain_step + 1;
      const nextHandoff = store.handoffs.find(
        (h) => h.chain_id === completed.chain_id && h.chain_step === nextStep && String(h.status || "").toLowerCase() === "blocked"
      );
      if (!nextHandoff) return;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      nextHandoff.status = "queued";
      nextHandoff.updated_at = now;
      nextHandoff.notes = (nextHandoff.notes || "") + " | Previous step completed: " + toSingleLine2(completed.summary || "");
      if (!Array.isArray(nextHandoff.state_history)) nextHandoff.state_history = [];
      nextHandoff.state_history.push({
        status: "queued",
        agent: "system",
        timestamp: now,
        reason: "chain auto-advance from " + completedHandoffId
      });
      writeHandoffs2(workspaceFolder, { version: 1, handoffs: store.handoffs });
      syncTrackerHandoffsSection2(workspaceFolder);
    }
    function claimHandoffRecord2(workspaceFolder, handoffId, agentId) {
      const store = readHandoffs2(workspaceFolder);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const normalizedId = toSingleLine2(handoffId);
      const canonical = canonicalAgentId2(agentId);
      if (!normalizedId) return { ok: false, success: false, reason: "missing_handoff_id" };
      if (!canonical) return { ok: false, success: false, reason: "missing_agent" };
      let result = { ok: false, success: false, reason: "not_found" };
      const updated = store.handoffs.map((handoff) => {
        if (toSingleLine2(handoff?.handoff_id) !== normalizedId) return handoff;
        const currentStatus = String(handoff?.status || "").toLowerCase();
        const owners = getHandoffOwners2(handoff);
        const lastClaim = Array.isArray(handoff?.state_history) && handoff.state_history.length > 0 ? handoff.state_history[handoff.state_history.length - 1] : null;
        const claimedBy = lastClaim?.agent ? canonicalAgentId2(lastClaim.agent) : null;
        if (currentStatus === "in_progress") {
          result = { ok: false, success: false, reason: "already_claimed", claimedBy };
          return handoff;
        }
        if (currentStatus !== "queued") {
          result = {
            ok: false,
            success: false,
            reason: "not_claimable",
            status: currentStatus || "unknown"
          };
          return handoff;
        }
        if (owners.length > 0 && !owners.includes(canonical)) {
          result = { ok: false, success: false, reason: "not_assigned" };
          return handoff;
        }
        result = { ok: true, success: true, handoffId: normalizedId };
        return {
          ...handoff,
          status: "in_progress",
          updated_at: now,
          state_history: [
            ...Array.isArray(handoff.state_history) ? handoff.state_history : [],
            {
              status: "in_progress",
              agent: canonical,
              timestamp: now,
              reason: "claimed via agentsync"
            }
          ]
        };
      });
      if (!result.ok) return result;
      const claimedRecord = updated.find((handoff) => toSingleLine2(handoff?.handoff_id) === normalizedId);
      if (claimedRecord) {
        const validation = validateHandoff2(claimedRecord);
        if (!validation.valid) {
          return { ok: false, success: false, reason: "invalid_handoff", errors: validation.errors };
        }
      }
      writeHandoffs2(workspaceFolder, { version: 1, handoffs: updated });
      return result;
    }
    function syncTrackerHandoffsSection2(workspaceFolder) {
      const content = readTracker2(workspaceFolder);
      if (!content) return;
      const { handoffs } = readHandoffs2(workspaceFolder);
      const updated = setSectionBody2(
        content,
        "Agent Handoffs",
        renderTrackerHandoffsSection(handoffs)
      );
      writeTracker(workspaceFolder, updated);
    }
    function renderTrackerHandoffsSection(handoffs) {
      const open = handoffs.filter(isOpenHandoff);
      if (open.length === 0) return "No open handoffs.";
      const lines = [];
      for (const h of open) {
        const id = String(h.handoff_id || h.task_id || "unknown");
        const from = String(h.from_agent || "unknown");
        const to = Array.isArray(h.to_agents) && h.to_agents.length > 0 ? h.to_agents.join(",") : "(none)";
        const mode = String(h.owner_mode || "unknown");
        const status = String(h.status || "queued");
        lines.push(`- [ ] ${id} | from: ${from} | to: ${to} | mode: ${mode} | status: ${status}`);
        const taskParts = [];
        if (h.task_id) taskParts.push(`task: ${h.task_id}`);
        const files = Array.isArray(h.files) ? h.files : [];
        if (files.length > 0) taskParts.push(`files: ${files.map((f) => `\`${f}\``).join(", ")}`);
        if (taskParts.length > 0) lines.push(`  - ${taskParts.join(" | ")}`);
        if (h.notes && h.notes.trim()) lines.push(`  - note: ${h.notes.trim()}`);
      }
      return lines.join("\n");
    }
    function listHandoffRecords2(workspaceFolder) {
      const store = readHandoffs2(workspaceFolder);
      return store.handoffs;
    }
    function getHandoffOwners2(handoff) {
      const owners = Array.isArray(handoff?.to_agents) ? handoff.to_agents.map((agent) => canonicalAgentId2(agent)).filter(Boolean) : [];
      const personalityId = canonicalAgentId2(
        handoff?.agent_personality_id || handoff?.suggested_agent_personality_id || ""
      );
      const isLegacyPipelineAssignment = Boolean(handoff?.chain_id) && Boolean(personalityId) && owners.length === 1 && owners[0] === personalityId;
      if (isLegacyPipelineAssignment) return [];
      return owners;
    }
    function isProviderFlexHandoff(handoff) {
      return getHandoffOwners2(handoff).length === 0;
    }
    function getHandoffPersonalityId(handoff) {
      return canonicalAgentId2(
        handoff?.agent_personality_id || handoff?.suggested_agent_personality_id || ""
      );
    }
    function getHandoffBuckets(handoffs, currentAgentId, staleAfterHours) {
      const now = Date.now();
      const staleMs = staleAfterHours * 60 * 60 * 1e3;
      const isMine = (h) => {
        const owners = getHandoffOwners2(h);
        return owners.includes(currentAgentId);
      };
      const isStale = (h) => {
        const stamp = h?.updated_at || h?.created_at;
        if (!stamp) return false;
        const parsed = Date.parse(stamp);
        if (!Number.isFinite(parsed)) return false;
        return now - parsed > staleMs;
      };
      const open = handoffs.filter(isOpenHandoff);
      const assignedToMe = open.filter(
        (h) => currentAgentId && isMine(h) && String(h?.owner_mode || "").toLowerCase() === "single"
      );
      const sharedWithMe = open.filter(
        (h) => currentAgentId && isMine(h) && String(h?.owner_mode || "").toLowerCase() === "shared"
      );
      const runnable = open.filter((h) => {
        if (String(h?.status || "").toLowerCase() !== "queued") return false;
        return isProviderFlexHandoff(h) || !currentAgentId || isMine(h);
      });
      const blockedOrStale = open.filter(
        (h) => String(h?.status || "").toLowerCase() === "blocked" || isStale(h)
      );
      return { open, assignedToMe, sharedWithMe, blockedOrStale, runnable };
    }
    function listRunnableQueuedHandoffs2(workspaceFolder, currentAgentId, staleHours = 24) {
      const { handoffs } = readHandoffs2(workspaceFolder);
      if (!Array.isArray(handoffs)) return [];
      const buckets = getHandoffBuckets(handoffs, currentAgentId, staleHours);
      return buckets.runnable;
    }
    module2.exports = {
      isOpenHandoff,
      validateHandoff: validateHandoff2,
      normalizeHandoffStatus: normalizeHandoffStatus2,
      buildHandoffId: buildHandoffId2,
      createHandoffRecord: createHandoffRecord2,
      completeHandoffRecord: completeHandoffRecord2,
      claimHandoffRecord: claimHandoffRecord2,
      advanceChainOnCompletion,
      syncTrackerHandoffsSection: syncTrackerHandoffsSection2,
      renderTrackerHandoffsSection,
      listHandoffRecords: listHandoffRecords2,
      getHandoffOwners: getHandoffOwners2,
      isProviderFlexHandoff,
      getHandoffPersonalityId,
      getHandoffBuckets,
      listRunnableQueuedHandoffs: listRunnableQueuedHandoffs2
    };
  }
});

// src/utils/health.js
var require_health = __commonJS({
  "src/utils/health.js"(exports2, module2) {
    "use strict";
    var cp = require("child_process");
    var os = require("os");
    var { readAgentSyncConfig: readAgentSyncConfig2 } = require_workspace();
    var { parseCommandArgv: parseCommandArgv2 } = require_io();
    function runCheckCommand(workspaceFolder, command) {
      if (!command || !command.trim()) return Promise.resolve({ ok: false, output: "" });
      const argv = parseCommandArgv2(command.trim());
      if (argv.length === 0) return Promise.resolve({ ok: false, output: "" });
      const [program, ...args] = argv;
      const resolvedProgram = resolveHealthCheckProgram2(program);
      return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";
        const proc = cp.spawn(resolvedProgram, args, { cwd: workspaceFolder.uri.fsPath });
        proc.stdout.on("data", (data) => stdout += data.toString());
        proc.stderr.on("data", (data) => stderr += data.toString());
        const timeoutId = setTimeout(() => {
          proc.kill();
          resolve({ ok: false, output: "Command timed out after 60s." });
        }, 6e4);
        proc.on("close", (code) => {
          clearTimeout(timeoutId);
          resolve({ ok: code === 0, output: (stdout + stderr).trim() });
        });
        proc.on("error", (err) => {
          clearTimeout(timeoutId);
          resolve({ ok: false, output: `Process error: ${err.message}` });
        });
      });
    }
    function resolveHealthCheckProgram2(program, platform = os.platform()) {
      const normalized = String(program || "").trim();
      if (!normalized || platform !== "win32") return normalized;
      if (/\.(cmd|exe|bat)$/i.test(normalized)) return normalized;
      const shimCommands = /* @__PURE__ */ new Set(["npm", "npx", "pnpm", "pnpx", "yarn", "yarnpkg", "corepack"]);
      return shimCommands.has(normalized.toLowerCase()) ? `${normalized}.cmd` : normalized;
    }
    async function runHealthChecks2(workspaceFolder) {
      const config = readAgentSyncConfig2(workspaceFolder);
      const commandMap = {
        Build: config.commands?.build,
        Tests: config.commands?.test || config.commands?.tests,
        Deploy: config.commands?.deploy
      };
      const results = {};
      const outputs = {};
      for (const [label, command] of Object.entries(commandMap)) {
        if (!command || !String(command).trim()) {
          results[label] = "Not configured";
          outputs[label] = "";
          continue;
        }
        const { ok, output } = await runCheckCommand(workspaceFolder, String(command));
        results[label] = ok ? "Pass" : "Fail";
        outputs[label] = output;
      }
      return { results, outputs };
    }
    function formatHealthTable(health, outputs = {}) {
      const rows = [
        "| Check  | Status |",
        "| ------ | ------ |",
        `| Build  | ${health.Build} |`,
        `| Tests  | ${health.Tests} |`,
        `| Deploy | ${health.Deploy} |`
      ];
      const failures = Object.entries(health).filter(([, status]) => status === "Fail");
      for (const [label] of failures) {
        const output = (outputs[label] || "").trim();
        if (output) {
          const trimmed = output.split("\n").slice(-20).join("\n");
          rows.push("", `**${label} output:**`, "```", trimmed, "```");
        }
      }
      return rows.join("\n");
    }
    module2.exports = {
      runHealthChecks: runHealthChecks2,
      formatHealthTable,
      runCheckCommand,
      resolveHealthCheckProgram: resolveHealthCheckProgram2
    };
  }
});

// src/session/providers.js
var require_providers = __commonJS({
  "src/session/providers.js"(exports2, module2) {
    "use strict";
    var { canonicalAgentId: canonicalAgentId2 } = require_utils();
    var EXECUTION_PROVIDER_DEFS2 = Object.freeze([
      { id: "claude", label: "Claude" },
      { id: "codex", label: "Codex" },
      { id: "gemini", label: "Gemini" },
      { id: "copilot", label: "Copilot" }
    ]);
    var EXECUTION_PROVIDER_BY_ID2 = Object.freeze(
      Object.fromEntries(EXECUTION_PROVIDER_DEFS2.map((provider) => [provider.id, provider]))
    );
    function getExecutionProvider2(value) {
      const norm = String(value || "").trim().toLowerCase();
      if (!norm) return null;
      const byId = EXECUTION_PROVIDER_BY_ID2[norm];
      if (byId) return byId;
      return EXECUTION_PROVIDER_DEFS2.find((p) => p.label.toLowerCase() === norm) || null;
    }
    function getExecutionProviderId2(value) {
      return getExecutionProvider2(value)?.id || null;
    }
    function getExecutionProviderLabel2(value) {
      return getExecutionProvider2(value)?.label || null;
    }
    function getSessionProviderInfo2(session, fallback = null) {
      const providerId = canonicalAgentId2(session?.provider_id || "") || getExecutionProviderId2(session?.provider_label || "") || getExecutionProviderId2(session?.agent || "") || getExecutionProviderId2(fallback);
      const providerLabel = getExecutionProviderLabel2(session?.provider_label || "") || getExecutionProviderLabel2(session?.agent || "") || getExecutionProviderLabel2(fallback) || "Unknown";
      return { id: providerId, label: providerLabel };
    }
    module2.exports = {
      EXECUTION_PROVIDER_DEFS: EXECUTION_PROVIDER_DEFS2,
      EXECUTION_PROVIDER_BY_ID: EXECUTION_PROVIDER_BY_ID2,
      getExecutionProvider: getExecutionProvider2,
      getExecutionProviderId: getExecutionProviderId2,
      getExecutionProviderLabel: getExecutionProviderLabel2,
      getSessionProviderInfo: getSessionProviderInfo2
    };
  }
});

// src/session/personalities.js
var require_personalities = __commonJS({
  "src/session/personalities.js"(exports2, module2) {
    "use strict";
    var { canonicalAgentId: canonicalAgentId2 } = require_text();
    var { getAgentCatalog: getAgentCatalog2 } = require_agentCatalog();
    function getPersonalityDisplayName2(workspaceFolder, personalityId) {
      const normalized = canonicalAgentId2(personalityId);
      if (!normalized) return null;
      try {
        const catalog = getAgentCatalog2(workspaceFolder);
        const match = catalog?.agents?.find((agent) => canonicalAgentId2(agent.id) === normalized);
        return match?.name || null;
      } catch {
        return null;
      }
    }
    function getSessionPersonalityInfo2(workspaceFolder, session) {
      const personalityId = canonicalAgentId2(session?.personality_id || "") || canonicalAgentId2(session?.agent_personality_id || "") || null;
      const personalityName = String(session?.personality_name || "").trim() || getPersonalityDisplayName2(workspaceFolder, personalityId) || "None";
      return { id: personalityId, name: personalityName };
    }
    module2.exports = {
      getPersonalityDisplayName: getPersonalityDisplayName2,
      getSessionPersonalityInfo: getSessionPersonalityInfo2
    };
  }
});

// src/utils/session.js
var require_session = __commonJS({
  "src/utils/session.js"(exports2, module2) {
    "use strict";
    var { canonicalAgentId: canonicalAgentId2 } = require_text();
    var { getExecutionProviderId: getExecutionProviderId2, getExecutionProviderLabel: getExecutionProviderLabel2 } = require_providers();
    var { getPersonalityDisplayName: getPersonalityDisplayName2 } = require_personalities();
    function buildSessionIdentity2(workspaceFolder, providerLabel, options = {}) {
      const providerId = getExecutionProviderId2(options.providerId || providerLabel);
      const providerDisplay = getExecutionProviderLabel2(options.providerLabel || providerLabel) || "Unknown";
      const personalityId = canonicalAgentId2(options.personalityId || "");
      const personalityName = String(options.personalityName || "").trim() || getPersonalityDisplayName2(workspaceFolder, personalityId) || null;
      return {
        provider_id: providerId,
        provider_label: providerDisplay,
        personality_id: personalityId,
        personality_name: personalityName,
        // Legacy field retained for backward-compatible readers.
        agent: providerDisplay
      };
    }
    function detectWorkspaceHealth(config) {
      return {
        Build: config.commands?.build ? "Pending" : "Not configured",
        Tests: config.commands?.test || config.commands?.tests ? "Pending" : "Not configured",
        Deploy: config.commands?.deploy ? "Pending" : "Not configured"
      };
    }
    module2.exports = {
      buildSessionIdentity: buildSessionIdentity2,
      detectWorkspaceHealth
    };
  }
});

// src/utils/automation.js
var require_automation = __commonJS({
  "src/utils/automation.js"(exports2, module2) {
    "use strict";
    var { PLACEHOLDER: PLACEHOLDER2, DEFAULT_HANDOFF_ROUTING_DEFAULTS } = require_constants();
    var { toSingleLine: toSingleLine2, canonicalAgentId: canonicalAgentId2 } = require_text();
    function summarizeHealthCounts(health) {
      const counts = { pass: 0, fail: 0, notConfigured: 0, total: 0 };
      for (const status of Object.values(health || {})) {
        const normalized = toSingleLine2(status).toLowerCase();
        if (normalized === "pass") counts.pass += 1;
        else if (normalized === "fail") counts.fail += 1;
        else counts.notConfigured += 1;
        counts.total += 1;
      }
      return counts;
    }
    function buildDeterministicSessionSummary2({ goal, hotFiles, health, maxSummaryLength }) {
      const normalizedGoal = toSingleLine2(goal) || "session update";
      const filePart = hotFiles.length > 0 ? `mod ${hotFiles.length} files` : "no file changes";
      const passCount = Object.values(health).filter((status) => status === "Pass").length;
      const failCount = Object.values(health).filter((status) => status === "Fail").length;
      const healthPart = failCount > 0 ? `(${failCount} fails)` : `(${passCount} pass)`;
      const summary = `Goal: ${normalizedGoal} | ${filePart} | health: ${healthPart}`;
      if (maxSummaryLength && summary.length > maxSummaryLength) {
        return summary.slice(0, maxSummaryLength - 3) + "...";
      }
      return summary;
    }
    function resolveAutomationRoute2(config, sourceAgentLabel) {
      const agentId = canonicalAgentId2(sourceAgentLabel);
      if (!agentId) return null;
      const route = config?.automation?.handoffRoutingDefaults?.[agentId];
      const candidate = route && typeof route === "object" ? route : DEFAULT_HANDOFF_ROUTING_DEFAULTS[agentId];
      if (!candidate || typeof candidate !== "object") return null;
      const ownerMode = String(candidate.owner_mode || "").toLowerCase();
      const toAgents = Array.isArray(candidate.to_agents) ? candidate.to_agents.map((agent) => canonicalAgentId2(agent)).filter(Boolean) : [];
      const requiredCapabilities = Array.isArray(candidate.required_capabilities) ? candidate.required_capabilities.map((cap) => toSingleLine2(cap)).filter(Boolean) : [];
      if (ownerMode === "single" && toAgents.length === 1) {
        return { owner_mode: ownerMode, to_agents: toAgents, required_capabilities: [] };
      }
      if (ownerMode === "shared" && toAgents.length === 2) {
        return { owner_mode: ownerMode, to_agents: toAgents, required_capabilities: [] };
      }
      if (ownerMode === "auto" && requiredCapabilities.length > 0) {
        return { owner_mode: ownerMode, to_agents: [], required_capabilities: requiredCapabilities };
      }
      return null;
    }
    function buildAutomationHandoffNotes2({ summary, hotFiles, health, sourceAgent }) {
      const normalizedSummary = toSingleLine2(summary);
      const normalizedSourceAgent = canonicalAgentId2(sourceAgent) || "unknown";
      const topFiles = Array.isArray(hotFiles) ? hotFiles.slice(0, 2).join(", ") || "none" : "none";
      const healthCounts = summarizeHealthCounts(health || {});
      return toSingleLine2(
        `Auto-drafted from ${normalizedSourceAgent}. Goal: ${normalizedSummary}. Start with files: ${topFiles}. Health pass:${healthCounts.pass} fail:${healthCounts.fail} n/a:${healthCounts.notConfigured}.`
      );
    }
    function buildHandoffPromptLines(handoffRecord) {
      if (!handoffRecord || handoffRecord.no_handoff_reason) return [];
      const handoffId = toSingleLine2(handoffRecord.handoff_id) || "HO-UNKNOWN";
      const branch = toSingleLine2(handoffRecord.branch) || PLACEHOLDER2;
      const commit = toSingleLine2(handoffRecord.commit) || PLACEHOLDER2;
      const files = Array.isArray(handoffRecord.files) ? handoffRecord.files.filter(Boolean) : [];
      const startFiles = files.slice(0, 2).join(", ") || "AgentTracker.md";
      const summary = toSingleLine2(handoffRecord.summary) || "continue the current work";
      const mode = String(handoffRecord.owner_mode || "").toLowerCase();
      const modelTier = handoffRecord.recommended_model_tier || null;
      const modelJustification = toSingleLine2(handoffRecord.model_justification || "");
      let modelSuffix = "";
      if (modelTier === "worker") {
        modelSuffix = " [Worker-tier task: use a lighter model]";
      } else if (modelTier === "lead") {
        modelSuffix = " [Lead-tier task: use a capable model";
        if (modelJustification) modelSuffix += " - " + modelJustification;
        modelSuffix += "]";
      }
      const hints = handoffRecord.context_hints || null;
      let contextSuffix = "";
      if (hints) {
        const parts = [];
        if (Array.isArray(hints.entry_points) && hints.entry_points.length > 0) {
          parts.push("entry points: " + hints.entry_points.slice(0, 3).join(", "));
        }
        if (Array.isArray(hints.relevant_symbols) && hints.relevant_symbols.length > 0) {
          parts.push("key symbols: " + hints.relevant_symbols.slice(0, 5).join(", "));
        }
        if (parts.length > 0) contextSuffix = " Context: " + parts.join("; ") + ".";
      }
      const buildLine = (targetLabel) => `[AgentSync] Pick up ${handoffId} on ${branch} (${commit}) for ${targetLabel}: start in ${startFiles}; goal: ${summary}; check AgentTracker.md + .agentsync/handoffs.json + .agentsync/context-capsule.json.${modelSuffix}${contextSuffix}`;
      if (mode === "auto") {
        const caps = Array.isArray(handoffRecord.required_capabilities) ? handoffRecord.required_capabilities.map((cap) => toSingleLine2(cap)).filter(Boolean) : [];
        const capabilityLabel = caps.length > 0 ? `capabilities ${caps.join(", ")}` : "required capabilities";
        return [buildLine(capabilityLabel)];
      }
      const targets = Array.isArray(handoffRecord.to_agents) ? handoffRecord.to_agents.map((agent) => canonicalAgentId2(agent)).filter(Boolean) : [];
      if (targets.length === 0) return [buildLine("next owner")];
      return targets.map((target) => buildLine(target));
    }
    module2.exports = {
      buildDeterministicSessionSummary: buildDeterministicSessionSummary2,
      resolveAutomationRoute: resolveAutomationRoute2,
      buildAutomationHandoffNotes: buildAutomationHandoffNotes2,
      buildHandoffPromptLines
    };
  }
});

// src/session/state.js
var require_state = __commonJS({
  "src/session/state.js"(exports2, module2) {
    "use strict";
    var {
      OPEN_HANDOFF_STATUSES: OPEN_HANDOFF_STATUSES2,
      canonicalAgentId: canonicalAgentId2,
      parseISODate: parseISODate2,
      formatElapsed: formatElapsed2
    } = require_utils();
    function getSessionStaleInfo2(state, autoStaleSessionMinutes = 0) {
      if (!state?.sessionActive || !state?.activeSession?.startedAt) {
        return { isStale: false, ageMs: null, thresholdMs: null };
      }
      if (!Number.isFinite(autoStaleSessionMinutes) || autoStaleSessionMinutes <= 0) {
        return { isStale: false, ageMs: null, thresholdMs: null };
      }
      const started = parseISODate2(state.activeSession.startedAt);
      if (!Number.isFinite(started)) {
        return { isStale: false, ageMs: null, thresholdMs: autoStaleSessionMinutes * 60 * 1e3 };
      }
      const ageMs = Date.now() - started;
      const thresholdMs = autoStaleSessionMinutes * 60 * 1e3;
      return { isStale: ageMs >= thresholdMs, ageMs, thresholdMs };
    }
    function getOperationalState2(state, inProgressLines, handoffs, autoStaleSessionMinutes = 0) {
      const staleInfo = getSessionStaleInfo2(state, autoStaleSessionMinutes);
      if (state?.sessionActive) {
        if (staleInfo.isStale) {
          const ageLabel = staleInfo.ageMs != null ? formatElapsed2(staleInfo.ageMs) : "unknown duration";
          return {
            key: "waiting",
            label: "Waiting",
            reason: `Active session appears stale (running ${ageLabel}). End or clear it before new work.`
          };
        }
        return {
          key: "busy",
          label: "Busy",
          reason: 'An active session flag exists. If stale, use "Clear Active Session".'
        };
      }
      const openHandoffs2 = handoffs.filter(
        (h) => OPEN_HANDOFF_STATUSES2.has(String(h?.status || "").toLowerCase())
      );
      if (inProgressLines.length > 0 || openHandoffs2.length > 0) {
        return {
          key: "waiting",
          label: "Waiting",
          reason: "No active session, but pending work/handoffs exist."
        };
      }
      return { key: "ready", label: "Ready", reason: "No active session and no pending queue." };
    }
    function getStatePulseFrame2(stateKey) {
      const now = Math.floor(Date.now() / 700);
      if (stateKey === "busy") {
        const frames = ["[01]", "[10]", "[11]", "[00]"];
        return frames[now % frames.length];
      }
      if (stateKey === "waiting") {
        const frames = ["[.]", "[..]", "[...]"];
        return frames[now % frames.length];
      }
      return "[idle]";
    }
    function isOpenHandoff(handoff) {
      return OPEN_HANDOFF_STATUSES2.has(String(handoff?.status || "").toLowerCase());
    }
    function getHandoffOwners2(handoff) {
      const owners = Array.isArray(handoff?.to_agents) ? handoff.to_agents.map((agent) => canonicalAgentId2(agent)).filter(Boolean) : [];
      const personalityId = canonicalAgentId2(
        handoff?.agent_personality_id || handoff?.suggested_agent_personality_id || ""
      );
      const isLegacyPipelineAssignment = Boolean(handoff?.chain_id) && Boolean(personalityId) && owners.length === 1 && owners[0] === personalityId;
      if (isLegacyPipelineAssignment) return [];
      return owners;
    }
    function isProviderFlexHandoff(handoff) {
      return getHandoffOwners2(handoff).length === 0;
    }
    function getHandoffPersonalityId(handoff) {
      return canonicalAgentId2(
        handoff?.agent_personality_id || handoff?.suggested_agent_personality_id || ""
      );
    }
    function getHandoffBuckets(handoffs, currentAgentId, staleAfterHours) {
      const now = Date.now();
      const staleMs = staleAfterHours * 60 * 60 * 1e3;
      const isMine = (h) => {
        const owners = getHandoffOwners2(h);
        return owners.includes(currentAgentId);
      };
      const isStale = (h) => {
        const stamp = h?.updated_at || h?.created_at;
        if (!stamp) return false;
        const parsed = Date.parse(stamp);
        if (!Number.isFinite(parsed)) return false;
        return now - parsed > staleMs;
      };
      const open = handoffs.filter(isOpenHandoff);
      const assignedToMe = open.filter(
        (h) => currentAgentId && isMine(h) && String(h?.owner_mode || "").toLowerCase() === "single"
      );
      const sharedWithMe = open.filter(
        (h) => currentAgentId && isMine(h) && String(h?.owner_mode || "").toLowerCase() === "shared"
      );
      const runnable = open.filter((h) => {
        if (String(h?.status || "").toLowerCase() !== "queued") return false;
        return isProviderFlexHandoff(h) || !currentAgentId || isMine(h);
      });
      const blockedOrStale = open.filter(
        (h) => String(h?.status || "").toLowerCase() === "blocked" || isStale(h)
      );
      return { open, assignedToMe, sharedWithMe, blockedOrStale, runnable };
    }
    module2.exports = {
      getSessionStaleInfo: getSessionStaleInfo2,
      getOperationalState: getOperationalState2,
      getStatePulseFrame: getStatePulseFrame2,
      isOpenHandoff,
      getHandoffOwners: getHandoffOwners2,
      isProviderFlexHandoff,
      getHandoffPersonalityId,
      getHandoffBuckets
    };
  }
});

// src/utils/context.js
var require_context = __commonJS({
  "src/utils/context.js"(exports2, module2) {
    "use strict";
    var fs2 = require("fs");
    var { getHotFilesCached: getHotFilesCached2 } = require_git();
    var { getAgentSyncDir: getAgentSyncDir2, getContextCapsulePath: getContextCapsulePath2 } = require_paths();
    var { atomicWriteFileSync } = require_io();
    var { getWorkspaceSnapshot: getWorkspaceSnapshot2, invalidateWorkspaceCaches: invalidateWorkspaceCaches2 } = require_workspaceSnapshot();
    var { getTrackerWarnings: getTrackerWarnings2 } = require_trackerWarnings();
    var { PLACEHOLDER: PLACEHOLDER2, DEFAULT_STALE_HOURS: DEFAULT_STALE_HOURS2 } = require_constants();
    var { getSessionProviderInfo: getSessionProviderInfo2 } = require_providers();
    var { getHandoffBuckets, getOperationalState: getOperationalState2 } = require_state();
    function generateContextCapsule2(workspaceFolder) {
      const snapshot = getWorkspaceSnapshot2(workspaceFolder, { force: true });
      const state = snapshot.state || null;
      const tracker = snapshot.tracker || {
        agent: PLACEHOLDER2,
        date: PLACEHOLDER2,
        summary: PLACEHOLDER2,
        branch: PLACEHOLDER2,
        commit: PLACEHOLDER2
      };
      const handoffInfo = snapshot.handoffInfo || { handoffs: [] };
      const config = snapshot.config || {};
      const staleAfterHours = Number(config.staleAfterHours) || DEFAULT_STALE_HOURS2;
      const currentProviderId = getSessionProviderInfo2(
        state?.activeSession || state?.lastSession || null,
        tracker.agent
      ).id;
      const handoffBuckets = getHandoffBuckets(handoffInfo.handoffs, currentProviderId, staleAfterHours);
      const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0;
      const opsState = getOperationalState2(
        state,
        snapshot.inProgressLines || [],
        handoffInfo.handoffs || [],
        autoStaleSessionMinutes
      );
      const hotFiles = getHotFilesCached2(workspaceFolder, { force: true });
      const capsule = {
        version: 1,
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        workspace: workspaceFolder.name,
        state: opsState,
        session: {
          active: Boolean(state?.sessionActive),
          activeSession: state?.activeSession || null,
          lastSession: state?.lastSession || null,
          metrics: state?.sessionMetrics || null
        },
        tracker: {
          agent: tracker.agent,
          date: tracker.date,
          summary: tracker.summary,
          branch: tracker.branch,
          commit: tracker.commit
        },
        hotFiles,
        inProgress: snapshot.inProgressLines || [],
        handoffs: {
          openCount: handoffBuckets.open.length,
          assignedToMe: handoffBuckets.assignedToMe.slice(0, 20),
          sharedWithMe: handoffBuckets.sharedWithMe.slice(0, 20),
          blockedOrStale: handoffBuckets.blockedOrStale.slice(0, 20)
        },
        warnings: getTrackerWarnings2(workspaceFolder, tracker)
      };
      fs2.mkdirSync(getAgentSyncDir2(workspaceFolder), { recursive: true });
      atomicWriteFileSync(getContextCapsulePath2(workspaceFolder), JSON.stringify(capsule, null, 2));
      invalidateWorkspaceCaches2(workspaceFolder);
      return capsule;
    }
    module2.exports = { generateContextCapsule: generateContextCapsule2 };
  }
});

// src/utils/index.js
var require_utils = __commonJS({
  "src/utils/index.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      ...require_constants(),
      ...require_paths(),
      ...require_text(),
      ...require_io(),
      ...require_git(),
      ...require_workspace(),
      ...require_workspaceSnapshot(),
      ...require_trackerWarnings(),
      ...require_storage(),
      ...require_agentCatalog(),
      ...require_executionChannels(),
      ...require_handoffs(),
      ...require_health(),
      ...require_session(),
      ...require_automation(),
      ...require_context()
    };
  }
});

// src/session/SessionManager.js
var require_SessionManager = __commonJS({
  "src/session/SessionManager.js"(exports2, module2) {
    "use strict";
    var {
      readTracker: readTracker2,
      writeTracker,
      readStateFile: readStateFile2,
      writeStateFile: writeStateFile2,
      readHandoffs: readHandoffs2,
      writeHandoffs: writeHandoffs2,
      readAgentSyncConfig: readAgentSyncConfig2,
      runGit: runGit2,
      detectSignatureChanges,
      scoreNextTaskCapabilities: scoreNextTaskCapabilities2,
      PLACEHOLDER: PLACEHOLDER2,
      DEFAULT_END_SESSION_ZERO_TOUCH: DEFAULT_END_SESSION_ZERO_TOUCH2,
      getHotFilesCached: getHotFilesCached2,
      toSingleLine: toSingleLine2,
      parseISODate: parseISODate2,
      isEmptyValue: isEmptyValue2,
      parseTracker: parseTracker2,
      getSectionBody: getSectionBody2,
      setSectionBody: setSectionBody2,
      canonicalAgentId: canonicalAgentId2,
      getAgentCatalog: getAgentCatalog2,
      matchAgentsByCapabilities: matchAgentsByCapabilities2,
      buildHandoffPromptLines,
      renderTrackerHandoffsSection,
      removePersonalityFromWorkspace,
      formatHealthTable,
      isOpenHandoff,
      buildSessionIdentity: buildSessionIdentity2,
      validateHandoff: validateHandoff2,
      runHealthChecks: runHealthChecks2,
      buildDeterministicSessionSummary: buildDeterministicSessionSummary2,
      resolveAutomationRoute: resolveAutomationRoute2,
      buildAutomationHandoffNotes: buildAutomationHandoffNotes2
    } = require_utils();
    function startSessionCore(workspaceFolder, agent, goal, options = {}) {
      const content = readTracker2(workspaceFolder);
      if (!content) throw new Error("Could not read AgentTracker.md");
      const existingTracker = parseTracker2(content);
      const normalizedGoal = (goal || "").trim() || "Session started";
      const startedAt = (/* @__PURE__ */ new Date()).toISOString();
      const sessionIdentity = buildSessionIdentity2(workspaceFolder, agent, options);
      const entry = `- [ ] ${sessionIdentity.provider_label} (${startedAt}): ${normalizedGoal}`;
      const currentBody = getSectionBody2(content, "In Progress");
      const currentLines = currentBody.split(/\r?\n/).map((line) => line.trim()).filter((line) => !line.startsWith("<!--")).filter((line) => line && line.toLowerCase() !== "*nothing active*");
      const updatedBody = [...currentLines, entry].join("\n");
      const updated = setSectionBody2(content, "In Progress", updatedBody || "*Nothing active*");
      writeTracker(workspaceFolder, updated);
      const existingState = readStateFile2(workspaceFolder) || {};
      const lastSessionFromState = existingState.lastSession || null;
      const lastSessionFromTracker = isEmptyValue2(existingTracker.agent) ? null : {
        agent: existingTracker.agent,
        date: existingTracker.date,
        summary: existingTracker.summary,
        branch: existingTracker.branch,
        commit: existingTracker.commit
      };
      const lastSession = lastSessionFromState || lastSessionFromTracker;
      const updatedInProgressLines = [...currentLines, entry];
      writeStateFile2(workspaceFolder, {
        sessionActive: true,
        lastUpdated: startedAt,
        activeSession: {
          ...sessionIdentity,
          goal: normalizedGoal,
          startedAt
        },
        sessionMetrics: {
          filesOpened: 0,
          filesModified: 0,
          commandsRun: 0,
          startedAt
        },
        lastSession,
        hotFiles: [],
        inProgress: updatedInProgressLines
      });
      return { agent: sessionIdentity.provider_label, goal: normalizedGoal };
    }
    async function endSessionCore(workspaceFolder, agent, summary, nextWork, handoffData = null, options = {}) {
      let content = readTracker2(workspaceFolder);
      if (!content) throw new Error("Could not read AgentTracker.md");
      const config = readAgentSyncConfig2(workspaceFolder);
      const zeroTouchCfg = config.automation?.endSessionZeroTouch || DEFAULT_END_SESSION_ZERO_TOUCH2;
      const state = readStateFile2(workspaceFolder) || {};
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const branch = runGit2(workspaceFolder, ["rev-parse", "--abbrev-ref", "HEAD"]) || PLACEHOLDER2;
      const commit = runGit2(workspaceFolder, ["rev-parse", "--short", "HEAD"]) || PLACEHOLDER2;
      const hotFiles = Array.isArray(options.hotFiles) ? options.hotFiles : getHotFilesCached2(workspaceFolder, { force: true });
      const signatureChanges = detectSignatureChanges(workspaceFolder, hotFiles);
      const complexityInfo = scoreNextTaskCapabilities2(
        hotFiles,
        signatureChanges,
        state?.sessionMetrics || {},
        state?.priorAttempts || 0
      );
      let health = options.healthResults;
      let healthOutputs = options.healthOutputs;
      if (!health || !healthOutputs) {
        const checks = await runHealthChecks2(workspaceFolder);
        health = checks.results;
        healthOutputs = checks.outputs;
      }
      if (!health || typeof health !== "object") health = {};
      if (!healthOutputs || typeof healthOutputs !== "object") healthOutputs = {};
      const goalHint = toSingleLine2(options.goalHint || state?.activeSession?.goal || "");
      let normalizedSummary = toSingleLine2(summary);
      let summarySource = options.summarySource === "deterministic" ? "deterministic" : "user";
      let automationUsed = options.automationUsed === true;
      const automationFeatureEnabled = zeroTouchCfg.enabled || options.automationUsed === true;
      if (!normalizedSummary && zeroTouchCfg.enabled) {
        normalizedSummary = buildDeterministicSessionSummary2({
          goal: goalHint,
          hotFiles,
          health,
          maxSummaryLength: zeroTouchCfg.maxSummaryLength
        });
        summarySource = "deterministic";
        automationUsed = true;
      }
      const persistedSummary = normalizedSummary || PLACEHOLDER2;
      let automationContext = toSingleLine2(
        options.automationContext || handoffData && handoffData.automation_context || ""
      ) || null;
      if (hotFiles.length > 0 && handoffData === null && zeroTouchCfg.enabled) {
        const autoRoute = resolveAutomationRoute2(config, agent);
        if (autoRoute) {
          handoffData = {
            summary: normalizedSummary || "Session update",
            notes: buildAutomationHandoffNotes2({
              summary: normalizedSummary || "Session update",
              hotFiles,
              health,
              sourceAgent: agent
            }),
            owner_mode: autoRoute.owner_mode,
            to_agents: autoRoute.to_agents,
            required_capabilities: autoRoute.required_capabilities,
            no_handoff_reason: null,
            automation_context: "default:" + canonicalAgentId2(agent)
          };
          automationContext = handoffData.automation_context;
          automationUsed = true;
        }
      }
      if (hotFiles.length > 0 && config.requireHandoffOnEndSession && handoffData === null) {
        throw new Error(
          "Handoff note required when hot files exist. Provide handoffData or set no_handoff_reason."
        );
      }
      content = setSectionBody2(
        content,
        "Last Session",
        [
          "- **Agent:** " + agent,
          "- **Date:** " + now,
          "- **Summary:** " + persistedSummary,
          "- **Branch:** " + branch,
          "- **Commit:** " + commit
        ].join("\n")
      );
      content = setSectionBody2(content, "Current Health", formatHealthTable(health, healthOutputs));
      content = setSectionBody2(
        content,
        "Hot Files",
        hotFiles.length > 0 ? hotFiles.map((file) => "- `" + file + "`").join("\n") : "*None*"
      );
      const inProgressBody = getSectionBody2(content, "In Progress");
      const remainingInProgress = inProgressBody.split(/\r?\n/).map((line) => line.trim()).filter((line) => !line.startsWith("<!--")).filter((line) => line).filter((line) => line.toLowerCase() !== "*nothing active*").filter((line) => !line.toLowerCase().includes(agent.toLowerCase()));
      content = setSectionBody2(
        content,
        "In Progress",
        remainingInProgress.length > 0 ? remainingInProgress.join("\n") : "*Nothing active*"
      );
      const normalizedNextWork = toSingleLine2(nextWork);
      if (normalizedNextWork) {
        const existingNext = getSectionBody2(content, "Suggested Next Work").split(/\r?\n/).map((line) => line.trim()).filter((line) => !line.startsWith("<!--")).filter((line) => line);
        content = setSectionBody2(
          content,
          "Suggested Next Work",
          [...existingNext, "- " + normalizedNextWork].join("\n")
        );
      }
      if (signatureChanges.length > 0) {
        const existingGotchas = getSectionBody2(content, "Known Issues & Gotchas").split(/\r?\n/).map((line) => line.trim()).filter((line) => !line.startsWith("<!--")).filter((line) => line);
        const sigLines = signatureChanges.map(
          ({ file, change }) => `- \u26A0 Signature change in \`${file}\`: \`${change.trim().slice(0, 120)}\``
        );
        content = setSectionBody2(
          content,
          "Known Issues & Gotchas",
          [...existingGotchas, ...sigLines].join("\n")
        );
      }
      let handoffRecord = null;
      let generatedPromptLines = [];
      if (handoffData !== null) {
        const existingHandoffs = readHandoffs2(workspaceFolder);
        const allHandoffs = existingHandoffs.handoffs;
        const dateStr = now.slice(0, 10).replace(/-/g, "");
        const seq = String(allHandoffs.length + 1).padStart(3, "0");
        const handoffId = "HO-" + dateStr + "-" + seq;
        if (handoffData.no_handoff_reason) {
          const skipReason = String(handoffData.no_handoff_reason).trim();
          if (!skipReason) throw new Error("no_handoff_reason must be a non-empty string");
          handoffRecord = {
            handoff_id: handoffId,
            task_id: null,
            from_agent: canonicalAgentId2(agent),
            to_agents: [],
            owner_mode: "auto",
            status: "queued",
            required_capabilities: ["skip-handoff"],
            summary: "Handoff skipped by agent",
            notes: toSingleLine2(handoffData.notes || ""),
            no_handoff_reason: skipReason,
            files: hotFiles,
            branch,
            commit,
            prior_attempts: 0,
            generated_prompt_lines: [],
            prompt_copied_to_clipboard: false,
            summary_source: summarySource,
            automation_context: automationContext,
            created_at: now,
            updated_at: now,
            state_history: [
              { status: "queued", agent: canonicalAgentId2(agent), timestamp: now, reason: "skipped" }
            ]
          };
          const { valid, errors } = validateHandoff2(handoffRecord);
          if (!valid) throw new Error("Invalid handoff: " + errors.join("; "));
        } else {
          const modelTier = handoffData.recommended_model_tier || null;
          const modelJustification = handoffData.model_justification || null;
          const contextHints = handoffData.context_hints || null;
          handoffRecord = {
            handoff_id: handoffId,
            task_id: handoffData.task_id || null,
            from_agent: canonicalAgentId2(agent),
            to_agents: (handoffData.to_agents || []).map((a) => canonicalAgentId2(a)),
            owner_mode: String(handoffData.owner_mode || "single").toLowerCase(),
            status: "queued",
            required_capabilities: handoffData.required_capabilities || [],
            summary: toSingleLine2(handoffData.summary || normalizedSummary || "Session update"),
            notes: toSingleLine2(handoffData.notes || ""),
            no_handoff_reason: null,
            recommended_model_tier: modelTier,
            model_justification: modelJustification ? toSingleLine2(modelJustification) : null,
            context_hints: contextHints,
            files: hotFiles,
            branch,
            commit,
            prior_attempts: 0,
            agent_personality_id: handoffData.agent_personality_id || null,
            suggested_agent_personality_id: null,
            generated_prompt_lines: [],
            prompt_copied_to_clipboard: false,
            summary_source: summarySource,
            automation_context: toSingleLine2(handoffData.automation_context || automationContext || "") || null,
            created_at: now,
            updated_at: now,
            state_history: [
              {
                status: "queued",
                agent: canonicalAgentId2(agent),
                timestamp: now,
                reason: "session ended with hot files"
              }
            ]
          };
          const { valid, errors } = validateHandoff2(handoffRecord);
          if (!valid) throw new Error("Invalid handoff: " + errors.join("; "));
        }
        if (handoffRecord && !handoffRecord.suggested_agent_personality_id && !handoffRecord.no_handoff_reason) {
          try {
            const catalog = getAgentCatalog2(workspaceFolder);
            if (catalog && catalog.agents.length > 0) {
              const caps = handoffRecord.required_capabilities || complexityInfo.capabilities || [];
              const matched = matchAgentsByCapabilities2(catalog.agents, caps);
              if (matched.length > 0) {
                handoffRecord.suggested_agent_personality_id = matched[0].id;
              }
            }
          } catch {
          }
        }
        if (automationFeatureEnabled) {
          generatedPromptLines = buildHandoffPromptLines(handoffRecord);
          handoffRecord.generated_prompt_lines = generatedPromptLines;
        } else {
          delete handoffRecord.generated_prompt_lines;
          delete handoffRecord.prompt_copied_to_clipboard;
          delete handoffRecord.summary_source;
          delete handoffRecord.automation_context;
        }
        const updatedHandoffs = [...allHandoffs, handoffRecord];
        writeHandoffs2(workspaceFolder, { version: 1, handoffs: updatedHandoffs });
        content = setSectionBody2(
          content,
          "Agent Handoffs",
          renderTrackerHandoffsSection(updatedHandoffs)
        );
      } else {
        const existingHandoffs = readHandoffs2(workspaceFolder);
        if (existingHandoffs.handoffs.length > 0) {
          content = setSectionBody2(
            content,
            "Agent Handoffs",
            renderTrackerHandoffsSection(existingHandoffs.handoffs)
          );
        }
      }
      writeTracker(workspaceFolder, content);
      const currentHandoffs = readHandoffs2(workspaceFolder);
      const openHandoffs2 = currentHandoffs.handoffs.filter(isOpenHandoff);
      const shouldWriteAutomationState = automationFeatureEnabled && (automationUsed || summarySource === "deterministic" || generatedPromptLines.length > 0);
      const existingMetrics = readStateFile2(workspaceFolder)?.sessionMetrics || {};
      const existingState = readStateFile2(workspaceFolder) || {};
      const activeSessionIdentity = buildSessionIdentity2(
        workspaceFolder,
        agent,
        existingState?.activeSession || {}
      );
      const stateLastSession = {
        ...activeSessionIdentity,
        date: now,
        summary: persistedSummary,
        branch,
        commit,
        sessionMetrics: {
          filesModified: existingMetrics.filesModified || 0,
          commandsRun: existingMetrics.commandsRun || 0,
          durationMs: Date.now() - (parseISODate2(existingMetrics.startedAt) || Date.now())
        }
      };
      if (shouldWriteAutomationState) {
        stateLastSession.generatedSummary = normalizedSummary || persistedSummary;
        stateLastSession.summarySource = summarySource;
        stateLastSession.automationUsed = automationUsed;
        stateLastSession.generatedPrompts = generatedPromptLines;
      }
      try {
        removePersonalityFromWorkspace(workspaceFolder.uri.fsPath);
      } catch {
      }
      writeStateFile2(workspaceFolder, {
        sessionActive: false,
        lastUpdated: now,
        activeSession: null,
        lastSession: stateLastSession,
        health: Object.fromEntries(
          Object.entries(health).map(([label, status]) => [
            label,
            { status, output: healthOutputs[label] || "" }
          ])
        ),
        hotFiles,
        inProgress: remainingInProgress,
        openHandoffCount: openHandoffs2.length,
        activeHandoffIds: openHandoffs2.map((h) => String(h.handoff_id || h.task_id || ""))
      });
      return {
        health,
        healthOutputs,
        hotFiles,
        handoff: handoffRecord,
        generatedSummary: normalizedSummary || persistedSummary,
        summarySource,
        handoffPrompts: generatedPromptLines,
        promptCopiedToClipboard: false,
        signatureChanges,
        complexityInfo
      };
    }
    function clearActiveSessionCore(workspaceFolder) {
      const existingState = readStateFile2(workspaceFolder);
      if (!existingState?.sessionActive || !existingState?.activeSession) {
        return { cleared: false, agent: null };
      }
      const agent = String(existingState.activeSession.agent || "").trim() || null;
      const content = readTracker2(workspaceFolder);
      if (content) {
        const inProgressBody = getSectionBody2(content, "In Progress");
        const remaining = inProgressBody.split(/\r?\n/).map((line) => line.trim()).filter((line) => !line.startsWith("<!--")).filter((line) => line).filter((line) => line.toLowerCase() !== "*nothing active*").filter((line) => !agent || !line.toLowerCase().includes(agent.toLowerCase()));
        const updated = setSectionBody2(
          content,
          "In Progress",
          remaining.length > 0 ? remaining.join("\n") : "*Nothing active*"
        );
        writeTracker(workspaceFolder, updated);
      }
      writeStateFile2(workspaceFolder, {
        ...existingState,
        sessionActive: false,
        activeSession: null,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      });
      return { cleared: true, agent };
    }
    module2.exports = {
      startSessionCore,
      endSessionCore,
      clearActiveSessionCore
    };
  }
});

// src/dashboard/dashboardModel.js
var require_dashboardModel = __commonJS({
  "src/dashboard/dashboardModel.js"(exports2, module2) {
    "use strict";
    var {
      getWorkspaceSnapshot: getWorkspaceSnapshot2,
      getHotFilesCached: getHotFilesCached2,
      getTrackerWarnings: getTrackerWarnings2,
      normalizeRepoRelativePath: normalizeRepoRelativePath2,
      isEmptyValue: isEmptyValue2,
      parseISODate: parseISODate2,
      formatElapsed: formatElapsed2,
      getAgentCatalog: getAgentCatalog2,
      AGENT_CATEGORY_COLORS,
      DEFAULT_STALE_HOURS: DEFAULT_STALE_HOURS2
    } = require_utils();
    var {
      getSessionProviderInfo: getSessionProviderInfo2
    } = require_providers();
    var {
      getSessionPersonalityInfo: getSessionPersonalityInfo2,
      getPersonalityDisplayName: getPersonalityDisplayName2
    } = require_personalities();
    var {
      getHandoffBuckets,
      getOperationalState: getOperationalState2,
      getStatePulseFrame: getStatePulseFrame2,
      getHandoffOwners: getHandoffOwners2,
      getHandoffPersonalityId
    } = require_state();
    function getDashboardModel(workspaceFolder, viewMode = "compact") {
      const snapshot = getWorkspaceSnapshot2(workspaceFolder);
      const trackerContent = snapshot.trackerContent;
      const tracker = snapshot.tracker;
      const state = snapshot.state;
      const config = snapshot.config;
      const handoffInfo = snapshot.handoffInfo;
      const inProgressLines = snapshot.inProgressLines;
      const currentProvider = getSessionProviderInfo2(
        state?.activeSession || state?.lastSession || null,
        tracker.agent
      );
      const activePersonality = getSessionPersonalityInfo2(workspaceFolder, state?.activeSession || null);
      const staleAfterHours = Number(config.staleAfterHours) || DEFAULT_STALE_HOURS2;
      const handoffBuckets = getHandoffBuckets(handoffInfo.handoffs, currentProvider.id, staleAfterHours);
      const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0;
      const opsState = getOperationalState2(
        state,
        inProgressLines,
        handoffInfo.handoffs,
        autoStaleSessionMinutes
      );
      const warnings = trackerContent ? getTrackerWarnings2(workspaceFolder, tracker) : [];
      const sessionWarnMinutes = config.tokenBudget?.sessionDurationWarningMinutes || 0;
      if (sessionWarnMinutes > 0 && state?.sessionActive && state?.activeSession?.startedAt) {
        const started = parseISODate2(state.activeSession.startedAt);
        if (Number.isFinite(started)) {
          const ageMinutes = (Date.now() - started) / 6e4;
          if (ageMinutes >= sessionWarnMinutes) {
            warnings.push(
              `Session running ${formatElapsed2(Date.now() - started)} \u2014 consider ending and handing off to reduce context size.`
            );
          }
        }
      }
      const health = state?.health || {};
      const healthLabels = ["Build", "Tests", "Deploy"];
      const missingHealthChecks = healthLabels.filter((label) => {
        const status = String(health?.[label]?.status ?? health?.[label] ?? "Not configured");
        return status === "Not configured";
      });
      if (missingHealthChecks.length > 0) {
        warnings.push(
          `Setup needed: ${missingHealthChecks.join(", ")} checks are not configured.`
        );
      }
      const hotFiles = new Set(getHotFilesCached2(workspaceFolder).map(normalizeRepoRelativePath2));
      const getSuggestedNextStep = () => {
        if (!trackerContent) return 'Run "Initialize Workspace" to set up AgentSync files.';
        if (state?.sessionActive)
          return 'Use "End Session" when you are done, or "Clear Active Session" if stale.';
        if (handoffBuckets.runnable.length > 0)
          return 'Use "Run Next Step" to claim the next runnable handoff and prepare its prompt.';
        if (inProgressLines.length > 0)
          return "Review in-progress items, then start a new session to continue.";
        if (handoffBuckets.open.length > 0)
          return "Review blocked or provider-specific handoffs, then unblock or complete the earlier step.";
        if (missingHealthChecks.length > 0)
          return "Configure build/test/deploy commands to unlock health reporting on End Session.";
        return 'Ready to start. Use "Start Session" before making changes.';
      };
      const onboarding = {
        initialized: Boolean(trackerContent),
        started: Boolean(state?.sessionActive) || Boolean(state?.activeSession?.startedAt) || Boolean(state?.lastSession?.startedAt),
        ended: !state?.sessionActive && (Boolean(state?.lastSession?.endedAt) || !isEmptyValue2(tracker.date) && !isEmptyValue2(tracker.summary))
      };
      const toStatus = (entry) => {
        const value = entry?.status ?? entry ?? "Not configured";
        return String(value || "Not configured");
      };
      const summarizeHandoff = (h) => ({
        id: String(h?.handoff_id || h?.task_id || "unknown"),
        summary: String(h?.summary || h?.task_id || "No summary"),
        status: String(h?.status || "queued"),
        mode: String(h?.owner_mode || "unknown"),
        owners: getHandoffOwners2(h)
      });
      const summarizeHandoffCard = (h, stale = false) => {
        const files = Array.isArray(h?.files) ? h.files : [];
        const toAgents = getHandoffOwners2(h);
        const personalityId = getHandoffPersonalityId(h);
        const personalityName = getPersonalityDisplayName2(workspaceFolder, personalityId);
        return {
          id: String(h?.handoff_id || h?.task_id || "unknown"),
          summary: String(h?.summary || "No summary"),
          from_agent: String(h?.from_agent || "unknown"),
          to_agents_display: toAgents.join(", ") || "provider-flex",
          files_display: files.length > 3 ? files.slice(0, 3).join(", ") + " (+" + (files.length - 3) + " more)" : files.join(", ") || "none",
          status: String(h?.status || "queued"),
          notes: String(h?.notes || ""),
          personality: personalityName || personalityId || "Auto",
          recommended_model_tier: h?.recommended_model_tier || null,
          model_justification: String(h?.model_justification || ""),
          stale_observation: stale
        };
      };
      const compactTasks = inProgressLines.slice(0, 2);
      const compactExtraTaskCount = Math.max(0, inProgressLines.length - compactTasks.length);
      const rawSessionGoal = String(state?.activeSession?.goal || "").trim();
      const rawFirstInProgress = String(inProgressLines[0] || "").trim();
      const rawTrackerSummary = String(state?.lastSession?.summary || tracker.summary || "").trim();
      let focusText = "No active goal";
      if (!isEmptyValue2(rawSessionGoal)) {
        focusText = rawSessionGoal;
      } else if (!isEmptyValue2(rawFirstInProgress)) {
        focusText = rawFirstInProgress;
      } else if (!isEmptyValue2(rawTrackerSummary)) {
        focusText = rawTrackerSummary;
      }
      const normalizedViewMode = viewMode === "full" ? "full" : "compact";
      const defaultShortcuts = [
        "agentsync.startSession",
        "agentsync.runNextStep",
        "agentsync.endSession",
        "agentsync.openTracker",
        "agentsync.contextStatus"
      ];
      const shortcutsBase = Array.isArray(config.dashboardShortcuts) && config.dashboardShortcuts.length > 0 ? config.dashboardShortcuts : defaultShortcuts;
      const shortcuts = shortcutsBase.includes("agentsync.runNextStep") ? shortcutsBase : [shortcutsBase[0] || "agentsync.startSession", "agentsync.runNextStep", ...shortcutsBase.slice(1)];
      return {
        hasWorkspace: true,
        workspace: workspaceFolder.name,
        ui: {
          viewMode: normalizedViewMode
        },
        shortcuts,
        state: {
          key: opsState.key,
          label: opsState.label,
          reason: opsState.reason,
          pulse: getStatePulseFrame2(opsState.key)
        },
        refreshedAt: (/* @__PURE__ */ new Date()).toISOString(),
        nextStep: getSuggestedNextStep(),
        onboarding,
        session: {
          active: Boolean(state?.sessionActive),
          provider: state?.sessionActive ? currentProvider.label : "None",
          personality: state?.sessionActive ? activePersonality.name : "None",
          goal: state?.activeSession?.goal || "No active goal",
          startedAt: state?.activeSession?.startedAt || null
        },
        tracker: {
          lastAgent: state?.lastSession?.provider_label || state?.lastSession?.agent || tracker.agent,
          lastDate: state?.lastSession?.date || tracker.date,
          lastSummary: state?.lastSession?.summary || tracker.summary,
          branch: state?.lastSession?.branch || tracker.branch,
          commit: state?.lastSession?.commit || tracker.commit
        },
        warnings,
        inProgress: inProgressLines,
        compact: {
          focusText,
          tasks: compactTasks,
          extraTaskCount: compactExtraTaskCount
        },
        health: {
          Build: toStatus(health.Build),
          Tests: toStatus(health.Tests),
          Deploy: toStatus(health.Deploy)
        },
        handoffs: {
          exists: handoffInfo.exists,
          parseError: handoffInfo.error,
          openCount: handoffBuckets.open.length,
          assignedToMe: handoffBuckets.assignedToMe.slice(0, 8).map(summarizeHandoff),
          sharedWithMe: handoffBuckets.sharedWithMe.slice(0, 8).map(summarizeHandoff),
          blockedOrStale: handoffBuckets.blockedOrStale.slice(0, 8).map(summarizeHandoff),
          queued: handoffBuckets.runnable.slice(0, 10).map((h) => {
            const isStale = (h.files || []).some(
              (file) => hotFiles.has(normalizeRepoRelativePath2(file))
            );
            return summarizeHandoffCard(h, isStale);
          })
        },
        agentCatalog: (() => {
          try {
            const catalog = getAgentCatalog2(workspaceFolder);
            if (!catalog) return { loaded: false, totalAgents: 0, categories: [] };
            const catSummary = catalog.categories.map((cat) => ({
              name: cat,
              color: AGENT_CATEGORY_COLORS[cat] || "#888",
              count: catalog.agents.filter((a) => a.category === cat).length
            }));
            return { loaded: true, totalAgents: catalog.agents.length, categories: catSummary };
          } catch {
            return { loaded: false, totalAgents: 0, categories: [] };
          }
        })(),
        pipelines: (() => {
          const chains = /* @__PURE__ */ new Map();
          for (const h of handoffInfo.handoffs) {
            if (!h.chain_id) continue;
            if (!chains.has(h.chain_id)) chains.set(h.chain_id, []);
            chains.get(h.chain_id).push(h);
          }
          return Array.from(chains.entries()).map(([chainId, steps]) => {
            steps.sort((a, b) => (a.chain_step || 0) - (b.chain_step || 0));
            return {
              chainId,
              total: steps[0]?.chain_total || steps.length,
              steps: steps.map((s) => ({
                step: s.chain_step || 0,
                agentName: getPersonalityDisplayName2(workspaceFolder, getHandoffPersonalityId(s)) || getHandoffPersonalityId(s) || "Auto",
                status: String(s.status || "blocked"),
                handoffId: String(s.handoff_id || ""),
                summary: String(s.summary || "")
              }))
            };
          });
        })()
      };
    }
    module2.exports = { getDashboardModel };
  }
});

// src/dashboard/dashboardHtml.js
var require_dashboardHtml = __commonJS({
  "src/dashboard/dashboardHtml.js"(exports2, module2) {
    "use strict";
    var { createNonce } = require_utils();
    function getDashboardHtml() {
      const nonce = createNonce();
      return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AgentSync Live</title>
  <style>
    :root {
      --bg: #060b08;
      --card: rgba(8, 18, 13, 0.82);
      --line: rgba(68, 112, 79, 0.5);
      --text: #d7ffe5;
      --muted: #9fc2aa;
      --ready: #1fd678;
      --busy: #ff4d57;
      --waiting: #ffb347;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--text);
      background: var(--bg);
      font: 13px/1.45 "Consolas", "SFMono-Regular", "Menlo", monospace;
      overflow: hidden;
    }
    #matrix {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0.22;
      pointer-events: none;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background:
        radial-gradient(circle at 15% 0%, rgba(43, 130, 78, 0.18), transparent 38%),
        radial-gradient(circle at 85% 10%, rgba(20, 80, 55, 0.17), transparent 35%),
        linear-gradient(180deg, rgba(6, 13, 9, 0.9), rgba(2, 7, 4, 0.96));
      pointer-events: none;
    }
    .app {
      position: relative;
      z-index: 1;
      height: 100vh;
      overflow: auto;
      padding: 12px;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
    }
    .title {
      font-weight: 700;
      letter-spacing: 0.4px;
      margin-right: 4px;
    }
    .badge {
      border: 1px solid transparent;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
    }
    .badge.ready { color: #103a25; background: var(--ready); border-color: #86ffc2; }
    .badge.busy { color: #420e12; background: var(--busy); border-color: #ff9aa0; }
    .badge.waiting { color: #4a2e04; background: var(--waiting); border-color: #ffd898; }
    .pulse { color: var(--muted); opacity: 0.9; }
    .mode-toggle {
      margin-left: auto;
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.85);
      color: var(--text);
      border-radius: 7px;
      padding: 4px 8px;
      font: inherit;
      font-size: 11px;
      cursor: pointer;
    }
    .mode-toggle:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
      gap: 7px;
      margin-bottom: 10px;
    }
    .actions.busy button.action,
    .compact-actions.busy button.action,
    .compact-more-actions.busy button.action {
      opacity: 0.65;
      cursor: wait;
    }
    button.action {
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      border-radius: 8px;
      padding: 7px 8px;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    button.action:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
    button.action.active-command,
    button.recovery-action.active-command {
      border-color: var(--active-command-color, #c8d2d8);
      background: var(--active-command-bg, rgba(19, 33, 24, 0.92));
      box-shadow:
        0 0 0 1px var(--active-command-color, #c8d2d8),
        0 0 12px -2px var(--active-command-color, #c8d2d8);
    }
    .compact-panel {
      margin-bottom: 10px;
      padding: 8px;
    }
    .compact-focus {
      margin-bottom: 6px;
      font-weight: 700;
      color: #c0f0d3;
    }
    .compact-task-list {
      margin: 0;
      padding-left: 16px;
      max-height: 90px;
      overflow: auto;
    }
    .compact-task-list li {
      margin: 3px 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .compact-task-list li.empty {
      list-style: none;
      margin-left: -16px;
      color: var(--muted);
    }
    .compact-more-count {
      min-height: 16px;
      margin-top: 4px;
      color: var(--muted);
      font-size: 11px;
    }
    .compact-actions {
      margin-top: 6px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 5px;
    }
    .compact-more-actions {
      margin-top: 5px;
      display: none;
      grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
      gap: 5px;
    }
    .compact-more-actions.open {
      display: grid;
    }
    button.action.compact-action {
      font-size: 11px;
      padding: 4px 6px;
      min-height: 28px;
      border-radius: 7px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
      gap: 8px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card);
      padding: 9px;
      backdrop-filter: blur(2px);
    }
    .card h3 {
      margin: 0 0 7px 0;
      font-size: 12px;
      letter-spacing: 0.3px;
      color: #c0f0d3;
      text-transform: uppercase;
    }
    .kv {
      margin: 0;
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 8px;
      row-gap: 4px;
    }
    .kv dt { color: var(--muted); }
    .kv dd { margin: 0; }
    ul.list {
      margin: 0;
      padding-left: 16px;
      max-height: 220px;
      overflow: auto;
    }
    ul.list li { margin: 3px 0; }
    li.empty { color: var(--muted); list-style: none; margin-left: -16px; }
    .hint {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
    }
    .handoff-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 9px;
      margin-bottom: 6px;
    }
    .handoff-card-summary {
      font-size: 12px;
      font-weight: 600;
    }
    .handoff-card-meta {
      color: var(--muted);
      font-size: 11px;
      margin-top: 3px;
    }
    .handoff-card-actions {
      display: flex;
      gap: 5px;
      margin-top: 6px;
    }
    .handoff-card-actions button {
      font-size: 11px;
      padding: 3px 7px;
      border-radius: 6px;
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      cursor: pointer;
    }
    .handoff-card-actions button:hover {
      border-color: #6adf9a;
    }
    .status-pill {
      display: inline-block;
      border-radius: 8px;
      padding: 1px 6px;
      border: 1px solid var(--line);
      margin-left: 5px;
      font-size: 11px;
      color: #d8ffe8;
    }
    .status-pass { border-color: #29ca72; color: #8df2b7; }
    .status-fail { border-color: #ff6c74; color: #ffb2b6; }
    .status-setup { border-color: #ffcf5a; color: #ffe08a; }
    .status-unknown { border-color: #888; color: #c9c9c9; }
    .action-center {
      margin-bottom: 10px;
    }
    .action-live {
      border-left: 3px solid #49cc83;
      padding-left: 8px;
      margin-bottom: 7px;
    }
    .action-live.running { border-left-color: #ffb347; }
    .action-live.error { border-left-color: #ff6c74; }
    .action-title {
      font-weight: 700;
      margin-bottom: 2px;
    }
    .checklist {
      margin: 8px 0 0 0;
      padding-left: 0;
      list-style: none;
    }
    .checklist li {
      margin: 4px 0;
      color: var(--muted);
    }
    .checklist li.done {
      color: #8df2b7;
    }
    .recovery {
      margin-top: 8px;
      display: none;
      gap: 6px;
      flex-wrap: wrap;
    }
    .recovery.visible {
      display: flex;
    }
    button.recovery-action {
      border: 1px solid var(--line);
      background: rgba(11, 29, 18, 0.82);
      color: var(--text);
      border-radius: 8px;
      padding: 5px 8px;
      font: inherit;
      cursor: pointer;
    }
    button.recovery-action:hover {
      border-color: #6adf9a;
      background: rgba(15, 40, 24, 0.9);
    }
    body[data-view-mode="compact"] .full-panel {
      display: none;
    }
    body[data-view-mode="full"] .compact-panel {
      display: none;
    }
  </style>
</head>
<body data-state="ready" data-view-mode="compact">
  <canvas id="matrix"></canvas>
  <div class="backdrop"></div>
  <div class="app">
    <div class="top">
      <div class="title">AgentSync Live</div>
      <span id="stateBadge" class="badge ready">READY</span>
      <span id="statePulse" class="pulse">[idle]</span>
      <span id="workspaceName" class="pulse"></span>
      <button id="modeToggle" class="mode-toggle" data-role="mode-toggle">Show Full</button>
    </div>

    <section id="compactPanel" class="card compact-panel">
      <h3>Current Focus</h3>
      <div id="compactFocus" class="compact-focus">No active goal</div>
      <ul id="compactTasks" class="compact-task-list"></ul>
      <div id="compactMoreCount" class="compact-more-count"></div>
      <div class="compact-actions">
        <button class="action compact-action" data-command="agentsync.startSession">Start Session</button>
        <button class="action compact-action" data-command="agentsync.endSession">End Session</button>
        <button class="action compact-action" data-command="agentsync.clearActiveSession">Clear Active Session</button>
        <button class="action compact-action" data-command="agentsync.openTracker">Open AgentTracker</button>
        <button class="action compact-action" data-role="compact-more-toggle">More</button>
      </div>
      <div id="compactMoreActions" class="compact-more-actions">
        <button class="action compact-action" data-command="agentsync.init">Initialize Workspace</button>
        <button class="action compact-action" data-command="agentsync.openHandoffs">Open Handoffs JSON</button>
        <button class="action compact-action" data-command="agentsync.contextCapsule">Generate Context Capsule</button>
        <button class="action compact-action" data-command="agentsync.syncAgencyRuns">Sync Agency Runs</button>
        <button class="action compact-action" data-command="agentsync.contextStatus">Context Status</button>
        <button class="action compact-action" data-command="agentsync.openTutorial">Open Walkthrough</button>
        <button class="action compact-action" data-command="agentsync.openDocs">Open Web Docs</button>
        <button class="action compact-action" data-command="agentsync.refreshPanel">Refresh</button>
      </div>
    </section>

    <div id="fullPanel" class="full-panel">
      <div class="actions">
        <button class="action" data-command="agentsync.init">Initialize Workspace</button>
        <button class="action" data-command="agentsync.startSession">Start Session</button>
        <button class="action" data-command="agentsync.endSession">End Session</button>
        <button class="action" data-command="agentsync.clearActiveSession">Clear Active Session</button>
        <button class="action" data-command="agentsync.openTracker">Open AgentTracker</button>
        <button class="action" data-command="agentsync.openHandoffs">Open Handoffs JSON</button>
        <button class="action" data-command="agentsync.contextCapsule">Generate Context Capsule</button>
        <button class="action" data-command="agentsync.syncAgencyRuns">Sync Agency Runs</button>
        <button class="action" data-command="agentsync.contextStatus">Context Status</button>
        <button class="action" data-command="agentsync.openTutorial">Open Walkthrough</button>
        <button class="action" data-command="agentsync.refreshPanel">Refresh</button>
      </div>

      <section class="card action-center">
        <h3>Action Center</h3>
        <div id="actionLive" class="action-live">
          <div id="actionTitle" class="action-title">Idle</div>
          <div id="actionDetail">Choose an action to begin.</div>
        </div>
        <div id="recoveryActions" class="recovery">
          <button class="recovery-action" data-command="agentsync.openTracker">Open Tracker</button>
          <button class="recovery-action" data-command="agentsync.refreshPanel">Refresh</button>
        </div>
        <dl class="kv">
          <dt>Next step</dt><dd id="nextStep">-</dd>
          <dt>Last update</dt><dd id="actionUpdated">-</dd>
          <dt>Data refreshed</dt><dd id="dataRefreshed">-</dd>
        </dl>
        <ul id="onboardingList" class="checklist"></ul>
      </section>

      <div class="grid">
        <section class="card">
          <h3>Overview</h3>
          <dl class="kv">
            <dt>State</dt><dd id="stateText">-</dd>
            <dt>Reason</dt><dd id="stateReason">-</dd>
            <dt>Open handoffs</dt><dd id="openHandoffs">0</dd>
            <dt>In progress</dt><dd id="inProgressCount">0</dd>
          </dl>
        </section>

        <section class="card">
          <h3>Session</h3>
          <dl class="kv">
            <dt>Active</dt><dd id="sessionActive">No</dd>
            <dt>Provider</dt><dd id="sessionProvider">None</dd>
            <dt>Personality</dt><dd id="sessionPersonality">None</dd>
            <dt>Goal</dt><dd id="sessionGoal">No active goal</dd>
            <dt>Started</dt><dd id="sessionStarted">-</dd>
          </dl>
        </section>

        <section class="card">
          <h3>Health</h3>
          <ul id="healthList" class="list"></ul>
        </section>

        <section class="card">
          <h3>Handoffs</h3>
          <div><strong>Assigned to me</strong></div>
          <ul id="handoffAssigned" class="list"></ul>
          <div style="margin-top: 6px;"><strong>Shared with me</strong></div>
          <ul id="handoffShared" class="list"></ul>
          <div style="margin-top: 6px;"><strong>Blocked / stale</strong></div>
          <ul id="handoffBlocked" class="list"></ul>
        </section>

        <section class="card" id="queuedHandoffsSection">
          <h3>Runnable Now</h3>
          <div id="queuedHandoffsList"></div>
        </section>

        <section class="card">
          <h3>Tracker</h3>
          <dl class="kv">
            <dt>Last agent</dt><dd id="lastAgent">-</dd>
            <dt>Last date</dt><dd id="lastDate">-</dd>
            <dt>Branch</dt><dd id="branch">-</dd>
            <dt>Commit</dt><dd id="commit">-</dd>
          </dl>
        </section>

        <section class="card">
          <h3>Personality Catalog</h3>
          <div id="agentCatalogSection"></div>
        </section>

        <section class="card">
          <h3>Pipelines</h3>
          <div id="pipelinesSection"></div>
        </section>

        <section class="card">
          <h3>Warnings</h3>
          <ul id="warningsList" class="list"></ul>
        </section>
      </div>
      <div class="hint">Tip: this live view auto-refreshes from AgentTracker + .agentsync files.</div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let pendingCommand = null;
    let lastActionAt = null;
    let currentViewMode = 'compact';
    let compactMoreOpen = false;

    const commandLabels = {
      'agentsync.init': 'Initialize Workspace',
      'agentsync.startSession': 'Start Session',
      'agentsync.runNextStep': 'Run Next Step',
      'agentsync.endSession': 'End Session',
      'agentsync.clearActiveSession': 'Clear Active Session',
      'agentsync.openTracker': 'Open AgentTracker',
      'agentsync.openConfig': 'Open .agentsync.json',
      'agentsync.openHandoffs': 'Open Handoffs JSON',
      'agentsync.contextCapsule': 'Generate Context Capsule',
      'agentsync.syncAgencyRuns': 'Sync Agency Runs',
      'agentsync.detectCommands': 'Detect Commands',
      'agentsync.contextStatus': 'Context Status',
      'agentsync.openTutorial': 'Open Walkthrough',
      'agentsync.openDocs': 'Open Web Docs',
      'agentsync.refreshPanel': 'Refresh'
    };
    const commandColors = {
      'agentsync.init': '#4fb3ff',
      'agentsync.startSession': '#1fd678',
      'agentsync.runNextStep': '#7fd8ff',
      'agentsync.endSession': '#ffb347',
      'agentsync.clearActiveSession': '#ff6c74',
      'agentsync.openTracker': '#8ab4ff',
      'agentsync.openConfig': '#8ab4ff',
      'agentsync.openHandoffs': '#8ab4ff',
      'agentsync.contextCapsule': '#7fd8ff',
      'agentsync.syncAgencyRuns': '#7ccf8a',
      'agentsync.detectCommands': '#ffcf5a',
      'agentsync.contextStatus': '#c59cff',
      'agentsync.openTutorial': '#8ab4ff',
      'agentsync.openDocs': '#8ab4ff',
      'agentsync.refreshPanel': '#3dd6d0'
    };

    function byId(id) {
      return document.getElementById(id);
    }

    function setText(id, value) {
      const el = byId(id);
      if (el) el.textContent = value == null ? '-' : String(value);
    }

    function formatTime(value) {
      if (!value) return '-';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleTimeString();
    }

    function normalizeMode(mode) {
      return mode === 'full' ? 'full' : 'compact';
    }

    function setViewMode(mode) {
      currentViewMode = normalizeMode(mode);
      document.body.dataset.viewMode = currentViewMode;
      const toggle = byId('modeToggle');
      if (toggle) {
        toggle.textContent = currentViewMode === 'compact' ? 'Show Full' : 'Show Compact';
      }
    }

    function setCompactMoreOpen(nextOpen) {
      compactMoreOpen = Boolean(nextOpen);
      const moreActions = byId('compactMoreActions');
      if (moreActions) {
        moreActions.classList.toggle('open', compactMoreOpen);
      }
      const toggle = document.querySelector('[data-role="compact-more-toggle"]');
      if (toggle) {
        toggle.textContent = compactMoreOpen ? 'Less' : 'More';
      }
    }

    function toRgba(hex, alpha) {
      const normalized = String(hex || '').trim().replace('#', '');
      if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(normalized)) {
        return 'rgba(200, 210, 216, ' + alpha + ')';
      }
      const expanded = normalized.length === 3
        ? normalized.split('').map((c) => c + c).join('')
        : normalized;
      const r = parseInt(expanded.slice(0, 2), 16);
      const g = parseInt(expanded.slice(2, 4), 16);
      const b = parseInt(expanded.slice(4, 6), 16);
      return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
    }

    function getCommandColor(command) {
      return commandColors[command] || '#c8d2d8';
    }

    function renderShortcuts(shortcuts) {
      const makeButton = (cmd) => {
        const btn = document.createElement('button');
        btn.className = 'action';
        btn.setAttribute('data-command', cmd);
        const fallbackLabel = cmd.includes('.') ? cmd.slice(cmd.lastIndexOf('.') + 1) : cmd;
        btn.textContent = commandLabels[cmd] || fallbackLabel;
        const color = getCommandColor(cmd);
        btn.style.setProperty('--button-color', color);
        return btn;
      };
      const compactContainer = document.querySelector('.compact-actions');
      const fullContainer = document.querySelector('.actions');
      [compactContainer, fullContainer].forEach((container) => {
        if (!container) return;
        container.innerHTML = '';
        shortcuts.forEach((cmd) => {
          const btn = makeButton(cmd);
          container.appendChild(btn);
        });
      });
    }

    function clearActiveCommandHighlight() {
      const highlighted = document.querySelectorAll('button.action.active-command, button.recovery-action.active-command');
      highlighted.forEach((button) => {
        button.classList.remove('active-command');
        button.style.removeProperty('--active-command-color');
        button.style.removeProperty('--active-command-bg');
      });
    }

    function setActiveCommandHighlight(command) {
      clearActiveCommandHighlight();
      const color = getCommandColor(command);
      const tint = toRgba(color, 0.18);
      const targets = document.querySelectorAll('[data-command="' + command + '"]');
      targets.forEach((target) => {
        if (!(target instanceof HTMLElement)) return;
        if (!target.matches('button.action, button.recovery-action')) return;
        target.classList.add('active-command');
        target.style.setProperty('--active-command-color', color);
        target.style.setProperty('--active-command-bg', tint);
      });
    }

    function formatCompactTask(value) {
      const text = String(value || '').replace(/\\s+/g, ' ').trim();
      if (!text) return '-';
      if (text.length <= 90) return text;
      return text.slice(0, 89) + '...';
    }

    function setActionVisual(state, title, detail) {
      const live = byId('actionLive');
      if (live) {
        live.classList.remove('running', 'error');
        if (state === 'running') live.classList.add('running');
        if (state === 'error') live.classList.add('error');
      }
      setText('actionTitle', title);
      setText('actionDetail', detail);
      setText('actionUpdated', formatTime(lastActionAt));
    }

    function setRecoveryVisible(isVisible) {
      const el = byId('recoveryActions');
      if (!el) return;
      el.classList.toggle('visible', Boolean(isVisible));
    }

    function setActionsBusy(isBusy) {
      const actionContainers = document.querySelectorAll('.actions, .compact-actions, .compact-more-actions');
      actionContainers.forEach((container) => {
        container.classList.toggle('busy', Boolean(isBusy));
      });

      const buttons = document.querySelectorAll('button.action[data-command], button.recovery-action[data-command]');
      buttons.forEach((button) => {
        const command = button.getAttribute('data-command');
        const keepEnabled = command === 'agentsync.refreshPanel';
        button.disabled = isBusy && !keepEnabled;
      });
    }

    function renderList(id, items, format, emptyLabel) {
      const el = byId(id);
      if (!el) return;
      el.innerHTML = '';
      if (!items || items.length === 0) {
        const li = document.createElement('li');
        li.className = 'empty';
        li.textContent = emptyLabel;
        el.appendChild(li);
        return;
      }
      items.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = format(item);
        el.appendChild(li);
      });
    }

    function healthClass(status) {
      const normalized = String(status || '').toLowerCase();
      if (normalized === 'pass') return 'status-pass';
      if (normalized === 'fail') return 'status-fail';
      if (normalized === 'not configured') return 'status-setup';
      return 'status-unknown';
    }

    function renderHealth(health) {
      const rows = [
        { name: 'Build', status: health.Build },
        { name: 'Tests', status: health.Tests },
        { name: 'Deploy', status: health.Deploy }
      ];
      const el = byId('healthList');
      if (!el) return;
      el.innerHTML = '';
      var needsSetup = false;
      rows.forEach((row) => {
        const li = document.createElement('li');
        const pill = document.createElement('span');
        pill.className = 'status-pill ' + healthClass(row.status);
        const normalized = String(row.status || '');
        if (normalized === 'Not configured') needsSetup = true;
        pill.textContent = normalized === 'Not configured' ? 'Setup needed' : row.status;
        li.textContent = row.name + ': ';
        li.appendChild(pill);
        el.appendChild(li);
      });
      if (needsSetup) {
        const hint = document.createElement('li');
        hint.textContent = 'Configure build/test/deploy commands to unlock end-session health checks.';
        el.appendChild(hint);

        const actions = document.createElement('li');
        actions.style.listStyle = 'none';
        actions.style.marginLeft = '-16px';
        actions.style.marginTop = '6px';

        var detectBtn = document.createElement('button');
        detectBtn.className = 'action compact-action';
        detectBtn.textContent = 'Detect Commands';
        detectBtn.setAttribute('data-command', 'agentsync.detectCommands');
        actions.appendChild(detectBtn);

        var openBtn = document.createElement('button');
        openBtn.className = 'action compact-action';
        openBtn.style.marginLeft = '6px';
        openBtn.textContent = 'Open .agentsync.json';
        openBtn.setAttribute('data-command', 'agentsync.openConfig');
        actions.appendChild(openBtn);

        el.appendChild(actions);
      }
    }

    function formatHandoff(item) {
      return item.id + ' | ' + item.summary + ' (' + item.status + ', ' + item.mode + ')';
    }

    function renderQueuedHandoffs(handoffs) {
      const container = byId('queuedHandoffsList');
      if (!container) return;
      container.innerHTML = '';
      if (!handoffs || handoffs.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.style.cssText = 'color:var(--muted);font-size:12px;margin:4px 0;';
        empty.textContent = 'No runnable queued handoffs for this provider.';
        container.appendChild(empty);
        return;
      }
      handoffs.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'handoff-card';

        const summaryEl = document.createElement('div');
        summaryEl.className = 'handoff-card-summary';
        summaryEl.textContent = item.summary;
        card.appendChild(summaryEl);

        const metaEl = document.createElement('div');
        metaEl.className = 'handoff-card-meta';
        metaEl.textContent = 'From: ' + item.from_agent + ' | Provider: ' + item.to_agents_display + ' | Files: ' + item.files_display;
        card.appendChild(metaEl);

        const personalityEl = document.createElement('div');
        personalityEl.className = 'handoff-card-meta';
        personalityEl.textContent = 'Personality: ' + item.personality;
        card.appendChild(personalityEl);

        if (item.recommended_model_tier) {
          const tierEl = document.createElement('span');
          tierEl.style.cssText = 'display:inline-block;padding:1px 6px;border-radius:3px;font-size:0.75em;margin-top:4px;' +
            (item.recommended_model_tier === 'lead' ? 'background:#ffb347;color:#1a1a1a;' : 'background:#3dd6d0;color:#1a1a1a;');
          tierEl.textContent = item.recommended_model_tier === 'lead' ? 'Lead Model' : 'Worker Model';
          if (item.model_justification) tierEl.title = item.model_justification;
          card.appendChild(tierEl);
        }

        if (item.stale_observation) {
          const staleEl = document.createElement('div');
          staleEl.style.cssText = 'background: #ffb347; color: #1a1a1a; padding: 2px 6px; border-radius: 3px; font-size: 0.75em; margin-top: 4px;';
          staleEl.textContent = '\u26A0 Context may be outdated \u2014 re-read these files';
          card.appendChild(staleEl);
        }

        if (item.notes) {
          const notesEl = document.createElement('div');
          notesEl.className = 'handoff-card-meta';
          notesEl.textContent = 'Notes: ' + item.notes;
          card.appendChild(notesEl);
        }

        const actions = document.createElement('div');
        actions.className = 'handoff-card-actions';

        const claimBtn = document.createElement('button');
        claimBtn.textContent = 'Claim';
        claimBtn.setAttribute('data-handoff-action', 'claim');
        claimBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(claimBtn);

        const startBtn = document.createElement('button');
        startBtn.textContent = 'Start';
        startBtn.setAttribute('data-handoff-action', 'start');
        startBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(startBtn);

        const skipBtn = document.createElement('button');
        skipBtn.textContent = 'Skip';
        skipBtn.setAttribute('data-handoff-action', 'skip');
        skipBtn.setAttribute('data-handoff-id', item.id);
        actions.appendChild(skipBtn);

        card.appendChild(actions);
        container.appendChild(card);
      });
    }

    function renderCompactSummary(compactModel) {
      setText('compactFocus', compactModel.focusText || 'No active goal');
      const compactTasks = Array.isArray(compactModel.tasks) ? compactModel.tasks : [];
      renderList('compactTasks', compactTasks, (item) => formatCompactTask(item), 'No in-progress tasks');
      const count = Number(compactModel.extraTaskCount) || 0;
      const countEl = byId('compactMoreCount');
      if (countEl) {
        countEl.textContent = count > 0 ? '+' + count + ' more task' + (count === 1 ? '' : 's') : '';
      }
    }

    function renderOnboarding(onboarding) {
      const el = byId('onboardingList');
      if (!el) return;
      const stepRows = [
        {
          done: Boolean(onboarding && onboarding.initialized),
          label: '1. Initialize workspace'
        },
        {
          done: Boolean(onboarding && onboarding.started),
          label: '2. Start first session'
        },
        {
          done: Boolean(onboarding && onboarding.ended),
          label: '3. End session and hand off'
        }
      ];
      el.innerHTML = '';
      stepRows.forEach((row) => {
        const li = document.createElement('li');
        li.className = row.done ? 'done' : '';
        li.textContent = (row.done ? '[x] ' : '[ ] ') + row.label;
        el.appendChild(li);
      });
    }

    function getRunningHint(command, label) {
      if (command === 'agentsync.startSession') {
        return 'You may see prompts for provider and goal. Fill those in, then wait for completion.';
      }
      if (command === 'agentsync.runNextStep') {
        return 'AgentSync is claiming the next step, activating the suggested personality, and copying the prompt.';
      }
      if (command === 'agentsync.endSession') {
        return 'You may see prompts for summary and next work. Complete them, then wait for confirmation.';
      }
      if (command === 'agentsync.init') {
        return 'AgentSync files are being created now. You will see completion once file writes finish.';
      }
      return 'Watch for prompts in VS Code. This view will update when complete.';
    }

    function getFailureHint(command, message) {
      const base = message || 'The command failed.';
      if (command === 'agentsync.startSession' || command === 'agentsync.endSession') {
        return base + ' Open Tracker to review required fields, then try again.';
      }
      if (command === 'agentsync.init') {
        return base + ' Check workspace permissions and try Initialize Workspace again.';
      }
      return base + ' Try Refresh. If it persists, open AgentTracker for context.';
    }

    function renderAgentCatalog(catalog) {
      const el = byId('agentCatalogSection');
      if (!el) return;
      el.innerHTML = '';
      if (!catalog || !catalog.loaded || catalog.totalAgents === 0) {
        const empty = document.createElement('p');
        empty.style.cssText = 'color:var(--muted);font-size:12px;margin:4px 0;';
        empty.textContent = 'Agent catalog not loaded.';
        el.appendChild(empty);
        return;
      }

      const header = document.createElement('div');
      header.style.cssText = 'margin-bottom:6px;font-size:12px;color:var(--muted);';
      header.textContent = catalog.totalAgents + ' LLM-agnostic personalities available';
      el.appendChild(header);

      const badgeContainer = document.createElement('div');
      badgeContainer.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
      (catalog.categories || []).forEach(function(cat) {
        const badge = document.createElement('span');
        badge.style.cssText = 'display:inline-block;padding:2px 7px;border-radius:10px;font-size:11px;font-weight:600;' +
          'background:' + cat.color + '22;color:' + cat.color + ';border:1px solid ' + cat.color + '44;';
        badge.textContent = cat.name + ' (' + cat.count + ')';
        badge.title = cat.name + ': ' + cat.count + ' agent(s)';
        badgeContainer.appendChild(badge);
      });
      el.appendChild(badgeContainer);

      const actions = document.createElement('div');
      actions.style.cssText = 'margin-top:6px;display:flex;gap:6px;';

      var browseBtn = document.createElement('button');
      browseBtn.className = 'action compact-action';
      browseBtn.textContent = 'Browse Personalities';
      browseBtn.setAttribute('data-command', 'agentsync.browseAgents');
      actions.appendChild(browseBtn);

      var runBtn = document.createElement('button');
      runBtn.className = 'action compact-action';
      runBtn.textContent = 'Run with Personality';
      runBtn.setAttribute('data-command', 'agentsync.runWithAgent');
      actions.appendChild(runBtn);

      var pipelineBtn = document.createElement('button');
      pipelineBtn.className = 'action compact-action';
      pipelineBtn.textContent = 'Create Pipeline';
      pipelineBtn.setAttribute('data-command', 'agentsync.createPipeline');
      actions.appendChild(pipelineBtn);

      el.appendChild(actions);
    }

    function renderPipelines(pipelines) {
      var el = byId('pipelinesSection');
      if (!el) return;
      el.innerHTML = '';
      if (!pipelines || pipelines.length === 0) {
        var empty = document.createElement('p');
        empty.style.cssText = 'color:var(--muted);font-size:12px;margin:4px 0;';
        empty.textContent = 'No active pipelines.';
        el.appendChild(empty);
        return;
      }

      pipelines.forEach(function(pipeline) {
        var row = document.createElement('div');
        row.style.cssText = 'margin-bottom:8px;';

        var label = document.createElement('div');
        label.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:4px;';
        label.textContent = 'Chain: ' + pipeline.chainId;
        row.appendChild(label);

        var stepsContainer = document.createElement('div');
        stepsContainer.style.cssText = 'display:flex;align-items:center;gap:2px;flex-wrap:wrap;';

        pipeline.steps.forEach(function(step, idx) {
          var stepEl = document.createElement('div');
          var statusColors = {
            blocked: '#666',
            queued: '#ffb347',
            in_progress: '#3b82f6',
            merged: '#22c55e',
            approved: '#22c55e',
            ready_for_review: '#a855f7'
          };
          var bg = statusColors[step.status] || '#666';
          stepEl.style.cssText = 'display:inline-flex;align-items:center;padding:3px 8px;border-radius:6px;font-size:11px;' +
            'background:' + bg + '22;color:' + bg + ';border:1px solid ' + bg + '44;cursor:default;';
          stepEl.textContent = step.step + '. ' + (step.agentName || '').split('/').pop();
          stepEl.title = step.summary + ' (' + step.status + ')';
          stepsContainer.appendChild(stepEl);

          if (idx < pipeline.steps.length - 1) {
            var arrow = document.createElement('span');
            arrow.style.cssText = 'color:var(--muted);font-size:12px;margin:0 2px;';
            arrow.textContent = '\u2192';
            stepsContainer.appendChild(arrow);
          }
        });

        row.appendChild(stepsContainer);
        el.appendChild(row);
      });
    }

    function render(model) {
      if (!model || !model.hasWorkspace) {
        setViewMode('compact');
        setCompactMoreOpen(false);
        clearActiveCommandHighlight();
        setActionsBusy(false);
        renderShortcuts([]);
        setText('stateText', 'No workspace open');
        setText('nextStep', 'Open a folder/workspace to use AgentSync.');
        setText('compactFocus', 'No workspace open');
        renderList('compactTasks', [], (item) => formatCompactTask(item), 'No in-progress tasks');
        setText('compactMoreCount', '');
        return;
      }

      setViewMode(model.ui && model.ui.viewMode);
      renderShortcuts(model.shortcuts || []);

      document.body.dataset.state = model.state.key;
      const badge = byId('stateBadge');
      if (badge) {
        badge.className = 'badge ' + model.state.key;
        badge.textContent = String(model.state.label || '').toUpperCase();
      }
      setText('statePulse', model.state.pulse);
      setText('workspaceName', model.workspace);

      setText('stateText', model.state.label);
      setText('stateReason', model.state.reason);
      setText('openHandoffs', model.handoffs.openCount);
      setText('inProgressCount', model.inProgress.length);
      setText('nextStep', model.nextStep || '-');
      setText('dataRefreshed', formatTime(model.refreshedAt));
      renderCompactSummary(model.compact || {});

      setText('sessionActive', model.session.active ? 'Yes' : 'No');
      setText('sessionProvider', model.session.provider);
      setText('sessionPersonality', model.session.personality);
      setText('sessionGoal', model.session.goal);
      setText('sessionStarted', model.session.startedAt ? new Date(model.session.startedAt).toLocaleString() : '-');
      renderOnboarding(model.onboarding || {});

      setText('lastAgent', model.tracker.lastAgent);
      setText('lastDate', model.tracker.lastDate);
      setText('branch', model.tracker.branch);
      setText('commit', model.tracker.commit);

      renderHealth(model.health);
      renderList('handoffAssigned', model.handoffs.assignedToMe, formatHandoff, 'No direct assignments');
      renderList('handoffShared', model.handoffs.sharedWithMe, formatHandoff, 'No shared assignments');
      renderList('handoffBlocked', model.handoffs.blockedOrStale, formatHandoff, 'No blocked/stale handoffs');
      renderQueuedHandoffs(model.handoffs.queued || []);
      renderAgentCatalog(model.agentCatalog || {});
      renderPipelines(model.pipelines || []);
      renderList('warningsList', model.warnings, (w) => w, 'No warnings');

      if (!pendingCommand) {
        clearActiveCommandHighlight();
        const statusLabel = model.state && model.state.label ? model.state.label : 'Idle';
        setActionVisual('ok', 'Idle', 'Current state: ' + statusLabel + '.');
        setRecoveryVisible(false);
      }
    }

    window.addEventListener('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'model') render(msg.model);
      if (msg.type === 'action') {
        const stage = String(msg.stage || '');
        const command = String(msg.command || '');
        const label = commandLabels[command] || command || 'Action';
        lastActionAt = msg.timestamp || new Date().toISOString();

        if (stage === 'started') {
          pendingCommand = command;
          setActionsBusy(true);
          setActiveCommandHighlight(command);
          setActionVisual(
            'running',
            'Running: ' + label,
            getRunningHint(command, label)
          );
          setRecoveryVisible(false);
          return;
        }

        if (stage === 'completed') {
          pendingCommand = null;
          setActionsBusy(false);
          clearActiveCommandHighlight();
          setActionVisual('ok', 'Completed: ' + label, 'Action finished successfully.');
          setRecoveryVisible(false);
          return;
        }

        if (stage === 'failed') {
          pendingCommand = null;
          setActionsBusy(false);
          clearActiveCommandHighlight();
          setActionVisual('error', 'Failed: ' + label, getFailureHint(command, msg.error || ''));
          setRecoveryVisible(true);
        }
      }
    });

    document.addEventListener('click', (event) => {
      const modeToggle = event.target.closest('[data-role="mode-toggle"]');
      if (modeToggle) {
        const next = currentViewMode === 'compact' ? 'full' : 'compact';
        vscode.postMessage({ type: 'ui', action: 'setMode', mode: next });
        return;
      }

      const moreToggle = event.target.closest('[data-role="compact-more-toggle"]');
      if (moreToggle) {
        setCompactMoreOpen(!compactMoreOpen);
        return;
      }

      // Handoff card action buttons (Claim / Start / Skip)
      const handoffBtn = event.target.closest('[data-handoff-action]');
      if (handoffBtn) {
        const action = handoffBtn.getAttribute('data-handoff-action');
        const handoffId = handoffBtn.getAttribute('data-handoff-id');
        if (action && handoffId) {
          vscode.postMessage({ type: 'handoff-action', action, handoffId });
        }
        return;
      }

      const target = event.target.closest('[data-command]');
      if (!target) return;
      const command = target.getAttribute('data-command');
      if (!command) return;
      if (pendingCommand && command !== 'agentsync.refreshPanel') return;
      vscode.postMessage({ command });
    });

    (function startMatrix() {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const canvas = byId('matrix');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const chars = '01ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*+-';
      const fontSize = 14;
      let cols = 0;
      let drops = [];

      const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        cols = Math.max(1, Math.floor(canvas.width / fontSize));
        drops = Array(cols).fill(1);
      };

      const draw = () => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#20f080';
        ctx.font = fontSize + 'px monospace';
        for (let i = 0; i < drops.length; i += 1) {
          const text = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillText(text, i * fontSize, drops[i] * fontSize);
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
          drops[i] += 1;
        }
      };

      resize();
      window.addEventListener('resize', resize);
      setInterval(draw, 60);
    })();

    setViewMode('compact');
    setCompactMoreOpen(false);
    vscode.postMessage({ command: 'agentsync.refreshPanel' });
  </script>
</body>
</html>`;
    }
    module2.exports = { getDashboardHtml };
  }
});

// src/dashboard/handoffActions.js
var require_handoffActions = __commonJS({
  "src/dashboard/handoffActions.js"(exports2, module2) {
    "use strict";
    var vscode2 = require("vscode");
    var SessionManager2 = require_SessionManager();
    var { EXECUTION_PROVIDER_DEFS: EXECUTION_PROVIDER_DEFS2, getSessionProviderInfo: getSessionProviderInfo2, getExecutionProviderId: getExecutionProviderId2, getExecutionProviderLabel: getExecutionProviderLabel2 } = require_providers();
    var { getPersonalityDisplayName: getPersonalityDisplayName2 } = require_personalities();
    var { PLACEHOLDER: PLACEHOLDER2 } = require_constants();
    var { toSingleLine: toSingleLine2, canonicalAgentId: canonicalAgentId2 } = require_text();
    var { readStateFile: readStateFile2, writeStateFile: writeStateFile2, readHandoffs: readHandoffs2, writeHandoffs: writeHandoffs2 } = require_storage();
    var {
      claimHandoffRecord: claimHandoffRecord2,
      syncTrackerHandoffsSection: syncTrackerHandoffsSection2,
      getHandoffPersonalityId
    } = require_handoffs();
    var {
      assembleAgentPrompt: assembleAgentPrompt2,
      deliverPrompt: deliverPrompt2,
      injectPersonalityToWorkspace: injectPersonalityToWorkspace2
    } = require_executionChannels();
    var { buildSessionIdentity: buildSessionIdentity2 } = require_session();
    var { getAgentCatalog: getAgentCatalog2, matchAgentsByCapabilities: matchAgentsByCapabilities2 } = require_agentCatalog();
    async function promptForAgent2(defaultAgent) {
      const defaultLabel = getExecutionProviderLabel2(defaultAgent) || "Codex";
      const builtIn = EXECUTION_PROVIDER_DEFS2.map((provider) => ({
        label: provider.label,
        description: provider.label === defaultLabel ? "default" : void 0
      }));
      const choice = await vscode2.window.showQuickPick(
        [...builtIn, { label: "Other" }],
        { placeHolder: "Select the execution provider for this session" }
      );
      if (!choice) return null;
      if (choice.label !== "Other") return choice.label;
      const custom = await vscode2.window.showInputBox({
        prompt: "Enter provider name",
        value: defaultLabel !== "Codex" ? defaultLabel : ""
      });
      if (custom === void 0) return null;
      const trimmed = custom.trim();
      return trimmed || null;
    }
    function updateActiveSessionContext2(workspaceFolder, updates = {}) {
      const state = readStateFile2(workspaceFolder) || {};
      if (!state?.sessionActive || !state?.activeSession) return null;
      const nextSession = {
        ...state.activeSession,
        ...updates
      };
      writeStateFile2(workspaceFolder, {
        ...state,
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        activeSession: nextSession
      });
      return nextSession;
    }
    function updateHandoffPromptCopiedFlag2(workspaceFolder, handoffId, copied) {
      const normalizedId = toSingleLine2(handoffId);
      if (!normalizedId) return;
      const store = readHandoffs2(workspaceFolder);
      if (!store.handoffs.length) return;
      const next = store.handoffs.map((handoff) => {
        if (toSingleLine2(handoff?.handoff_id) !== normalizedId) return handoff;
        return {
          ...handoff,
          prompt_copied_to_clipboard: copied === true,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
      });
      writeHandoffs2(workspaceFolder, { version: 1, handoffs: next });
    }
    function resolveHandoffPersonality2(workspaceFolder, handoff, overridePersonalityId = null) {
      const catalog = getAgentCatalog2(workspaceFolder);
      if (!catalog || !Array.isArray(catalog.agents) || catalog.agents.length === 0) return null;
      const explicitId = canonicalAgentId2(overridePersonalityId || getHandoffPersonalityId(handoff));
      if (explicitId) {
        const direct = catalog.agents.find((agent) => canonicalAgentId2(agent.id) === explicitId);
        if (direct) return direct;
      }
      const matched = matchAgentsByCapabilities2(catalog.agents, handoff?.required_capabilities || []);
      return matched[0] || null;
    }
    function buildHandoffExecutionInstruction2(handoff) {
      const lines = [String(handoff?.summary || "Continue the queued work").trim()];
      if (handoff?.notes) {
        lines.push("", "Notes:", String(handoff.notes).trim());
      }
      if (Array.isArray(handoff?.files) && handoff.files.length > 0) {
        lines.push("", "Start with these files:");
        handoff.files.forEach((file) => lines.push("- " + file));
      }
      if (handoff?.branch || handoff?.commit) {
        lines.push("", `Branch: ${handoff?.branch || PLACEHOLDER2}`);
        lines.push(`Commit: ${handoff?.commit || PLACEHOLDER2}`);
      }
      return lines.join("\n");
    }
    async function runHandoffStep2(workspaceFolder, handoff, providerLabel, options = {}) {
      const providerId = getExecutionProviderId2(providerLabel);
      const providerDisplay = getExecutionProviderLabel2(providerLabel) || String(providerLabel || "Unknown");
      const normalizedHandoffId = toSingleLine2(handoff?.handoff_id);
      const result = claimHandoffRecord2(workspaceFolder, normalizedHandoffId, providerDisplay);
      if (!result.ok) {
        vscode2.window.showWarningMessage(
          `AgentSync: Could not claim ${handoff?.handoff_id || "handoff"} (${result.reason || "unknown reason"}).`
        );
        return false;
      }
      syncTrackerHandoffsSection2(workspaceFolder);
      const personality = resolveHandoffPersonality2(
        workspaceFolder,
        handoff,
        options.personalityId || null
      );
      const personalityId = personality?.id || canonicalAgentId2(options.personalityId || getHandoffPersonalityId(handoff) || "") || null;
      const personalityName = personality?.name || getPersonalityDisplayName2(workspaceFolder, personalityId) || null;
      if (personality && normalizedHandoffId) {
        const store = readHandoffs2(workspaceFolder);
        const next = store.handoffs.map((entry) => {
          if (toSingleLine2(entry?.handoff_id) !== normalizedHandoffId) return entry;
          return {
            ...entry,
            suggested_agent_personality_id: personality.id,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          };
        });
        writeHandoffs2(workspaceFolder, { version: 1, handoffs: next });
      }
      if (personality) {
        injectPersonalityToWorkspace2(workspaceFolder.uri.fsPath, personality);
      }
      if (options.ensureSession) {
        SessionManager2.startSessionCore(
          workspaceFolder,
          providerDisplay,
          toSingleLine2(handoff?.summary) || "Continue queued work",
          {
            providerId,
            providerLabel: providerDisplay,
            personalityId,
            personalityName
          }
        );
      } else {
        updateActiveSessionContext2(workspaceFolder, {
          ...buildSessionIdentity2(workspaceFolder, providerDisplay, {
            providerId,
            providerLabel: providerDisplay,
            personalityId,
            personalityName
          }),
          goal: toSingleLine2(handoff?.summary) || "Continue queued work"
        });
      }
      const instruction = buildHandoffExecutionInstruction2(handoff);
      const assembledPrompt = personality ? assembleAgentPrompt2(personality, instruction, { contextFiles: handoff?.files || [] }) : ["# Task", "", instruction].join("\n");
      const delivery = await deliverPrompt2("clipboard", { vscodeEnv: vscode2.env }, assembledPrompt);
      updateHandoffPromptCopiedFlag2(workspaceFolder, handoff?.handoff_id, delivery.ok);
      if (delivery.ok) {
        const suffix = personalityName ? ` Personality: ${personalityName}.` : "";
        vscode2.window.showInformationMessage(
          `AgentSync: Next step prepared for ${providerDisplay}.${suffix} Prompt copied to clipboard.`
        );
        return true;
      }
      vscode2.window.showErrorMessage("AgentSync: Failed to copy the next-step prompt to clipboard.");
      return false;
    }
    async function handleHandoffAction(workspaceFolder, message, refreshCallback) {
      const action = String(message?.action || "").trim();
      const handoffId = toSingleLine2(message?.handoffId);
      const personalityId = toSingleLine2(message?.personalityId) || null;
      if (!action || !handoffId) return;
      const state = readStateFile2(workspaceFolder) || {};
      const activeProvider = getSessionProviderInfo2(state?.activeSession || null);
      const lastProvider = getSessionProviderInfo2(state?.lastSession || null);
      const currentProvider = activeProvider.label !== "Unknown" ? activeProvider.label : lastProvider.label;
      if (action === "claim") {
        if (!currentProvider || currentProvider === "Unknown") {
          vscode2.window.showErrorMessage("No active provider identity found to claim handoff.");
          return;
        }
        const result = claimHandoffRecord2(workspaceFolder, handoffId, currentProvider);
        if (result.ok) {
          syncTrackerHandoffsSection2(workspaceFolder);
          vscode2.window.showInformationMessage(`AgentSync: Claimed handoff ${handoffId}.`);
          if (refreshCallback) refreshCallback();
        } else {
          vscode2.window.showWarningMessage(
            `AgentSync: Could not claim ${handoffId} (${result.reason || "unknown reason"}).`
          );
        }
        return;
      }
      const { handoffs } = readHandoffs2(workspaceFolder);
      const handoff = handoffs.find((entry) => toSingleLine2(entry?.handoff_id) === handoffId);
      if (!handoff) {
        vscode2.window.showErrorMessage(`AgentSync: Handoff ${handoffId} not found.`);
        return;
      }
      if (action === "start") {
        let providerLabel = currentProvider;
        if (!state?.sessionActive) {
          providerLabel = await promptForAgent2(currentProvider || "Codex");
          if (!providerLabel) return;
        }
        await runHandoffStep2(workspaceFolder, handoff, providerLabel, {
          ensureSession: !state?.sessionActive,
          personalityId
        });
        if (refreshCallback) refreshCallback();
        return;
      }
      if (action === "skip") {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const updated = handoffs.map((entry) => {
          if (toSingleLine2(entry?.handoff_id) !== handoffId) return entry;
          return {
            ...entry,
            status: "blocked",
            updated_at: now,
            state_history: [
              ...Array.isArray(entry.state_history) ? entry.state_history : [],
              {
                status: "blocked",
                agent: canonicalAgentId2(currentProvider),
                timestamp: now,
                reason: "skipped via dashboard"
              }
            ]
          };
        });
        writeHandoffs2(workspaceFolder, { version: 1, handoffs: updated });
        syncTrackerHandoffsSection2(workspaceFolder);
        vscode2.window.showInformationMessage(`AgentSync: Handoff ${handoffId} marked as skipped.`);
        if (refreshCallback) refreshCallback();
      }
    }
    module2.exports = { handleHandoffAction };
  }
});

// src/dashboard/DashboardProvider.js
var require_DashboardProvider = __commonJS({
  "src/dashboard/DashboardProvider.js"(exports2, module2) {
    "use strict";
    var vscode2 = require("vscode");
    var { getDashboardModel } = require_dashboardModel();
    var { getDashboardHtml } = require_dashboardHtml();
    var { handleHandoffAction } = require_handoffActions();
    var AgentSyncDashboardViewProvider2 = class {
      constructor(context) {
        this._context = context;
        this._view = null;
        this._viewMode = context.globalState.get("agentsync.dashboard.viewMode", "compact");
        this._lastRefresh = 0;
      }
      resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        const workspaceFolder = vscode2.workspace.workspaceFolders?.[0];
        webviewView.webview.options = {
          enableScripts: true,
          localResourceRoots: [this._context.extensionUri]
        };
        webviewView.webview.html = getDashboardHtml(webviewView.webview, this._context.extensionUri);
        webviewView.webview.onDidReceiveMessage((message) => {
          switch (message.type) {
            case "refresh":
              this.refresh();
              break;
            case "setMode":
              this.setViewMode(message.mode);
              break;
            case "runCommand":
              if (message.command) vscode2.commands.executeCommand(message.command);
              break;
            case "handoffAction":
              if (workspaceFolder) {
                handleHandoffAction(workspaceFolder, message, () => this.refresh());
              }
              break;
            case "openFile":
              if (message.file && workspaceFolder) {
                const uri = vscode2.Uri.joinPath(workspaceFolder.uri, message.file);
                vscode2.window.showTextDocument(uri);
              }
              break;
          }
        });
        webviewView.onDidChangeVisibility(() => {
          if (webviewView.visible) this.refresh();
        });
        this.refresh();
      }
      refresh() {
        if (!this._view) return;
        const now = Date.now();
        if (now - this._lastRefresh < 250) return;
        this._lastRefresh = now;
        const workspaceFolder = vscode2.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
          this._view.webview.postMessage({ type: "update", data: { hasWorkspace: false } });
          return;
        }
        try {
          const data = getDashboardModel(workspaceFolder, this._viewMode);
          this._view.webview.postMessage({ type: "update", data });
        } catch (err) {
          console.error("[AgentSync] dashboard refresh error:", err);
          this._view.webview.postMessage({
            type: "update",
            data: { hasWorkspace: true, error: err.message }
          });
        }
      }
      setViewMode(mode) {
        this._viewMode = mode === "full" ? "full" : "compact";
        this._context.globalState.update("agentsync.dashboard.viewMode", this._viewMode);
        this.refresh();
      }
    };
    AgentSyncDashboardViewProvider2.viewType = "agentsync.dashboard";
    module2.exports = { AgentSyncDashboardViewProvider: AgentSyncDashboardViewProvider2 };
  }
});

// src/extension.js
var vscode = require("vscode");
var fs = require("fs");
var path = require("path");
var utils = require_utils();
var SessionManager = require_SessionManager();
var { AgentSyncDashboardViewProvider } = require_DashboardProvider();
var {
  // constants
  PLACEHOLDER,
  DEFAULT_STALE_HOURS,
  OPEN_HANDOFF_STATUSES,
  DEFAULT_END_SESSION_ZERO_TOUCH,
  DEFAULT_START_SESSION_ZERO_TOUCH,
  ROLE_LIST,
  EXECUTION_PROVIDER_DEFS,
  EXECUTION_PROVIDER_BY_ID,
  // paths
  getTemplatesDir,
  getTrackerPath,
  getConfigPath,
  getAgentSyncDir,
  getStatePath,
  getRequestPath,
  getResultPath,
  getHandoffsPath,
  getContextCapsulePath,
  // text
  isEmptyValue,
  escapeRegExp,
  parseTracker,
  getSectionBody,
  setSectionBody,
  canonicalAgentId,
  toSingleLine,
  formatElapsed,
  // io
  parseISODate,
  parseCommandArgv,
  // git
  runGit,
  runGitExitCode,
  normalizeRepoRelativePath,
  scoreNextTaskCapabilities,
  getHotFilesCached,
  // workspace
  getActiveWorkspaceFolder,
  resolveWorkspaceFolder,
  getWorkspaceLabelPrefix,
  readAgentSyncConfig,
  writeConfigFile,
  // snapshot
  getWorkspaceSnapshot,
  invalidateWorkspaceCaches,
  // agent catalog
  buildCatalog,
  mapAgentToCapabilities,
  matchAgentsByCapabilities,
  // execution channels
  assembleAgentPrompt,
  deliverPrompt,
  injectPersonalityToWorkspace,
  // session
  buildSessionIdentity,
  // automation
  buildDeterministicSessionSummary,
  resolveAutomationRoute,
  buildAutomationHandoffNotes,
  // health
  runHealthChecks,
  resolveHealthCheckProgram,
  // handoffs
  validateHandoff,
  claimHandoffRecord,
  completeHandoffRecord,
  syncTrackerHandoffsSection,
  generateContextCapsule,
  readTracker,
  readStateFile,
  writeStateFile,
  readHandoffs,
  writeHandoffs,
  normalizeHandoffStatus,
  buildHandoffId,
  getHandoffOwners,
  listHandoffRecords,
  createHandoffRecord,
  listRunnableQueuedHandoffs
} = utils;
var _agentCatalog = null;
var _extensionPath = null;
async function promptForRole(prefillRole) {
  const picks = ROLE_LIST.map((r) => ({
    label: r.replace(/_/g, " "),
    description: "",
    role: r
  }));
  if (prefillRole) {
    const match = picks.find((p) => p.role === prefillRole);
    if (match) return match.role;
  }
  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: "Select your primary role for this project",
    ignoreFocusOut: true
  });
  return selected?.role || null;
}
function applyRolePreset(workspaceFolder, role) {
  if (!ROLE_LIST.includes(role)) return;
  const root = workspaceFolder.uri.fsPath;
  let preset = null;
  try {
    const rolesDir = path.join(__dirname, "templates", "roles");
    const raw = fs.readFileSync(path.join(rolesDir, `${role}.json`), "utf8");
    preset = JSON.parse(raw);
  } catch {
  }
  if (!preset) return;
  const cfg = readAgentSyncConfig(workspaceFolder);
  cfg.userProfile = { role };
  if (Array.isArray(preset.dashboardShortcuts)) {
    cfg.dashboardShortcuts = preset.dashboardShortcuts;
  }
  if (typeof preset.sessionDurationWarningMinutes === "number") {
    cfg.sessionDurationWarningMinutes = preset.sessionDurationWarningMinutes;
  }
  if (preset.handoffRoutingDefaults) {
    cfg.automation = cfg.automation || {};
    cfg.automation.handoffRoutingDefaults = preset.handoffRoutingDefaults;
  }
  writeConfigFile(workspaceFolder, cfg);
  const appendBlock = (filePath, text) => {
    let content = "";
    try {
      content = fs.readFileSync(filePath, "utf8");
    } catch {
    }
    content = content.replace(/## Role:[\s\S]*?(?=\n## |$)/g, "");
    content += "\n\n## Role: " + role.replace(/_/g, " ") + "\n\n" + text + "\n";
    fs.writeFileSync(filePath, content, "utf8");
  };
  if (preset.agentInstructionBlock) {
    appendBlock(path.join(root, "CLAUDE.md"), preset.agentInstructionBlock);
    appendBlock(path.join(root, "AGENTS.md"), preset.agentInstructionBlock);
    appendBlock(path.join(root, ".github", "copilot-instructions.md"), preset.agentInstructionBlock);
  }
}
function ensureHandoffsFile(workspaceFolder) {
  try {
    fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true });
    const handoffsPath = getHandoffsPath(workspaceFolder);
    if (!fs.existsSync(handoffsPath)) {
      fs.writeFileSync(handoffsPath, JSON.stringify({ version: 1, handoffs: [] }, null, 2), "utf8");
      invalidateWorkspaceCaches(workspaceFolder);
    }
  } catch (err) {
    if (err && err.code !== "ENOENT") console.error("[AgentSync] ensureHandoffsFile error:", err);
  }
}
function getSessionStaleInfo(state, autoStaleSessionMinutes = 0) {
  if (!state?.sessionActive || !state?.activeSession?.startedAt) {
    return { isStale: false, ageMs: null, thresholdMs: null };
  }
  if (!Number.isFinite(autoStaleSessionMinutes) || autoStaleSessionMinutes <= 0) {
    return { isStale: false, ageMs: null, thresholdMs: null };
  }
  const started = parseISODate(state.activeSession.startedAt);
  if (!Number.isFinite(started)) {
    return { isStale: false, ageMs: null, thresholdMs: autoStaleSessionMinutes * 60 * 1e3 };
  }
  const ageMs = Date.now() - started;
  const thresholdMs = autoStaleSessionMinutes * 60 * 1e3;
  return { isStale: ageMs >= thresholdMs, ageMs, thresholdMs };
}
function getOperationalState(state, inProgressLines, handoffs, autoStaleSessionMinutes = 0) {
  const staleInfo = getSessionStaleInfo(state, autoStaleSessionMinutes);
  if (state?.sessionActive) {
    if (staleInfo.isStale) {
      const ageLabel = staleInfo.ageMs != null ? formatElapsed(staleInfo.ageMs) : "unknown duration";
      return {
        key: "waiting",
        label: "Waiting",
        reason: `Active session appears stale (running ${ageLabel}). End or clear it before new work.`
      };
    }
    return {
      key: "busy",
      label: "Busy",
      reason: 'An active session flag exists. If stale, use "Clear Active Session".'
    };
  }
  const openHandoffs2 = handoffs.filter(
    (h) => OPEN_HANDOFF_STATUSES.has(String(h?.status || "").toLowerCase())
  );
  if (inProgressLines.length > 0 || openHandoffs2.length > 0) {
    return {
      key: "waiting",
      label: "Waiting",
      reason: "No active session, but pending work/handoffs exist."
    };
  }
  return { key: "ready", label: "Ready", reason: "No active session and no pending queue." };
}
function getStatePulseFrame(stateKey) {
  const now = Math.floor(Date.now() / 700);
  if (stateKey === "busy") {
    const frames = ["[01]", "[10]", "[11]", "[00]"];
    return frames[now % frames.length];
  }
  if (stateKey === "waiting") {
    const frames = ["[.]", "[..]", "[...]"];
    return frames[now % frames.length];
  }
  return "[idle]";
}
async function openTrackerDocument(workspaceFolder) {
  const trackerPath = getTrackerPath(workspaceFolder);
  const doc = await vscode.workspace.openTextDocument(trackerPath);
  await vscode.window.showTextDocument(doc);
}
async function openAgentSyncDashboard() {
  try {
    await vscode.commands.executeCommand("agentsync.dashboard.focus");
    return true;
  } catch {
  }
  try {
    await vscode.commands.executeCommand("workbench.view.extension.agentsync");
    await vscode.commands.executeCommand("agentsync.dashboard.focus");
    return true;
  } catch {
  }
  return false;
}
async function openAgentSyncPanel() {
  const dashboardOpened = await openAgentSyncDashboard();
  if (dashboardOpened) return true;
  try {
    await vscode.commands.executeCommand("agentsync.panel.focus");
    return true;
  } catch {
  }
  try {
    await vscode.commands.executeCommand("workbench.view.extension.agentsync");
    await vscode.commands.executeCommand("agentsync.panel.focus");
    return true;
  } catch {
  }
  return false;
}
async function openAgentSyncTutorial(context) {
  const manifest = context?.extension?.packageJSON || {};
  const publisher = String(manifest.publisher || "teambotics");
  const name = String(manifest.name || "agentsync");
  const extensionId = `${publisher}.${name}`.toLowerCase();
  const walkthroughId = `${extensionId}#agentsync.gettingStarted`;
  try {
    await vscode.commands.executeCommand("workbench.action.openWalkthrough", walkthroughId, false);
    return true;
  } catch {
  }
  try {
    await vscode.commands.executeCommand("workbench.action.openWalkthroughs");
    return true;
  } catch {
  }
  return false;
}
async function openAgentSyncDocs(context) {
  const manifest = context?.extension?.packageJSON || {};
  const target = String(manifest.homepage || manifest.repository?.url || "").trim();
  if (!target) return false;
  try {
    await vscode.env.openExternal(vscode.Uri.parse(target));
    return true;
  } catch {
    return false;
  }
}
async function ensureTrackerExists(context, workspaceFolder) {
  const trackerPath = getTrackerPath(workspaceFolder);
  if (fs.existsSync(trackerPath)) return true;
  const choice = await vscode.window.showWarningMessage(
    `AgentTracker.md not found in "${workspaceFolder.name}". Initialize this workspace first?`,
    "Initialize",
    "Cancel"
  );
  if (choice !== "Initialize") return false;
  await initWorkspace(context, workspaceFolder);
  return fs.existsSync(trackerPath);
}
function writeResultFile(workspaceFolder, data) {
  try {
    fs.mkdirSync(getAgentSyncDir(workspaceFolder), { recursive: true });
    fs.writeFileSync(getResultPath(workspaceFolder), JSON.stringify(data, null, 2), "utf8");
  } catch {
  }
}
function getTrackerWarnings(workspaceFolder, tracker) {
  const warnings = [];
  const config = readAgentSyncConfig(workspaceFolder);
  if (!isEmptyValue(tracker.date)) {
    const parsed = Date.parse(tracker.date);
    if (Number.isFinite(parsed)) {
      const ageMs = Date.now() - parsed;
      if (ageMs > config.staleAfterHours * 60 * 60 * 1e3) {
        const ageHours = Math.floor(ageMs / (60 * 60 * 1e3));
        warnings.push(`Tracker is stale (${ageHours}h old).`);
      }
    }
  }
  const currentBranch = runGit(workspaceFolder, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (currentBranch && !isEmptyValue(tracker.branch) && tracker.branch !== currentBranch) {
    warnings.push(`Branch mismatch: tracker=${tracker.branch}, current=${currentBranch}.`);
  }
  if (!isEmptyValue(tracker.commit)) {
    const exitCode = runGitExitCode(workspaceFolder, [
      "merge-base",
      "--is-ancestor",
      tracker.commit,
      "HEAD"
    ]);
    if (exitCode !== 0) {
      warnings.push(`Tracker commit ${tracker.commit} is not in current HEAD history.`);
    }
  }
  return warnings;
}
function getExecutionProvider(value) {
  const normalized = canonicalAgentId(value);
  if (!normalized) return null;
  return EXECUTION_PROVIDER_BY_ID[normalized] || null;
}
function getExecutionProviderId(value) {
  if (isEmptyValue(String(value || ""))) return null;
  return getExecutionProvider(value)?.id || canonicalAgentId(value) || null;
}
function getExecutionProviderLabel(value) {
  if (isEmptyValue(String(value || ""))) return null;
  const provider = getExecutionProvider(value);
  if (provider) return provider.label;
  const text = String(value || "").trim();
  return text || null;
}
function getSessionProviderInfo(session, fallback = null) {
  const providerId = canonicalAgentId(session?.provider_id || "") || getExecutionProviderId(session?.provider_label || "") || getExecutionProviderId(session?.agent || "") || getExecutionProviderId(fallback);
  const providerLabel = getExecutionProviderLabel(session?.provider_label || "") || getExecutionProviderLabel(session?.agent || "") || getExecutionProviderLabel(fallback) || "Unknown";
  return { id: providerId, label: providerLabel };
}
function getPersonalityDisplayName(workspaceFolder, personalityId) {
  const normalized = canonicalAgentId(personalityId);
  if (!normalized) return null;
  try {
    const catalog = getAgentCatalog(workspaceFolder);
    const match = catalog?.agents?.find((agent) => canonicalAgentId(agent.id) === normalized);
    return match?.name || null;
  } catch {
    return null;
  }
}
function getSessionPersonalityInfo(workspaceFolder, session) {
  const personalityId = canonicalAgentId(session?.personality_id || "") || canonicalAgentId(session?.agent_personality_id || "") || null;
  const personalityName = String(session?.personality_name || "").trim() || getPersonalityDisplayName(workspaceFolder, personalityId) || "None";
  return { id: personalityId, name: personalityName };
}
async function promptForAgent(defaultAgent) {
  const defaultLabel = getExecutionProviderLabel(defaultAgent) || "Codex";
  const builtIn = EXECUTION_PROVIDER_DEFS.map((provider) => ({
    label: provider.label,
    description: provider.label === defaultLabel ? "default" : void 0
  }));
  const choice = await vscode.window.showQuickPick(
    [...builtIn, { label: "Other" }],
    { placeHolder: "Select the execution provider for this session" }
  );
  if (!choice) return null;
  if (choice.label !== "Other") return choice.label;
  const custom = await vscode.window.showInputBox({
    prompt: "Enter provider name",
    value: defaultLabel !== "Codex" ? defaultLabel : ""
  });
  if (custom === void 0) return null;
  const trimmed = custom.trim();
  return trimmed || null;
}
async function promptAutomationFallbackRouting(hotFileCount) {
  const modeChoice = await vscode.window.showQuickPick(
    [
      { label: "single", description: "Route to one target agent" },
      { label: "shared", description: "Route to exactly two agents" },
      { label: "auto", description: "Route by required capabilities" },
      { label: "skip", description: "Skip creating a handoff record for now" }
    ],
    {
      placeHolder: `${hotFileCount} hot file(s) detected. Select fallback routing mode.`,
      ignoreFocusOut: true
    }
  );
  if (!modeChoice) return null;
  const selected = modeChoice.label;
  if (selected === "skip") {
    return {
      handoffData: {
        no_handoff_reason: "Zero-touch fallback selected skip.",
        automation_context: "fallback:skip"
      },
      automationContext: "fallback:skip"
    };
  }
  const inputPrompt = selected === "single" ? "Fallback target agent (single owner)" : selected === "shared" ? "Fallback target agents (comma-separated, exactly two)" : "Fallback required capabilities (comma-separated)";
  const rawInput = await vscode.window.showInputBox({
    prompt: inputPrompt,
    ignoreFocusOut: true,
    validateInput: (value) => {
      const parts = String(value || "").split(",").map((v) => v.trim()).filter(Boolean);
      if (selected === "single")
        return parts.length === 1 ? null : "Enter exactly one target agent.";
      if (selected === "shared")
        return parts.length === 2 ? null : "Enter exactly two target agents.";
      return parts.length > 0 ? null : "Enter at least one capability.";
    }
  });
  if (rawInput === void 0) return null;
  const values = rawInput.split(",").map((v) => v.trim()).filter(Boolean);
  if (selected === "single") {
    return {
      handoffData: {
        owner_mode: "single",
        to_agents: [canonicalAgentId(values[0])],
        required_capabilities: [],
        no_handoff_reason: null,
        automation_context: "fallback:single"
      },
      automationContext: "fallback:single"
    };
  }
  if (selected === "shared") {
    return {
      handoffData: {
        owner_mode: "shared",
        to_agents: values.slice(0, 2).map((v) => canonicalAgentId(v)),
        required_capabilities: [],
        no_handoff_reason: null,
        automation_context: "fallback:shared"
      },
      automationContext: "fallback:shared"
    };
  }
  return {
    handoffData: {
      owner_mode: "auto",
      to_agents: [],
      required_capabilities: values,
      no_handoff_reason: null,
      automation_context: "fallback:auto"
    },
    automationContext: "fallback:auto"
  };
}
async function copyHandoffPromptToClipboard(promptLines) {
  if (!Array.isArray(promptLines) || promptLines.length === 0) return false;
  if (promptLines.length === 1) {
    await vscode.env.clipboard.writeText(promptLines[0]);
    return true;
  }
  const picks = promptLines.map((line, index) => ({
    label: `Prompt ${index + 1}`,
    description: line,
    line
  }));
  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: "Select which handoff prompt to copy",
    ignoreFocusOut: true
  });
  if (!selected) return false;
  await vscode.env.clipboard.writeText(selected.line);
  return true;
}
function updateHandoffPromptCopiedFlag(workspaceFolder, handoffId, copied) {
  const normalizedId = toSingleLine(handoffId);
  if (!normalizedId) return;
  const store = readHandoffs(workspaceFolder);
  if (!store.handoffs.length) return;
  const next = store.handoffs.map((handoff) => {
    if (toSingleLine(handoff?.handoff_id) !== normalizedId) return handoff;
    return {
      ...handoff,
      prompt_copied_to_clipboard: copied === true,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  });
  writeHandoffs(workspaceFolder, { version: 1, handoffs: next });
}
function findClaimableHandoff(workspaceFolder, agentId) {
  const canonical = canonicalAgentId(agentId);
  if (!canonical) return null;
  const { handoffs } = readHandoffs(workspaceFolder);
  return handoffs.find((h) => {
    if (String(h?.status || "").toLowerCase() !== "queued") return false;
    const owners = utils.getHandoffOwners(h);
    return owners.length === 0 || owners.includes(canonical);
  }) || null;
}
function getAgencySyncPaths(workspaceFolder) {
  const base = path.join(workspaceFolder.uri.fsPath, ".agencysync");
  return {
    base,
    runs: path.join(base, "runs.json"),
    events: path.join(base, "events")
  };
}
function tryReadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function listJsonFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const files = [];
  const walk = (current) => {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) files.push(full);
    }
  };
  walk(dirPath);
  return files;
}
function normalizeAgencyCandidate(raw, meta = {}) {
  if (!raw || typeof raw !== "object") return null;
  const toAgents = Array.isArray(raw.to_agents || raw.owners || raw.assignees) ? raw.to_agents || raw.owners || raw.assignees : [];
  const requiredCaps = Array.isArray(raw.required_capabilities || raw.capabilities) ? raw.required_capabilities || raw.capabilities : [];
  const sourceRunId = toSingleLine(raw.run_id || raw.runId || meta.sourceRunId || "") || null;
  const sourceEventId = toSingleLine(raw.event_id || raw.eventId || meta.sourceEventId || "") || null;
  const modeInput = String(raw.owner_mode || "").toLowerCase();
  const ownerMode = modeInput || (toAgents.length >= 2 ? "shared" : toAgents.length === 1 ? "single" : "auto");
  const normalizedMode = ownerMode === "single" || ownerMode === "shared" || ownerMode === "auto" ? ownerMode : "auto";
  return {
    handoff_id: toSingleLine(raw.handoff_id || raw.handoffId || ""),
    task_id: toSingleLine(raw.task_id || raw.taskId || raw.id || ""),
    from_agent: canonicalAgentId(raw.from_agent || raw.agent || raw.source_agent || "agency"),
    to_agents: toAgents.map((a) => canonicalAgentId(a)).filter(Boolean),
    owner_mode: normalizedMode,
    status: normalizeHandoffStatus(raw.status || raw.state, "queued"),
    required_capabilities: requiredCaps.map((c) => toSingleLine(c)).filter(Boolean),
    summary: toSingleLine(raw.summary || raw.title || raw.message || ""),
    notes: toSingleLine(raw.notes || raw.description || ""),
    files: Array.isArray(raw.files || raw.changed_files) ? (raw.files || raw.changed_files).map((f) => toSingleLine(f)).filter(Boolean) : [],
    branch: toSingleLine(raw.branch || ""),
    commit: toSingleLine(raw.commit || raw.sha || ""),
    no_handoff_reason: toSingleLine(raw.no_handoff_reason || "") || null,
    source_system: "agencysync",
    source_run_id: sourceRunId,
    source_event_id: sourceEventId
  };
}
function syncAgencyRunsCore(workspaceFolder) {
  const paths = getAgencySyncPaths(workspaceFolder);
  const errors = [];
  if (!fs.existsSync(paths.base)) {
    return { synced: 0, created: 0, updated: 0, errors };
  }
  const candidates = [];
  const runsData = tryReadJson(paths.runs);
  if (Array.isArray(runsData)) {
    runsData.forEach((run, index) => {
      const candidate = normalizeAgencyCandidate(run, {
        sourceRunId: toSingleLine(run?.id || run?.run_id || index + 1) || null
      });
      if (candidate) candidates.push(candidate);
    });
  }
  const eventFiles = listJsonFilesRecursive(paths.events);
  for (const filePath of eventFiles) {
    const eventData = tryReadJson(filePath);
    const sourceEventId = path.relative(paths.events, filePath).replace(/\\/g, "/");
    const rows = Array.isArray(eventData) ? eventData : eventData ? [eventData] : [];
    rows.forEach((row, index) => {
      const candidate = normalizeAgencyCandidate(row, {
        sourceEventId: `${sourceEventId}#${index + 1}`,
        sourceRunId: toSingleLine(row?.run_id || row?.runId || "") || null
      });
      if (candidate) candidates.push(candidate);
    });
  }
  if (candidates.length === 0) {
    const state2 = readStateFile(workspaceFolder) || {};
    const integration2 = {
      ...state2.integration && typeof state2.integration === "object" ? state2.integration : {},
      lastAgencySyncAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    writeStateFile(workspaceFolder, { ...state2, integration: integration2, lastUpdated: (/* @__PURE__ */ new Date()).toISOString() });
    return { synced: 0, created: 0, updated: 0, errors };
  }
  const store = readHandoffs(workspaceFolder);
  let created = 0;
  let updatedCount = 0;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const next = [...store.handoffs];
  const resolveExistingIndex = (candidate) => {
    const cid = toSingleLine(candidate.handoff_id);
    if (cid) {
      const byId = next.findIndex((h) => toSingleLine(h?.handoff_id) === cid);
      if (byId >= 0) return byId;
    }
    if (candidate.source_event_id) {
      const byEvent = next.findIndex((h) => toSingleLine(h?.source_event_id) === candidate.source_event_id);
      if (byEvent >= 0) return byEvent;
    }
    if (candidate.source_run_id && candidate.task_id) {
      const byRunTask = next.findIndex(
        (h) => toSingleLine(h?.source_run_id) === candidate.source_run_id && toSingleLine(h?.task_id) === candidate.task_id
      );
      if (byRunTask >= 0) return byRunTask;
    }
    return -1;
  };
  for (const candidate of candidates) {
    try {
      const idx = resolveExistingIndex(candidate);
      if (idx >= 0) {
        const existing = next[idx];
        const merged = {
          ...existing,
          ...candidate,
          handoff_id: toSingleLine(existing.handoff_id || candidate.handoff_id || "") || buildHandoffId(next, now),
          task_id: toSingleLine(existing.task_id || candidate.task_id) || null,
          from_agent: canonicalAgentId(candidate.from_agent || existing.from_agent || "agency"),
          to_agents: Array.isArray(candidate.to_agents) && candidate.to_agents.length > 0 ? candidate.to_agents : Array.isArray(existing.to_agents) ? existing.to_agents : [],
          owner_mode: candidate.owner_mode || existing.owner_mode || (Array.isArray(candidate.to_agents) && candidate.to_agents.length >= 2 ? "shared" : Array.isArray(candidate.to_agents) && candidate.to_agents.length === 1 ? "single" : "auto"),
          required_capabilities: Array.isArray(candidate.required_capabilities) && candidate.required_capabilities.length > 0 ? candidate.required_capabilities : Array.isArray(existing.required_capabilities) ? existing.required_capabilities : [],
          summary: candidate.summary || existing.summary || "Agency handoff",
          notes: candidate.notes || existing.notes || "",
          updated_at: now,
          created_at: existing.created_at || now,
          state_history: [
            ...Array.isArray(existing.state_history) ? existing.state_history : [],
            {
              status: normalizeHandoffStatus(candidate.status || existing.status, "queued"),
              agent: canonicalAgentId(candidate.from_agent || existing.from_agent || "agency"),
              timestamp: now,
              reason: "synced from .agencysync"
            }
          ]
        };
        if (merged.no_handoff_reason) {
          merged.owner_mode = "auto";
          merged.to_agents = [];
          if (!Array.isArray(merged.required_capabilities) || merged.required_capabilities.length === 0) {
            merged.required_capabilities = ["skip-handoff"];
          }
        } else if (merged.owner_mode === "auto" && merged.required_capabilities.length === 0) {
          merged.required_capabilities = ["handoff"];
        }
        const validation = validateHandoff(merged);
        if (!validation.valid) throw new Error(validation.errors.join("; "));
        next[idx] = merged;
        updatedCount += 1;
      } else {
        const createdRecord = utils.createHandoffRecord(workspaceFolder, {
          ...candidate,
          summary: candidate.summary || "Agency handoff",
          notes: candidate.notes || "",
          source_system: "agencysync"
        });
        next.push(createdRecord);
        created += 1;
      }
    } catch (err) {
      errors.push(err && err.message ? err.message : "Unknown agency sync error");
    }
  }
  if (updatedCount > 0) {
    writeHandoffs(workspaceFolder, { version: 1, handoffs: next });
  }
  syncTrackerHandoffsSection(workspaceFolder);
  const state = readStateFile(workspaceFolder) || {};
  const integration = {
    ...state.integration && typeof state.integration === "object" ? state.integration : {},
    lastAgencySyncAt: now
  };
  writeStateFile(workspaceFolder, { ...state, integration, lastUpdated: now });
  return { synced: candidates.length, created, updated: updatedCount, errors };
}
function updateActiveSessionContext(workspaceFolder, updates = {}) {
  const state = readStateFile(workspaceFolder) || {};
  if (!state?.sessionActive || !state?.activeSession) return null;
  const nextSession = {
    ...state.activeSession,
    ...updates
  };
  writeStateFile(workspaceFolder, {
    ...state,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
    activeSession: nextSession
  });
  return nextSession;
}
var _dropZoneInFlight = /* @__PURE__ */ new Set();
async function processDropZoneRequest(workspaceFolder) {
  const folderKey = workspaceFolder.uri.fsPath;
  if (_dropZoneInFlight.has(folderKey)) return;
  const requestPath = getRequestPath(workspaceFolder);
  const claimPath = requestPath + ".processing";
  try {
    fs.renameSync(requestPath, claimPath);
  } catch {
    return;
  }
  _dropZoneInFlight.add(folderKey);
  let request;
  try {
    const raw = fs.readFileSync(claimPath, "utf8");
    request = JSON.parse(raw);
  } catch {
    writeResultFile(workspaceFolder, {
      ok: false,
      error: "Invalid JSON in request file",
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    try {
      fs.unlinkSync(claimPath);
    } catch (err) {
      if (err && err.code !== "ENOENT") console.error("[AgentSync] drop-zone cleanup error:", err);
    }
    _dropZoneInFlight.delete(folderKey);
    return;
  }
  const { action } = request || {};
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  try {
    switch (action) {
      case "startSession": {
        const { agent, goal } = request;
        if (!agent) throw new Error("Missing required field: agent");
        SessionManager.startSessionCore(workspaceFolder, agent, goal || "Session started");
        const state = readStateFile(workspaceFolder);
        if (state?.sessionMetrics) {
          state.sessionMetrics.commandsRun = (state.sessionMetrics.commandsRun || 0) + 1;
          writeStateFile(workspaceFolder, state);
        }
        writeResultFile(workspaceFolder, { ok: true, action, timestamp });
        break;
      }
      case "endSession": {
        const { agent, summary, nextWork, handoff } = request;
        if (!agent) throw new Error("Missing required field: agent");
        const state = readStateFile(workspaceFolder);
        if (state?.sessionMetrics) {
          state.sessionMetrics.commandsRun = (state.sessionMetrics.commandsRun || 0) + 1;
          writeStateFile(workspaceFolder, state);
        }
        const hasProvidedSummary = typeof summary === "string" && toSingleLine(summary).length > 0;
        const zeroTouchEnabled = readAgentSyncConfig(workspaceFolder).automation?.endSessionZeroTouch?.enabled === true;
        const {
          health,
          hotFiles,
          handoff: handoffRecord,
          generatedSummary,
          summarySource,
          handoffPrompts
        } = await SessionManager.endSessionCore(
          workspaceFolder,
          agent,
          summary || "",
          nextWork || "",
          handoff || null,
          {
            summarySource: !hasProvidedSummary && zeroTouchEnabled ? "deterministic" : "user",
            automationUsed: zeroTouchEnabled && !hasProvidedSummary
          }
        );
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: {
            health,
            hotFiles,
            handoff: handoffRecord,
            generatedSummary,
            summarySource,
            handoffPrompts,
            promptCopiedToClipboard: false
          }
        });
        break;
      }
      case "status": {
        const content = readTracker(workspaceFolder);
        const tracker = content ? parseTracker(content) : null;
        const warnings = tracker ? getTrackerWarnings(workspaceFolder, tracker) : [];
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: { tracker, warnings }
        });
        break;
      }
      case "health": {
        const { results, outputs } = await runHealthChecks(workspaceFolder);
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: { results, outputs }
        });
        break;
      }
      case "listHandoffs": {
        const handoffs = utils.listHandoffRecords(workspaceFolder);
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: { count: handoffs.length, handoffs }
        });
        break;
      }
      case "claimHandoff": {
        const handoffId = toSingleLine(request?.handoffId || request?.handoff_id);
        const agent = toSingleLine(request?.agent);
        if (!handoffId) throw new Error("Missing required field: handoffId");
        if (!agent) throw new Error("Missing required field: agent");
        const result = claimHandoffRecord(workspaceFolder, handoffId, agent);
        if (!result.ok) {
          writeResultFile(workspaceFolder, {
            ok: false,
            action,
            timestamp,
            error: result.reason || "claim failed",
            data: result
          });
          break;
        }
        syncTrackerHandoffsSection(workspaceFolder);
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: result
        });
        break;
      }
      case "completeHandoff": {
        const handoffId = toSingleLine(request?.handoffId || request?.handoff_id);
        const agent = toSingleLine(request?.agent);
        const status = toSingleLine(request?.status || "merged") || "merged";
        const reason = toSingleLine(request?.reason || "") || null;
        if (!handoffId) throw new Error("Missing required field: handoffId");
        if (!agent) throw new Error("Missing required field: agent");
        const result = utils.completeHandoffRecord(workspaceFolder, handoffId, status, agent, reason);
        if (!result.ok) {
          writeResultFile(workspaceFolder, {
            ok: false,
            action,
            timestamp,
            error: result.reason || "complete failed",
            data: result
          });
          break;
        }
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: result
        });
        break;
      }
      case "createHandoff": {
        const handoff = request?.handoff;
        if (!handoff || typeof handoff !== "object") {
          throw new Error("Missing required field: handoff");
        }
        const created = utils.createHandoffRecord(workspaceFolder, handoff);
        writeResultFile(workspaceFolder, {
          ok: true,
          action,
          timestamp,
          data: { handoff: created }
        });
        break;
      }
      case "syncAgencyRuns": {
        const data = syncAgencyRunsCore(workspaceFolder);
        writeResultFile(workspaceFolder, { ok: true, action, timestamp, data });
        break;
      }
      default:
        throw new Error(`Unknown action: ${action || "(none)"}`);
    }
  } catch (err) {
    writeResultFile(workspaceFolder, { ok: false, error: err.message, action, timestamp });
  } finally {
    try {
      fs.unlinkSync(claimPath);
    } catch (err) {
      if (err && err.code !== "ENOENT") console.error("[AgentSync] drop-zone cleanup error:", err);
    }
    _dropZoneInFlight.delete(folderKey);
  }
}
var AgentSyncItem = class extends vscode.TreeItem {
  /**
   * @param {string} label
   * @param {vscode.TreeItemCollapsibleState} collapsibleState
   * @param {object} [opts]
   * @param {string} [opts.icon] codicon id
   * @param {vscode.ThemeColor} [opts.iconColor]
   * @param {string} [opts.description]
   * @param {string} [opts.tooltip]
   * @param {vscode.Command} [opts.command]
   * @param {string} [opts.contextValue]
   * @param {AgentSyncItem[]} [opts.children]
   */
  constructor(label, collapsibleState = vscode.TreeItemCollapsibleState.None, opts = {}) {
    super(label, collapsibleState);
    this.children = opts.children || [];
    if (opts.icon) {
      this.iconPath = new vscode.ThemeIcon(opts.icon, opts.iconColor);
    }
    if (opts.description !== void 0) this.description = opts.description;
    if (opts.tooltip) this.tooltip = opts.tooltip;
    if (opts.command) this.command = opts.command;
    if (opts.contextValue) this.contextValue = opts.contextValue;
  }
};
var AgentSyncTreeDataProvider = class {
  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }
  refresh() {
    this._onDidChangeTreeData.fire(void 0);
  }
  /** @param {AgentSyncItem} element */
  getTreeItem(element) {
    return element;
  }
  /** @param {AgentSyncItem | undefined} element */
  getChildren(element) {
    if (element) return element.children;
    const workspaceFolder = getActiveWorkspaceFolder();
    if (!workspaceFolder) {
      return [
        new AgentSyncItem("No workspace open", vscode.TreeItemCollapsibleState.None, {
          icon: "warning"
        })
      ];
    }
    const snapshot = getWorkspaceSnapshot(workspaceFolder);
    const state = snapshot.state;
    const config = snapshot.config;
    const handoffInfo = snapshot.handoffInfo;
    const trackerContent = snapshot.trackerContent;
    const inProgressLines = snapshot.inProgressLines;
    const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0;
    const staleInfo = getSessionStaleInfo(state, autoStaleSessionMinutes);
    const opsState = getOperationalState(
      state,
      inProgressLines,
      handoffInfo.handoffs,
      autoStaleSessionMinutes
    );
    const currentAgentId = getSessionProviderInfo(state?.activeSession || state?.lastSession || null).id;
    return [
      this._buildOverviewSection(
        workspaceFolder,
        opsState,
        state,
        inProgressLines,
        handoffInfo.handoffs
      ),
      this._buildQuickActionsSection(),
      this._buildSessionSection(state, staleInfo),
      this._buildHandoffsSection(
        workspaceFolder,
        handoffInfo,
        currentAgentId,
        Number(config.staleAfterHours) || DEFAULT_STALE_HOURS
      ),
      this._buildHealthSection(state),
      this._buildHotFilesSection(state, workspaceFolder),
      this._buildInProgressSection(trackerContent)
    ];
  }
  _buildOverviewSection(workspaceFolder, opsState, state, inProgressLines, handoffs) {
    const byState = {
      ready: {
        icon: "pass-filled",
        color: new vscode.ThemeColor("testing.iconPassed"),
        next: "Next: Start Session when ready to make changes."
      },
      busy: {
        icon: "record",
        color: new vscode.ThemeColor("testing.iconFailed"),
        next: "Next: Run End Session, or Clear Active Session if this is stale."
      },
      waiting: {
        icon: "clock",
        color: new vscode.ThemeColor("charts.yellow"),
        next: "Next: Review pending work/handoffs, then start the next session."
      }
    };
    const visual = byState[opsState.key];
    const pulse = getStatePulseFrame(opsState.key);
    const openHandoffCount = handoffs.filter(
      (h) => OPEN_HANDOFF_STATUSES.has(String(h?.status || "").toLowerCase())
    ).length;
    const children = [
      new AgentSyncItem(`State: ${opsState.label} ${pulse}`, vscode.TreeItemCollapsibleState.None, {
        icon: visual.icon,
        iconColor: visual.color,
        tooltip: opsState.reason
      }),
      new AgentSyncItem(
        `Active provider: ${state?.sessionActive ? getSessionProviderInfo(state?.activeSession || null).label || "Unknown" : "None"}`,
        vscode.TreeItemCollapsibleState.None,
        { icon: "account" }
      ),
      new AgentSyncItem(
        `In Progress items: ${inProgressLines.length}`,
        vscode.TreeItemCollapsibleState.None,
        {
          icon: "tasklist"
        }
      ),
      new AgentSyncItem(
        `Open handoffs: ${openHandoffCount}`,
        vscode.TreeItemCollapsibleState.None,
        {
          icon: "git-pull-request"
        }
      ),
      new AgentSyncItem(visual.next, vscode.TreeItemCollapsibleState.None, {
        icon: "lightbulb",
        tooltip: `Workspace: ${workspaceFolder.name}`
      })
    ];
    return new AgentSyncItem("Overview", vscode.TreeItemCollapsibleState.Expanded, {
      icon: "dashboard",
      children
    });
  }
  _buildQuickActionsSection() {
    const action = (label, command, icon, tooltip) => new AgentSyncItem(label, vscode.TreeItemCollapsibleState.None, {
      icon,
      command: { command, title: label },
      tooltip
    });
    return new AgentSyncItem("Quick Actions", vscode.TreeItemCollapsibleState.Collapsed, {
      icon: "rocket",
      children: [
        action(
          "Initialize Workspace",
          "agentsync.init",
          "new-file",
          "Create AgentSync files in this repo"
        ),
        action("Start Session", "agentsync.startSession", "play", "Begin tracking active work"),
        action(
          "Run Next Step",
          "agentsync.runNextStep",
          "run",
          "Claim the next runnable handoff and prepare its prompt"
        ),
        action(
          "End Session",
          "agentsync.endSession",
          "debug-stop",
          "Write handoff and health metadata"
        ),
        action(
          "Clear Active Session",
          "agentsync.clearActiveSession",
          "circle-slash",
          "Clear stale busy state"
        ),
        action(
          "Open AgentTracker",
          "agentsync.openTracker",
          "book",
          "Open shared handoff document"
        ),
        action(
          "Open Handoffs JSON",
          "agentsync.openHandoffs",
          "json",
          "Open machine-readable handoff data"
        ),
        action(
          "Context Status",
          "agentsync.contextStatus",
          "info",
          "Show session metrics and context health"
        ),
        action(
          "Open Walkthrough",
          "agentsync.openTutorial",
          "mortar-board",
          "Open guided onboarding in VS Code Getting Started"
        ),
        action(
          "Open Web Docs",
          "agentsync.openDocs",
          "link-external",
          "Open AgentSync documentation in your browser"
        )
      ]
    });
  }
  _buildSessionSection(state, staleInfo = { isStale: false, ageMs: null }) {
    if (!state || !state.sessionActive || !state.activeSession) {
      const lastAgent = state?.lastSession?.provider_label || state?.lastSession?.agent;
      const lastDate = state?.lastSession?.date;
      const tooltip = lastDate ? `Last session: ${lastAgent} on ${new Date(lastDate).toLocaleString()}` : "No sessions recorded yet";
      return new AgentSyncItem("No active session", vscode.TreeItemCollapsibleState.None, {
        icon: "circle-outline",
        description: lastAgent && !isEmptyValue(lastAgent) ? `Last: ${lastAgent}` : void 0,
        tooltip,
        command: { command: "agentsync.startSession", title: "Start Session" }
      });
    }
    const sessionProvider = getSessionProviderInfo(state.activeSession || null);
    const sessionPersonality = getSessionPersonalityInfo(
      getActiveWorkspaceFolder(),
      state.activeSession || null
    );
    const { goal, startedAt } = state.activeSession;
    const elapsed = formatElapsed(Date.now() - Date.parse(startedAt));
    const staleChild = staleInfo?.isStale ? new AgentSyncItem(
      `Stale session: running ${formatElapsed(staleInfo.ageMs || 0)}`,
      vscode.TreeItemCollapsibleState.None,
      {
        icon: "warning",
        iconColor: new vscode.ThemeColor("charts.yellow"),
        tooltip: "Use Clear Active Session if this session is no longer active."
      }
    ) : null;
    const goalChild = new AgentSyncItem(
      goal || "No goal set",
      vscode.TreeItemCollapsibleState.None,
      { icon: "target", tooltip: "Session goal" }
    );
    const elapsedChild = new AgentSyncItem(
      `Running: ${elapsed}`,
      vscode.TreeItemCollapsibleState.None,
      {
        icon: "clock",
        tooltip: `Started at ${new Date(startedAt).toLocaleTimeString()}`
      }
    );
    return new AgentSyncItem(sessionProvider.label, vscode.TreeItemCollapsibleState.Expanded, {
      icon: staleInfo?.isStale ? "warning" : "record",
      iconColor: staleInfo?.isStale ? new vscode.ThemeColor("charts.yellow") : new vscode.ThemeColor("testing.iconPassed"),
      description: staleInfo?.isStale ? `stale ${elapsed}` : elapsed,
      contextValue: "activeSession",
      children: [
        new AgentSyncItem(
          `Personality: ${sessionPersonality.name || "None"}`,
          vscode.TreeItemCollapsibleState.None,
          { icon: "library", tooltip: "Active work personality" }
        ),
        goalChild,
        elapsedChild,
        ...staleChild ? [staleChild] : []
      ]
    });
  }
  _buildHandoffsSection(workspaceFolder, handoffInfo, currentAgentId, staleAfterHours) {
    const { exists, handoffs, error } = handoffInfo;
    if (!exists) {
      return new AgentSyncItem("Handoffs", vscode.TreeItemCollapsibleState.Collapsed, {
        icon: "git-pull-request",
        children: [
          new AgentSyncItem("No handoffs file yet", vscode.TreeItemCollapsibleState.None, {
            icon: "dash",
            command: { command: "agentsync.openHandoffs", title: "Open Handoffs JSON" },
            tooltip: "Create .agentsync/handoffs.json by opening it from Quick Actions."
          })
        ]
      });
    }
    if (error) {
      return new AgentSyncItem("Handoffs", vscode.TreeItemCollapsibleState.Collapsed, {
        icon: "error",
        iconColor: new vscode.ThemeColor("testing.iconFailed"),
        children: [
          new AgentSyncItem(
            `Invalid handoffs.json: ${error}`,
            vscode.TreeItemCollapsibleState.None,
            {
              icon: "error",
              tooltip: `File: ${getHandoffsPath(workspaceFolder)}`,
              command: { command: "agentsync.openHandoffs", title: "Open Handoffs JSON" }
            }
          )
        ]
      });
    }
    const buckets = utils.getHandoffBuckets(handoffs, currentAgentId, staleAfterHours);
    const openHandoffs2 = buckets.open;
    const assignedToMe = buckets.assignedToMe;
    const sharedWithMe = buckets.sharedWithMe;
    const blockedOrStale = buckets.blockedOrStale;
    const toLeaf = (h) => {
      const id = h?.handoff_id || h?.task_id || "unknown";
      const summary = (h?.summary || h?.task_id || "No summary").trim();
      const status = String(h?.status || "queued");
      const owners = utils.getHandoffOwners(h).join(",");
      const personality = getPersonalityDisplayName(workspaceFolder, utils.getHandoffPersonalityId(h));
      return new AgentSyncItem(`${id}: ${summary}`, vscode.TreeItemCollapsibleState.None, {
        icon: "note",
        description: status,
        tooltip: [
          `owners: ${owners || "provider-flex"}`,
          `personality: ${personality || utils.getHandoffPersonalityId(h) || "auto"}`,
          `mode: ${h?.owner_mode || "unknown"}`
        ].join("\n"),
        command: { command: "agentsync.openHandoffs", title: "Open Handoffs JSON" }
      });
    };
    const group = (label, icon, items, emptyLabel) => new AgentSyncItem(`${label} (${items.length})`, vscode.TreeItemCollapsibleState.Collapsed, {
      icon,
      children: items.length > 0 ? items.slice(0, 10).map(toLeaf) : [
        new AgentSyncItem(emptyLabel, vscode.TreeItemCollapsibleState.None, {
          icon: "dash"
        })
      ]
    });
    const children = [
      group("Assigned to me", "person", assignedToMe, "No single-owner handoffs assigned to you"),
      group(
        "Shared with me",
        "organization",
        sharedWithMe,
        "No shared-owner handoffs assigned to you"
      ),
      group("Blocked/Stale", "warning", blockedOrStale, "No blocked or stale handoffs")
    ];
    return new AgentSyncItem(
      `Handoffs (${openHandoffs2.length})`,
      vscode.TreeItemCollapsibleState.Collapsed,
      {
        icon: "git-pull-request",
        children
      }
    );
  }
  _buildHealthSection(state) {
    const health = state?.health || {};
    const statusIcon = (status) => {
      if (status === "Pass")
        return { icon: "pass-filled", color: new vscode.ThemeColor("testing.iconPassed") };
      if (status === "Fail")
        return { icon: "error", color: new vscode.ThemeColor("testing.iconFailed") };
      return { icon: "circle-outline", color: void 0 };
    };
    const children = ["Build", "Tests", "Deploy"].map((label) => {
      const entry = health[label];
      const status = entry?.status ?? entry ?? "Not configured";
      const { icon, color } = statusIcon(status);
      const output = (entry?.output || "").trim();
      return new AgentSyncItem(label, vscode.TreeItemCollapsibleState.None, {
        icon: status === "Not configured" ? "warning" : icon,
        iconColor: status === "Not configured" ? new vscode.ThemeColor("charts.yellow") : color,
        description: status === "Not configured" ? "Setup needed" : status,
        tooltip: status === "Not configured" ? "Configure this command in .agentsync.json or run Detect Build/Test Commands." : output ? `Last output:
${output.slice(-300)}` : void 0,
        command: status === "Not configured" ? { command: "agentsync.detectCommands", title: "Detect Build/Test Commands" } : void 0
      });
    });
    const hasFail = Object.values(health).some((e) => (e?.status ?? e) === "Fail");
    const hasSetupMissing = ["Build", "Tests", "Deploy"].some((label) => {
      const entry = health[label];
      return (entry?.status ?? entry ?? "Not configured") === "Not configured";
    });
    return new AgentSyncItem("Health", vscode.TreeItemCollapsibleState.Collapsed, {
      icon: hasFail ? "error" : hasSetupMissing ? "warning" : "heart",
      iconColor: hasFail ? new vscode.ThemeColor("testing.iconFailed") : hasSetupMissing ? new vscode.ThemeColor("charts.yellow") : void 0,
      children
    });
  }
  _buildHotFilesSection(state, workspaceFolder) {
    const hotFiles = state?.hotFiles || [];
    const label = hotFiles.length > 0 ? `Hot Files (${hotFiles.length})` : "Hot Files";
    const children = hotFiles.length > 0 ? hotFiles.map((file) => {
      const fullPath = path.join(workspaceFolder.uri.fsPath, file);
      return new AgentSyncItem(file, vscode.TreeItemCollapsibleState.None, {
        icon: "file-code",
        tooltip: fullPath,
        command: {
          command: "vscode.open",
          title: "Open File",
          arguments: [vscode.Uri.file(fullPath)]
        }
      });
    }) : [new AgentSyncItem("None", vscode.TreeItemCollapsibleState.None, { icon: "dash" })];
    return new AgentSyncItem(label, vscode.TreeItemCollapsibleState.Collapsed, {
      icon: "flame",
      children
    });
  }
  _buildInProgressSection(trackerContent) {
    const body = trackerContent ? getSectionBody(trackerContent, "In Progress") : "";
    const lines = body.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l !== "*Nothing active*" && !l.startsWith("<!--"));
    const label = lines.length > 0 ? `In Progress (${lines.length})` : "In Progress";
    const children = lines.length > 0 ? lines.map((line) => {
      const done = line.startsWith("- [x]");
      const text = line.replace(/^- \[[ x]\]\s*/, "").trim();
      return new AgentSyncItem(text, vscode.TreeItemCollapsibleState.None, {
        icon: done ? "check" : "circle-outline",
        tooltip: line
      });
    }) : [
      new AgentSyncItem("Nothing active", vscode.TreeItemCollapsibleState.None, {
        icon: "dash"
      })
    ];
    return new AgentSyncItem(label, vscode.TreeItemCollapsibleState.Collapsed, {
      icon: "tasklist",
      children
    });
  }
};
function updateStatusBar(statusItem) {
  const workspaceFolder = getActiveWorkspaceFolder();
  if (!workspaceFolder) {
    statusItem.text = "$(sync) AgentSync";
    statusItem.tooltip = "No workspace open";
    statusItem.show();
    return;
  }
  const trackerPath = getTrackerPath(workspaceFolder);
  const prefix = getWorkspaceLabelPrefix(workspaceFolder);
  if (!fs.existsSync(trackerPath)) {
    statusItem.text = `$(circle-outline) ${prefix}AgentSync Ready`;
    statusItem.tooltip = `AgentTracker not initialized for ${workspaceFolder.name}.
Run "AgentSync: Initialize Workspace".`;
    statusItem.show();
    return;
  }
  try {
    const snapshot = getWorkspaceSnapshot(workspaceFolder);
    const tracker = snapshot.tracker;
    const state = snapshot.state;
    const config = snapshot.config;
    const handoffInfo = snapshot.handoffInfo;
    const inProgressLines = snapshot.inProgressLines;
    const autoStaleSessionMinutes = Number(config.autoStaleSessionMinutes) || 0;
    const opsState = getOperationalState(
      state,
      inProgressLines,
      handoffInfo.handoffs,
      autoStaleSessionMinutes
    );
    const warnings = getTrackerWarnings(workspaceFolder, tracker);
    const stateIconByKey = {
      ready: "$(pass-filled)",
      busy: "$(sync~spin)",
      waiting: "$(clock)"
    };
    const baseIcon = stateIconByKey[opsState.key] || "$(sync)";
    const icon = warnings.length > 0 ? "$(warning)" : baseIcon;
    statusItem.text = `${icon} ${prefix}AgentSync ${opsState.label}`;
    const tooltipLines = [];
    tooltipLines.push(`State: ${opsState.label}`);
    tooltipLines.push(opsState.reason);
    if (state?.sessionActive && state?.activeSession) {
      const activeProvider = getSessionProviderInfo(state.activeSession || null);
      const activePersonality = getSessionPersonalityInfo(workspaceFolder, state.activeSession || null);
      tooltipLines.push(
        `Active: ${activeProvider.label}${activePersonality.name && activePersonality.name !== "None" ? " | " + activePersonality.name : ""}`
      );
    }
    const displayAgent = state?.lastSession?.provider_label || state?.lastSession?.agent || tracker.agent;
    const displayDate = state?.lastSession?.date || tracker.date;
    const displayBranch = state?.lastSession?.branch || tracker.branch;
    const displayCommit = state?.lastSession?.commit || tracker.commit;
    if (!isEmptyValue(displayAgent) || !isEmptyValue(displayDate)) {
      tooltipLines.push(`Last session: ${displayAgent} | ${displayDate}`);
    }
    if (!isEmptyValue(displayBranch) || !isEmptyValue(displayCommit)) {
      tooltipLines.push(`Branch: ${displayBranch} | Commit: ${displayCommit}`);
    }
    if (handoffInfo.handoffs.length > 0) {
      const openHandoffs2 = handoffInfo.handoffs.filter(
        (h) => OPEN_HANDOFF_STATUSES.has(String(h?.status || "").toLowerCase())
      );
      tooltipLines.push(`Open handoffs: ${openHandoffs2.length}`);
    }
    if (warnings.length > 0) {
      tooltipLines.push("", "Warnings:");
      warnings.forEach((warning) => tooltipLines.push(`- ${warning}`));
    }
    tooltipLines.push("", "Click to open AgentSync Live");
    statusItem.tooltip = tooltipLines.join("\n");
  } catch {
    statusItem.text = `$(sync) ${prefix}AgentSync`;
    statusItem.tooltip = `Could not read AgentTracker.md for ${workspaceFolder.name}`;
  }
  statusItem.show();
}
async function initWorkspace(context, selectedFolder = null) {
  const workspaceFolder = selectedFolder || await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const root = workspaceFolder.uri.fsPath;
  const templatesDir = getTemplatesDir(context);
  const filesToCreate = [
    { src: "CLAUDE.md", dest: "CLAUDE.md" },
    { src: "AGENTS.md", dest: "AGENTS.md" },
    { src: "copilot-instructions.md", dest: path.join(".github", "copilot-instructions.md") },
    { src: "AgentTracker.md", dest: "AgentTracker.md" },
    { src: "agentsync.json", dest: ".agentsync.json" }
  ];
  let created = 0;
  let skipped = 0;
  for (const file of filesToCreate) {
    const destPath = path.join(root, file.dest);
    const srcPath = path.join(templatesDir, file.src);
    if (fs.existsSync(destPath)) {
      const choice2 = await vscode.window.showWarningMessage(
        `${file.dest} already exists in ${workspaceFolder.name}. Overwrite?`,
        { modal: false },
        "Overwrite",
        "Skip"
      );
      if (choice2 !== "Overwrite") {
        skipped++;
        continue;
      }
    }
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      created++;
    } catch (err) {
      vscode.window.showErrorMessage(`AgentSync: Failed to create ${file.dest}: ${err.message}`);
    }
  }
  try {
    fs.mkdirSync(path.join(root, ".agentsync"), { recursive: true });
  } catch {
  }
  ensureHandoffsFile(workspaceFolder);
  try {
    const gitignorePath = path.join(root, ".gitignore");
    let gitignoreContent = "";
    if (fs.existsSync(gitignorePath)) {
      gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    }
    const alreadyIgnored = gitignoreContent.split(/\r?\n/).some((line) => line.trim() === ".agentsync" || line.trim() === ".agentsync/");
    if (!alreadyIgnored) {
      const separator = gitignoreContent && !gitignoreContent.endsWith("\n") ? "\n" : "";
      fs.appendFileSync(gitignorePath, `${separator}.agentsync/
`, "utf8");
    }
  } catch {
  }
  await autoDetectCommands(workspaceFolder, { force: false });
  const summary = created === 0 && skipped > 0 ? "All files skipped." : `${created} file${created !== 1 ? "s" : ""} created${skipped > 0 ? `, ${skipped} skipped` : ""}.`;
  const choice = await vscode.window.showInformationMessage(
    `AgentSync: Workspace "${workspaceFolder.name}" initialized. ${summary}`,
    "Open AgentSync Panel",
    "Open Walkthrough",
    "Open Web Docs"
  );
  const cfg = readAgentSyncConfig(workspaceFolder);
  if (!cfg.userProfile || !cfg.userProfile.role) {
    const role = await promptForRole();
    if (role) applyRolePreset(workspaceFolder, role);
  }
  if (choice === "Open AgentSync Panel") {
    const opened = await openAgentSyncPanel();
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Could not focus the panel. Run "View: Reset View Locations" and try again.'
      );
    }
  } else if (choice === "Open Walkthrough") {
    const opened = await openAgentSyncTutorial(context);
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Could not open the walkthrough. Open "Getting Started" and select AgentSync.'
      );
    }
  } else if (choice === "Open Web Docs") {
    const opened = await openAgentSyncDocs(context);
    if (!opened) {
      vscode.window.showWarningMessage("AgentSync: Could not open the documentation URL.");
    }
  }
  const trackerPath = getTrackerPath(workspaceFolder);
  if (fs.existsSync(trackerPath)) {
    await openTrackerDocument(workspaceFolder);
  }
}
async function openTracker(context) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const ready = await ensureTrackerExists(context, workspaceFolder);
  if (!ready) return;
  await openTrackerDocument(workspaceFolder);
}
async function openHandoffs() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  ensureHandoffsFile(workspaceFolder);
  const handoffsPath = getHandoffsPath(workspaceFolder);
  const doc = await vscode.workspace.openTextDocument(handoffsPath);
  await vscode.window.showTextDocument(doc);
}
async function openConfigFile() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const configPath = getConfigPath(workspaceFolder);
  if (!fs.existsSync(configPath)) {
    writeConfigFile(workspaceFolder, readAgentSyncConfig(workspaceFolder));
  }
  const doc = await vscode.workspace.openTextDocument(configPath);
  await vscode.window.showTextDocument(doc);
}
async function listHandoffsCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  ensureHandoffsFile(workspaceFolder);
  const handoffs = utils.listHandoffRecords(workspaceFolder);
  const openCount = handoffs.filter((h) => utils.isOpenHandoff(h)).length;
  const detail = [
    `Total handoffs: ${handoffs.length}`,
    `Open handoffs: ${openCount}`,
    `Queued: ${handoffs.filter((h) => String(h?.status || "").toLowerCase() === "queued").length}`,
    `In progress: ${handoffs.filter((h) => String(h?.status || "").toLowerCase() === "in_progress").length}`
  ].join("\n");
  vscode.window.showInformationMessage("AgentSync Handoffs", { modal: true, detail });
  const handoffsPath = getHandoffsPath(workspaceFolder);
  const doc = await vscode.workspace.openTextDocument(handoffsPath);
  await vscode.window.showTextDocument(doc);
}
async function claimHandoffCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const state = readStateFile(workspaceFolder) || {};
  const defaultAgent = toSingleLine(state?.activeSession?.agent) || toSingleLine(state?.lastSession?.agent) || "Codex";
  const agent = await promptForAgent(defaultAgent);
  if (!agent) return;
  const queued = utils.listHandoffRecords(workspaceFolder).filter(
    (h) => String(h?.status || "").toLowerCase() === "queued"
  );
  if (queued.length === 0) {
    vscode.window.showInformationMessage("AgentSync: No queued handoffs to claim.");
    return;
  }
  const picks = queued.map((h) => ({
    label: toSingleLine(h?.handoff_id) || "unknown",
    description: toSingleLine(h?.summary) || "No summary",
    detail: `from ${toSingleLine(h?.from_agent) || "unknown"} -> ${(h?.to_agents || []).join(", ") || "any"}`
  }));
  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: "Select a queued handoff to claim",
    ignoreFocusOut: true
  });
  if (!selected) return;
  const result = claimHandoffRecord(workspaceFolder, selected.label, agent);
  if (!result.ok) {
    vscode.window.showWarningMessage(
      `AgentSync: Could not claim ${selected.label} (${result.reason || "unknown reason"}).`
    );
    return;
  }
  syncTrackerHandoffsSection(workspaceFolder);
  vscode.window.showInformationMessage(`AgentSync: Claimed handoff ${selected.label}.`);
  const handoffRecord = utils.listHandoffRecords(workspaceFolder).find(
    (h) => toSingleLine(h?.handoff_id) === selected.label
  );
  const personalityId = handoffRecord?.agent_personality_id || handoffRecord?.suggested_agent_personality_id;
  if (personalityId) {
    try {
      const catalog = getAgentCatalog(workspaceFolder);
      const agent2 = catalog?.agents?.find((a) => a.id === personalityId);
      if (agent2) {
        const activateChoice = await vscode.window.showInformationMessage(
          "This handoff suggests agent personality: " + agent2.name + ". Activate it?",
          "Activate",
          "View",
          "Skip"
        );
        if (activateChoice === "Activate") {
          injectPersonalityToWorkspace(workspaceFolder.uri.fsPath, agent2);
          vscode.window.showInformationMessage("AgentSync: Agent personality " + agent2.name + " activated.");
        } else if (activateChoice === "View") {
          const doc = await vscode.workspace.openTextDocument({
            content: "# " + agent2.name + "\n\n" + agent2.promptBody,
            language: "markdown"
          });
          await vscode.window.showTextDocument(doc, { preview: true });
        }
      }
    } catch {
    }
  }
}
async function completeHandoffCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const state = readStateFile(workspaceFolder) || {};
  const defaultAgent = toSingleLine(state?.activeSession?.agent) || toSingleLine(state?.lastSession?.agent) || "Codex";
  const agent = await promptForAgent(defaultAgent);
  if (!agent) return;
  const candidates = utils.listHandoffRecords(workspaceFolder).filter(
    (h) => OPEN_HANDOFF_STATUSES.has(String(h?.status || "").toLowerCase())
  );
  if (candidates.length === 0) {
    vscode.window.showInformationMessage("AgentSync: No open handoffs to complete.");
    return;
  }
  const selected = await vscode.window.showQuickPick(
    candidates.map((h) => ({
      label: toSingleLine(h?.handoff_id) || "unknown",
      description: `${toSingleLine(h?.status) || "queued"} | ${toSingleLine(h?.summary) || "No summary"}`
    })),
    {
      placeHolder: "Select a handoff to transition",
      ignoreFocusOut: true
    }
  );
  if (!selected) return;
  const statusPick = await vscode.window.showQuickPick(
    [
      { label: "merged", description: "Mark as merged" },
      { label: "approved", description: "Mark as approved" },
      { label: "ready_for_review", description: "Mark as ready for review" },
      { label: "blocked", description: "Mark as blocked" },
      { label: "escalated", description: "Mark as escalated" }
    ],
    {
      placeHolder: "Select resulting status",
      ignoreFocusOut: true
    }
  );
  if (!statusPick) return;
  const reasonInput = await vscode.window.showInputBox({
    prompt: "Transition reason (optional)",
    placeHolder: "Example: CI green, merged via PR #123"
  });
  if (reasonInput === void 0) return;
  const result = utils.completeHandoffRecord(
    workspaceFolder,
    selected.label,
    statusPick.label,
    agent,
    reasonInput
  );
  if (!result.ok) {
    vscode.window.showErrorMessage(
      `AgentSync: Could not complete ${selected.label} (${result.reason || "unknown reason"}).`
    );
    return;
  }
  vscode.window.showInformationMessage(
    `AgentSync: Handoff ${selected.label} moved to ${statusPick.label}.`
  );
}
async function contextCapsuleCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const capsule = generateContextCapsule(workspaceFolder);
  const capsulePath = getContextCapsulePath(workspaceFolder);
  const openChoice = await vscode.window.showInformationMessage(
    `AgentSync: Context capsule generated (${capsule.handoffs.openCount} open handoff(s)).`,
    "Open Capsule",
    "Dismiss"
  );
  if (openChoice === "Open Capsule") {
    const doc = await vscode.workspace.openTextDocument(capsulePath);
    await vscode.window.showTextDocument(doc);
  }
}
async function syncAgencyRunsCommand(options = {}) {
  const workspaceFolder = options.workspaceFolder || await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    if (!options.silent) vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return null;
  }
  const result = syncAgencyRunsCore(workspaceFolder);
  if (!options.silent) {
    const errorSuffix = result.errors.length > 0 ? ` (${result.errors.length} error(s))` : "";
    vscode.window.showInformationMessage(
      `AgentSync: Agency sync complete. ${result.synced} candidate(s), ${result.created} created, ${result.updated} updated${errorSuffix}.`
    );
  }
  return result;
}
async function clearActiveSession() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const statePath = getStatePath(workspaceFolder);
  if (!fs.existsSync(statePath)) {
    vscode.window.showInformationMessage("AgentSync: No active session to clear.");
    return;
  }
  let state = null;
  try {
    state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
  }
  if (!state?.sessionActive || !state?.activeSession) {
    vscode.window.showInformationMessage("AgentSync: No active session to clear.");
    return;
  }
  const agent = String(state.activeSession.agent || "Unknown");
  const choice = await vscode.window.showWarningMessage(
    `AgentSync: Clear the active session for ${agent} without running End Session checks?`,
    "Clear Session",
    "Cancel"
  );
  if (choice !== "Clear Session") return;
  const result = SessionManager.clearActiveSessionCore(workspaceFolder);
  if (!result.cleared) {
    vscode.window.showErrorMessage("AgentSync: Could not clear active session.");
    return;
  }
  vscode.window.showInformationMessage(
    `AgentSync: Cleared active session${result.agent ? ` for ${result.agent}` : ""}.`
  );
}
async function startSession(context, options = {}) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const ready = await ensureTrackerExists(context, workspaceFolder);
  if (!ready) return;
  const content = readTracker(workspaceFolder);
  if (!content) {
    vscode.window.showErrorMessage("AgentSync: Could not read AgentTracker.md.");
    return;
  }
  const tracker = parseTracker(content);
  const config = readAgentSyncConfig(workspaceFolder);
  if (!config.userProfile || !config.userProfile.role) {
    const role = await promptForRole();
    if (role) applyRolePreset(workspaceFolder, role);
    Object.assign(config, readAgentSyncConfig(workspaceFolder));
  }
  const zeroTouchCfg = config.automation?.startSessionZeroTouch || DEFAULT_START_SESSION_ZERO_TOUCH;
  const zeroTouchEnabled = zeroTouchCfg.enabled === true;
  let goalPreFill = options.goalPreFill || "";
  let agentPreFill = options.agentPreFill || "";
  let claimedHandoff = null;
  if (zeroTouchEnabled) {
    const currentState = readStateFile(workspaceFolder) || {};
    agentPreFill = agentPreFill || currentState?.lastSession?.agent || tracker.agent || "";
    if (agentPreFill) {
      const candidate = findClaimableHandoff(workspaceFolder, agentPreFill);
      if (candidate) {
        if (zeroTouchCfg.autoClaimHandoff) {
          const claimResult = claimHandoffRecord(
            workspaceFolder,
            toSingleLine(candidate.handoff_id),
            agentPreFill
          );
          if (claimResult.ok) syncTrackerHandoffsSection(workspaceFolder);
          goalPreFill = goalPreFill || toSingleLine(candidate.summary);
          claimedHandoff = candidate;
          vscode.window.showInformationMessage(
            `AgentSync: Picked up handoff ${candidate.handoff_id}: ${toSingleLine(candidate.summary)}`
          );
        } else if (zeroTouchCfg.promptPreFill) {
          goalPreFill = goalPreFill || toSingleLine(candidate.summary);
          claimedHandoff = candidate;
        }
      }
    }
  }
  const agent = await promptForAgent(agentPreFill || tracker.agent);
  if (!agent) return;
  const goal = await vscode.window.showInputBox({
    prompt: "What are you working on this session?",
    placeHolder: "Example: Implement auth callback retries",
    value: goalPreFill
  });
  if (goal === void 0) return;
  if (zeroTouchEnabled && !zeroTouchCfg.autoClaimHandoff && claimedHandoff) {
    const claimResult = claimHandoffRecord(
      workspaceFolder,
      toSingleLine(claimedHandoff.handoff_id),
      agent
    );
    if (claimResult.ok) {
      syncTrackerHandoffsSection(workspaceFolder);
      vscode.window.showInformationMessage(
        `AgentSync: Claimed handoff ${claimedHandoff.handoff_id}: ${toSingleLine(claimedHandoff.summary)}`
      );
    }
  }
  try {
    const personality = claimedHandoff ? resolveHandoffPersonality(workspaceFolder, claimedHandoff) : null;
    SessionManager.startSessionCore(workspaceFolder, agent, goal, {
      providerId: getExecutionProviderId(agent),
      providerLabel: getExecutionProviderLabel(agent),
      personalityId: personality?.id || utils.getHandoffPersonalityId(claimedHandoff) || null,
      personalityName: personality?.name || getPersonalityDisplayName(workspaceFolder, utils.getHandoffPersonalityId(claimedHandoff)) || null
    });
  } catch (err) {
    vscode.window.showErrorMessage(`AgentSync: ${err.message}`);
    return;
  }
  await openTrackerDocument(workspaceFolder);
  vscode.window.showInformationMessage(`AgentSync: Session started for ${agent}.`);
}
async function endSession(context) {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const ready = await ensureTrackerExists(context, workspaceFolder);
  if (!ready) return;
  const content = readTracker(workspaceFolder);
  if (!content) {
    vscode.window.showErrorMessage("AgentSync: Could not read AgentTracker.md.");
    return;
  }
  const parsed = parseTracker(content);
  const config = readAgentSyncConfig(workspaceFolder);
  const zeroTouchCfg = config.automation?.endSessionZeroTouch || DEFAULT_END_SESSION_ZERO_TOUCH;
  const zeroTouchEnabled = zeroTouchCfg.enabled === true;
  let agent = "";
  let summary = "";
  let nextWork = "";
  let handoffData = null;
  let summarySource = "user";
  let automationUsed = false;
  let automationContext = null;
  let goalHint = null;
  let precomputedHotFiles = null;
  let precomputedHealth = null;
  let precomputedHealthOutputs = null;
  if (zeroTouchEnabled) {
    const state = readStateFile(workspaceFolder) || {};
    const activeSessionAgent = state?.sessionActive && toSingleLine(state?.activeSession?.agent) ? toSingleLine(state.activeSession.agent) : "";
    if (activeSessionAgent) {
      agent = activeSessionAgent;
    } else {
      agent = await promptForAgent(parsed.agent);
      if (!agent) return;
    }
    goalHint = toSingleLine(state?.activeSession?.goal || "") || null;
    precomputedHotFiles = getHotFilesCached(workspaceFolder, { force: true });
    const checks = await runHealthChecks(workspaceFolder);
    precomputedHealth = checks.results;
    precomputedHealthOutputs = checks.outputs;
    const generatedSummary = buildDeterministicSessionSummary({
      goal: goalHint || "",
      hotFiles: precomputedHotFiles,
      health: precomputedHealth,
      maxSummaryLength: zeroTouchCfg.maxSummaryLength
    });
    const summaryInput = await vscode.window.showInputBox({
      prompt: "One-line session summary (auto-generated; edit if needed)",
      value: generatedSummary,
      ignoreFocusOut: true
    });
    if (summaryInput === void 0) return;
    summary = toSingleLine(summaryInput) || generatedSummary;
    summarySource = summary === generatedSummary ? "deterministic" : "user";
    automationUsed = true;
    if (precomputedHotFiles.length > 0) {
      const route = resolveAutomationRoute(config, agent);
      if (route) {
        automationContext = "default:" + canonicalAgentId(agent);
        handoffData = {
          summary,
          notes: buildAutomationHandoffNotes({
            summary,
            hotFiles: precomputedHotFiles,
            health: precomputedHealth,
            sourceAgent: agent
          }),
          owner_mode: route.owner_mode,
          to_agents: route.to_agents,
          required_capabilities: route.required_capabilities,
          no_handoff_reason: null,
          automation_context: automationContext
        };
      } else {
        const fallback = await promptAutomationFallbackRouting(precomputedHotFiles.length);
        if (!fallback) return;
        handoffData = fallback.handoffData;
        automationContext = fallback.automationContext || null;
        if (!handoffData.no_handoff_reason) {
          handoffData.summary = summary;
          handoffData.notes = buildAutomationHandoffNotes({
            summary,
            hotFiles: precomputedHotFiles,
            health: precomputedHealth,
            sourceAgent: agent
          });
          handoffData.automation_context = automationContext;
        }
      }
    }
  } else {
    agent = await promptForAgent(parsed.agent);
    if (!agent) return;
    const summaryInput = await vscode.window.showInputBox({
      prompt: "One-line session summary",
      placeHolder: "Example: Added queue retry logic and fixed race condition"
    });
    if (summaryInput === void 0) return;
    summary = summaryInput;
    const nextWorkInput = await vscode.window.showInputBox({
      prompt: "Suggested next work (optional)",
      placeHolder: "Leave empty to keep existing notes"
    });
    if (nextWorkInput === void 0) return;
    nextWork = nextWorkInput;
    const hotFiles = getHotFilesCached(workspaceFolder, { force: true });
    if (hotFiles.length > 0) {
      const modeChoice = await vscode.window.showQuickPick(
        [
          { label: "Single owner", description: "Hand off to one agent", value: "single" },
          {
            label: "Shared owners",
            description: "Two agents co-own the next step",
            value: "shared"
          },
          {
            label: "Auto-route",
            description: "System picks owner(s) from capabilities",
            value: "auto"
          },
          {
            label: "Skip (enter reason)",
            description: "No handoff - record reason instead",
            value: "skip"
          }
        ],
        {
          placeHolder: hotFiles.length + " hot file(s) detected. Add a handoff note?",
          ignoreFocusOut: true
        }
      );
      if (modeChoice === void 0) return;
      if (modeChoice.value === "skip") {
        const skipReason = await vscode.window.showInputBox({
          prompt: "Why are you skipping the handoff? (required)",
          placeHolder: "Example: Solo branch, no review needed yet",
          ignoreFocusOut: true,
          validateInput: (v) => v && v.trim() ? null : "Reason cannot be empty"
        });
        if (skipReason === void 0) return;
        handoffData = { no_handoff_reason: skipReason.trim() };
      } else {
        let toAgents = [];
        let requiredCapabilities = [];
        if (modeChoice.value === "single") {
          const toInput = await vscode.window.showInputBox({
            prompt: "Target agent name (e.g. claude)",
            placeHolder: "claude",
            ignoreFocusOut: true,
            validateInput: (v) => v && v.trim() ? null : "Agent name cannot be empty"
          });
          if (toInput === void 0) return;
          toAgents = [toInput.trim()];
        } else if (modeChoice.value === "shared") {
          const toInput = await vscode.window.showInputBox({
            prompt: "Two agent names, comma-separated (e.g. claude, copilot)",
            placeHolder: "claude, copilot",
            ignoreFocusOut: true,
            validateInput: (v) => {
              const parts = (v || "").split(",").map((s) => s.trim()).filter(Boolean);
              return parts.length === 2 ? null : "Enter exactly 2 agent names separated by a comma";
            }
          });
          if (toInput === void 0) return;
          toAgents = toInput.split(",").map((s) => s.trim()).filter(Boolean);
        } else if (modeChoice.value === "auto") {
          const capsInput = await vscode.window.showInputBox({
            prompt: "Required capabilities, comma-separated (e.g. policy_review, pr_review)",
            placeHolder: "policy_review, pr_review",
            ignoreFocusOut: true,
            validateInput: (v) => {
              const parts = (v || "").split(",").map((s) => s.trim()).filter(Boolean);
              return parts.length > 0 ? null : "Enter at least one capability";
            }
          });
          if (capsInput === void 0) return;
          requiredCapabilities = capsInput.split(",").map((s) => s.trim()).filter(Boolean);
        }
        const handoffSummary = await vscode.window.showInputBox({
          prompt: "Handoff summary (what does the next agent need to do?)",
          value: summary,
          ignoreFocusOut: true
        });
        if (handoffSummary === void 0) return;
        const handoffNotes = await vscode.window.showInputBox({
          prompt: "Additional notes for the next agent (optional)",
          placeHolder: "Example: Check regression risk in token refresh path before merge.",
          ignoreFocusOut: true
        });
        if (handoffNotes === void 0) return;
        handoffData = {
          summary: handoffSummary.trim() || summary,
          notes: handoffNotes.trim(),
          owner_mode: modeChoice.value,
          to_agents: toAgents,
          required_capabilities: requiredCapabilities,
          no_handoff_reason: null
        };
      }
    }
  }
  let result;
  try {
    result = await SessionManager.endSessionCore(workspaceFolder, agent, summary, nextWork, handoffData, {
      hotFiles: precomputedHotFiles,
      healthResults: precomputedHealth,
      healthOutputs: precomputedHealthOutputs,
      summarySource,
      automationUsed,
      automationContext,
      goalHint
    });
  } catch (err) {
    vscode.window.showErrorMessage("AgentSync: " + err.message);
    return;
  }
  let promptCopiedToClipboard = false;
  if (zeroTouchEnabled && zeroTouchCfg.copyPromptToClipboard && Array.isArray(result.handoffPrompts) && result.handoffPrompts.length > 0) {
    try {
      promptCopiedToClipboard = await copyHandoffPromptToClipboard(result.handoffPrompts);
      if (promptCopiedToClipboard && result.handoff?.handoff_id) {
        updateHandoffPromptCopiedFlag(workspaceFolder, result.handoff.handoff_id, true);
      }
    } catch {
      promptCopiedToClipboard = false;
    }
  }
  await openTrackerDocument(workspaceFolder);
  const failedChecks = Object.values(result.health || {}).filter(
    (status) => status === "Fail"
  ).length;
  const handoffMsg = result.handoff ? result.handoff.no_handoff_reason ? " Handoff skipped (reason recorded)." : " Handoff note created." : "";
  let summaryMessage = failedChecks > 0 ? "AgentSync: Session ended. " + failedChecks + " health check(s) failed." + handoffMsg : "AgentSync: Session ended and tracker updated." + handoffMsg;
  if (result && result.complexityInfo) {
    const info = result.complexityInfo;
    const caps = info.capabilities.length > 0 ? info.capabilities.join(", ") : "general work";
    const tierLabel = info.tier === "lead" ? "lead-tier" : "worker-tier";
    vscode.window.showInformationMessage(
      `Next task needs ${caps} \u2014 suggest a ${tierLabel} model (${info.reason}).`
    );
  }
  if (zeroTouchEnabled) {
    const summarySourceMsg = result.summarySource === "deterministic" ? " Summary auto-generated." : " Summary confirmed/edited.";
    const promptMsg = Array.isArray(result.handoffPrompts) && result.handoffPrompts.length > 0 ? promptCopiedToClipboard ? " Handoff prompt copied to clipboard." : " Handoff prompt generated (not copied)." : "";
    summaryMessage += summarySourceMsg + promptMsg;
  }
  vscode.window.showInformationMessage(summaryMessage);
}
function detectPackageManager(workspaceRoot) {
  if (fs.existsSync(path.join(workspaceRoot, "bun.lockb")) || fs.existsSync(path.join(workspaceRoot, "bun.lock")))
    return "bun";
  if (fs.existsSync(path.join(workspaceRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(workspaceRoot, "yarn.lock"))) return "yarn";
  return "npm";
}
async function autoDetectCommands(workspaceFolder, options = {}) {
  const { force = false } = options;
  const cfg = vscode.workspace.getConfiguration("agentsync");
  if (!force && !cfg.get("autoDetectCommands", true)) return false;
  const pkgPath = path.join(workspaceFolder.uri.fsPath, "package.json");
  if (!fs.existsSync(pkgPath)) return false;
  let scripts;
  try {
    const raw = fs.readFileSync(pkgPath, "utf8").replace(/^\uFEFF/, "");
    scripts = JSON.parse(raw).scripts || {};
  } catch {
    return false;
  }
  const manager = detectPackageManager(workspaceFolder.uri.fsPath);
  const candidateMap = {
    build: ["build", "compile", "bundle", "tsc"],
    test: ["test", "tests", "jest", "mocha", "vitest", "spec"],
    deploy: ["deploy", "release", "publish", "ship"]
  };
  const detected = {};
  for (const [key, candidates] of Object.entries(candidateMap)) {
    for (const candidate of candidates) {
      if (scripts[candidate]) {
        detected[key] = `${manager} run ${candidate}`;
        break;
      }
    }
  }
  if (Object.keys(detected).length === 0) return false;
  if (!force) {
    const existing2 = readAgentSyncConfig(workspaceFolder);
    const hasExisting = Object.values(existing2.commands).some((v) => v && String(v).trim());
    if (hasExisting) return false;
  }
  const detectedList = Object.entries(detected).map(([k, v]) => `${k}: "${v}"`).join(", ");
  const choice = await vscode.window.showInformationMessage(
    `AgentSync: Detected scripts in "${workspaceFolder.name}" \xE2\u20AC\u201D ${detectedList}. Populate .agentsync.json?`,
    "Yes",
    "Skip"
  );
  if (choice !== "Yes") return false;
  const existing = readAgentSyncConfig(workspaceFolder);
  const updated = { ...existing, commands: { ...existing.commands, ...detected } };
  try {
    writeConfigFile(workspaceFolder, updated);
    return true;
  } catch {
    return false;
  }
}
async function checkSessionOnStartup(_context) {
  const cfg = vscode.workspace.getConfiguration("agentsync");
  if (!cfg.get("promptOnStartup", true)) return;
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;
  for (const folder of folders) {
    const statePath = getStatePath(folder);
    if (!fs.existsSync(statePath)) continue;
    let state;
    try {
      state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    } catch {
      continue;
    }
    if (!state.sessionActive || !state.activeSession) continue;
    const { agent, goal, startedAt } = state.activeSession;
    const ageMs = Date.now() - (parseISODate(startedAt) || Date.now());
    const ageHours = Math.floor(ageMs / (60 * 60 * 1e3));
    const ageLabel = ageHours >= 1 ? `${ageHours}h ago` : "recently";
    const goalLabel = goal ? ` \xE2\u20AC\u201D "${goal}"` : "";
    const choice = await vscode.window.showInformationMessage(
      `AgentSync: ${agent} has an active session in "${folder.name}" (started ${ageLabel}${goalLabel}).`,
      "Continue",
      "End Session"
    );
    if (choice === "End Session") {
      await vscode.commands.executeCommand("agentsync.endSession").catch((err) => {
        console.error("[AgentSync] checkSessionOnStartup executeCommand error:", err);
      });
    }
  }
}
function startSessionReminderTimer(context) {
  const reminded = /* @__PURE__ */ new Set();
  const CHECK_INTERVAL_MS = 30 * 60 * 1e3;
  const timer = setInterval(() => {
    const cfg = vscode.workspace.getConfiguration("agentsync");
    const reminderHours = cfg.get("sessionReminderHours", 2);
    if (!reminderHours || reminderHours <= 0) return;
    const folders = vscode.workspace.workspaceFolders;
    if (!folders) return;
    for (const folder of folders) {
      const statePath = getStatePath(folder);
      if (!fs.existsSync(statePath)) continue;
      let state;
      try {
        state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      } catch {
        continue;
      }
      if (!state.sessionActive || !state.activeSession?.startedAt) continue;
      const sessionKey = `${folder.uri.fsPath}::${state.activeSession.startedAt}`;
      if (reminded.has(sessionKey)) continue;
      const started = parseISODate(state.activeSession.startedAt);
      if (!Number.isFinite(started)) continue;
      const ageMs = Date.now() - started;
      const ageHours = ageMs / (60 * 60 * 1e3);
      if (ageHours < reminderHours) continue;
      reminded.add(sessionKey);
      const ageLabel = Math.floor(ageHours) + "h";
      vscode.window.showWarningMessage(
        `AgentSync: ${getSessionProviderInfo(state.activeSession || null).label}'s session in "${folder.name}" has been running for ${ageLabel}. Time to wrap up?`,
        "End Session",
        "Dismiss"
      ).then((choice) => {
        if (choice === "End Session") {
          vscode.commands.executeCommand("agentsync.endSession").catch((err) => {
            console.error("[AgentSync] reminder timer executeCommand error:", err);
          });
        }
      });
    }
  }, CHECK_INTERVAL_MS);
  context.subscriptions.push({ dispose: () => clearInterval(timer) });
}
var AgentSyncHotFileDecorationProvider = class {
  constructor() {
    this._emitter = new vscode.EventEmitter();
    this.onDidChangeFileDecorations = this._emitter.event;
    this._hotFilePaths = /* @__PURE__ */ new Set();
    this._agentByPath = /* @__PURE__ */ new Map();
  }
  /**
   * @param {vscode.WorkspaceFolder} workspaceFolder
   * @param {string[]} hotFiles workspace-relative paths
   * @param {string} lastAgent agent label for tooltip
   */
  update(workspaceFolder, hotFiles, lastAgent) {
    this._hotFilePaths.clear();
    this._agentByPath.clear();
    const agent = String(lastAgent || "unknown agent");
    for (const rel of hotFiles || []) {
      const abs = path.join(workspaceFolder.uri.fsPath, rel);
      this._hotFilePaths.add(abs);
      this._agentByPath.set(abs, agent);
    }
    this._emitter.fire(void 0);
  }
  clear() {
    this._hotFilePaths.clear();
    this._agentByPath.clear();
    this._emitter.fire(void 0);
  }
  /**
   * @param {vscode.Uri} uri
   * @returns {vscode.FileDecoration | undefined}
   */
  provideFileDecoration(uri) {
    const p = uri.fsPath;
    if (!this._hotFilePaths.has(p)) return void 0;
    const agent = this._agentByPath.get(p) || "another agent";
    return new vscode.FileDecoration(
      "!",
      `Hot file \u2014 last modified by ${agent}. Check AgentTracker.md before editing.`,
      new vscode.ThemeColor("editorWarning.foreground")
    );
  }
};
function loadAgentCatalog(workspaceFolder) {
  const base = _extensionPath || __dirname;
  const bundledDir = path.join(base, "templates", "agents");
  const rootDirs = [bundledDir];
  if (workspaceFolder) {
    const wsAgentsDir = path.join(workspaceFolder.uri.fsPath, ".agentsync", "agents");
    if (fs.existsSync(wsAgentsDir)) {
      rootDirs.push(wsAgentsDir);
    }
  }
  _agentCatalog = buildCatalog({ rootDirs });
  return _agentCatalog;
}
function getAgentCatalog(workspaceFolder) {
  if (!_agentCatalog) loadAgentCatalog(workspaceFolder || null);
  return _agentCatalog;
}
async function browseAgentsCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  const catalog = getAgentCatalog(workspaceFolder);
  if (!catalog || catalog.agents.length === 0) {
    vscode.window.showInformationMessage("AgentSync: No agents found in catalog.");
    return;
  }
  const items = [];
  const sortedCategories = [...catalog.categories].sort();
  for (const category of sortedCategories) {
    const categoryAgents = catalog.agents.filter((a) => a.category === category);
    if (categoryAgents.length === 0) continue;
    items.push({
      label: category.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      kind: vscode.QuickPickItemKind.Separator
    });
    for (const agent2 of categoryAgents) {
      items.push({
        label: agent2.name,
        description: agent2.category,
        detail: agent2.description,
        agentId: agent2.id
      });
    }
  }
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Browse agent personalities (" + catalog.agents.length + " available)",
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true
  });
  if (!selected || !selected.agentId) return;
  const agent = catalog.agents.find((a) => a.id === selected.agentId);
  if (!agent) return;
  const doc = await vscode.workspace.openTextDocument({
    content: "# " + agent.name + "\n\n**Category:** " + agent.category + "\n**Description:** " + agent.description + "\n**ID:** " + agent.id + "\n\n---\n\n" + agent.promptBody,
    language: "markdown"
  });
  await vscode.window.showTextDocument(doc, { preview: true });
}
function resolveHandoffPersonality(workspaceFolder, handoff) {
  const catalog = getAgentCatalog(workspaceFolder);
  if (!catalog || !Array.isArray(catalog.agents) || catalog.agents.length === 0) return null;
  const explicitId = utils.getHandoffPersonalityId(handoff);
  if (explicitId) {
    const direct = catalog.agents.find((agent) => canonicalAgentId(agent.id) === explicitId);
    if (direct) return direct;
  }
  const matched = matchAgentsByCapabilities(catalog.agents, handoff?.required_capabilities || []);
  return matched[0] || null;
}
function buildHandoffExecutionInstruction(handoff) {
  const lines = [
    String(handoff?.summary || "Continue the queued work").trim()
  ];
  if (handoff?.notes) {
    lines.push("", "Notes:", String(handoff.notes).trim());
  }
  if (Array.isArray(handoff?.files) && handoff.files.length > 0) {
    lines.push("", "Start with these files:");
    handoff.files.forEach((file) => lines.push("- " + file));
  }
  if (handoff?.branch || handoff?.commit) {
    lines.push("", `Branch: ${handoff?.branch || PLACEHOLDER}`);
    lines.push(`Commit: ${handoff?.commit || PLACEHOLDER}`);
  }
  return lines.join("\n");
}
async function runHandoffStep(workspaceFolder, handoff, providerLabel, options = {}) {
  const providerId = getExecutionProviderId(providerLabel);
  const providerDisplay = getExecutionProviderLabel(providerLabel) || String(providerLabel || "Unknown");
  const result = claimHandoffRecord(workspaceFolder, toSingleLine(handoff?.handoff_id), providerDisplay);
  if (!result.ok) {
    vscode.window.showWarningMessage(
      `AgentSync: Could not claim ${handoff?.handoff_id || "handoff"} (${result.reason || "unknown reason"}).`
    );
    return false;
  }
  syncTrackerHandoffsSection(workspaceFolder);
  const personality = resolveHandoffPersonality(workspaceFolder, handoff);
  const personalityId = personality?.id || utils.getHandoffPersonalityId(handoff) || null;
  const personalityName = personality?.name || getPersonalityDisplayName(workspaceFolder, personalityId) || null;
  if (personality && !utils.getHandoffPersonalityId(handoff) && toSingleLine(handoff?.handoff_id)) {
    const store = readHandoffs(workspaceFolder);
    const next = store.handoffs.map((entry) => {
      if (toSingleLine(entry?.handoff_id) !== toSingleLine(handoff?.handoff_id)) return entry;
      return {
        ...entry,
        suggested_agent_personality_id: personality.id,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    });
    writeHandoffs(workspaceFolder, { version: 1, handoffs: next });
  }
  if (personality) {
    injectPersonalityToWorkspace(workspaceFolder.uri.fsPath, personality);
  }
  if (options.ensureSession) {
    SessionManager.startSessionCore(workspaceFolder, providerDisplay, toSingleLine(handoff?.summary), {
      providerId,
      providerLabel: providerDisplay,
      personalityId,
      personalityName
    });
  } else {
    updateActiveSessionContext(workspaceFolder, {
      ...buildSessionIdentity(workspaceFolder, providerDisplay, {
        providerId,
        providerLabel: providerDisplay,
        personalityId,
        personalityName
      }),
      goal: toSingleLine(handoff?.summary) || "Continue queued work"
    });
  }
  const instruction = buildHandoffExecutionInstruction(handoff);
  const assembledPrompt = personality ? assembleAgentPrompt(personality, instruction, { contextFiles: handoff?.files || [] }) : ["# Task", "", instruction].join("\n");
  const delivery = await deliverPrompt("clipboard", { vscodeEnv: vscode.env }, assembledPrompt);
  updateHandoffPromptCopiedFlag(workspaceFolder, handoff?.handoff_id, delivery.ok);
  if (delivery.ok) {
    const suffix = personalityName ? ` Personality: ${personalityName}.` : "";
    vscode.window.showInformationMessage(
      `AgentSync: Next step prepared for ${providerDisplay}.${suffix} Prompt copied to clipboard.`
    );
    return true;
  }
  vscode.window.showErrorMessage("AgentSync: Failed to copy the next-step prompt to clipboard.");
  return false;
}
async function runNextStepCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const state = readStateFile(workspaceFolder) || {};
  const activeProvider = getSessionProviderInfo(state?.activeSession || null);
  const lastProvider = getSessionProviderInfo(state?.lastSession || null);
  const providerId = state?.sessionActive ? activeProvider.id : null;
  const candidates = listRunnableQueuedHandoffs(workspaceFolder, providerId);
  if (candidates.length === 0) {
    vscode.window.showInformationMessage("AgentSync: No runnable queued handoffs found.");
    return;
  }
  let handoff = candidates[0];
  if (candidates.length > 1) {
    const selection = await vscode.window.showQuickPick(
      candidates.map((item) => {
        const owners = utils.getHandoffOwners(item);
        const personalityName = getPersonalityDisplayName(workspaceFolder, utils.getHandoffPersonalityId(item));
        return {
          label: toSingleLine(item?.handoff_id) || "unknown",
          description: toSingleLine(item?.summary) || "No summary",
          detail: (personalityName ? "Personality: " + personalityName + " | " : "") + "Owners: " + (owners.length > 0 ? owners.join(", ") : "provider-flex"),
          handoff: item
        };
      }),
      {
        placeHolder: "Select the next runnable handoff",
        ignoreFocusOut: true
      }
    );
    if (!selection?.handoff) return;
    handoff = selection.handoff;
  }
  let providerLabel = activeProvider.label;
  if (!state?.sessionActive) {
    const ownerDefaults = utils.getHandoffOwners(handoff);
    const defaultProvider = ownerDefaults[0] || lastProvider.label || "Codex";
    providerLabel = await promptForAgent(defaultProvider);
    if (!providerLabel) return;
  }
  await runHandoffStep(workspaceFolder, handoff, providerLabel, {
    ensureSession: !state?.sessionActive
  });
}
async function runWithAgentCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  const catalog = getAgentCatalog(workspaceFolder);
  if (!catalog || catalog.agents.length === 0) {
    vscode.window.showInformationMessage("AgentSync: No agents found in catalog.");
    return;
  }
  const items = catalog.agents.map((agent2) => ({
    label: agent2.name,
    description: agent2.category,
    detail: agent2.description,
    agentId: agent2.id
  }));
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: "Select an agent personality",
    matchOnDescription: true,
    matchOnDetail: true,
    ignoreFocusOut: true
  });
  if (!selected || !selected.agentId) return;
  const agent = catalog.agents.find((a) => a.id === selected.agentId);
  if (!agent) return;
  const instruction = await vscode.window.showInputBox({
    prompt: "Enter your instruction for " + agent.name,
    placeHolder: "Example: Refactor the authentication module to use JWT tokens",
    ignoreFocusOut: true
  });
  if (instruction === void 0 || !instruction.trim()) return;
  const assembledPrompt = assembleAgentPrompt(agent, instruction.trim());
  const result = await deliverPrompt("clipboard", { vscodeEnv: vscode.env }, assembledPrompt);
  if (result.ok) {
    vscode.window.showInformationMessage(
      "AgentSync: Personality prompt copied to clipboard \u2014 paste into your AI tool. Personality: " + agent.name
    );
  } else {
    vscode.window.showErrorMessage("AgentSync: Failed to copy the personality prompt to clipboard.");
  }
}
async function createPipelineCommand() {
  const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
    return;
  }
  const catalog = getAgentCatalog(workspaceFolder);
  if (!catalog || catalog.agents.length === 0) {
    vscode.window.showInformationMessage("AgentSync: No agents found in catalog.");
    return;
  }
  const goalInput = await vscode.window.showInputBox({
    prompt: "Enter the pipeline goal / instruction",
    placeHolder: "Example: Design, implement, and test a new REST endpoint",
    ignoreFocusOut: true
  });
  if (goalInput === void 0 || !goalInput.trim()) return;
  const goal = goalInput.trim();
  const selectedAgents = [];
  let pipelineBuilding = true;
  while (pipelineBuilding) {
    const agentItems = [
      { label: "$(check) Done", description: "Finish building the pipeline", agentId: null },
      ...catalog.agents.map((agent2) => ({
        label: agent2.name,
        description: agent2.category + (selectedAgents.length > 0 ? "" : " (first step)"),
        detail: agent2.description,
        agentId: agent2.id
      }))
    ];
    const stepLabel = selectedAgents.length === 0 ? "Select the first personality in the pipeline" : "Select step " + (selectedAgents.length + 1) + " (or Done to finish). Current: " + selectedAgents.map((a) => a.name).join(" -> ");
    const pick = await vscode.window.showQuickPick(agentItems, {
      placeHolder: stepLabel,
      matchOnDescription: true,
      matchOnDetail: true,
      ignoreFocusOut: true
    });
    if (!pick) return;
    if (!pick.agentId) {
      if (selectedAgents.length < 2) {
        vscode.window.showWarningMessage("AgentSync: Pipeline needs at least 2 agents.");
        continue;
      }
      pipelineBuilding = false;
      continue;
    }
    const agent = catalog.agents.find((a) => a.id === pick.agentId);
    if (agent) selectedAgents.push(agent);
  }
  const store = readHandoffs(workspaceFolder);
  const allHandoffs = store.handoffs;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const chainId = "CHAIN-" + now.slice(0, 10).replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 8);
  const state = readStateFile(workspaceFolder) || {};
  const currentAgent = canonicalAgentId(
    state?.activeSession?.agent || state?.lastSession?.agent || "user"
  );
  const chainHandoffs = selectedAgents.map((agent, index) => {
    const dateStr = now.slice(0, 10).replace(/-/g, "");
    const seq = String(allHandoffs.length + index + 1).padStart(3, "0");
    const handoffId = "HO-" + dateStr + "-" + seq;
    const isFirst = index === 0;
    const isLast = index === selectedAgents.length - 1;
    const nextAgent = isLast ? null : selectedAgents[index + 1];
    return {
      handoff_id: handoffId,
      task_id: null,
      from_agent: isFirst ? currentAgent : selectedAgents[index - 1].id,
      to_agents: [],
      owner_mode: "auto",
      status: isFirst ? "queued" : "blocked",
      required_capabilities: mapAgentToCapabilities(agent),
      summary: "Pipeline step " + (index + 1) + "/" + selectedAgents.length + ": " + goal,
      notes: "Personality: " + agent.name + " (" + agent.category + ")",
      no_handoff_reason: null,
      files: [],
      branch: runGit(workspaceFolder, ["rev-parse", "--abbrev-ref", "HEAD"]) || PLACEHOLDER,
      commit: runGit(workspaceFolder, ["rev-parse", "--short", "HEAD"]) || PLACEHOLDER,
      prior_attempts: 0,
      agent_personality_id: agent.id,
      chain_id: chainId,
      chain_step: index + 1,
      chain_total: selectedAgents.length,
      next_chain_agent_id: nextAgent ? nextAgent.id : null,
      created_at: now,
      updated_at: now,
      state_history: [
        {
          status: isFirst ? "queued" : "blocked",
          agent: currentAgent,
          timestamp: now,
          reason: "pipeline created"
        }
      ]
    };
  });
  for (const handoff of chainHandoffs) {
    const { valid, errors } = validateHandoff(handoff);
    if (!valid) {
      vscode.window.showErrorMessage(
        "AgentSync: Invalid pipeline handoff: " + errors.join("; ")
      );
      return;
    }
  }
  const updatedHandoffs = [...allHandoffs, ...chainHandoffs];
  writeHandoffs(workspaceFolder, { version: 1, handoffs: updatedHandoffs });
  syncTrackerHandoffsSection(workspaceFolder);
  vscode.window.showInformationMessage(
    "AgentSync: Pipeline created with " + selectedAgents.length + " steps. Chain ID: " + chainId
  );
}
function activate(context) {
  _extensionPath = context.extensionPath;
  const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  statusItem.command = "agentsync.openDashboard";
  updateStatusBar(statusItem);
  try {
    const wsFolder = getActiveWorkspaceFolder();
    loadAgentCatalog(wsFolder);
  } catch {
  }
  const dashboardProvider = new AgentSyncDashboardViewProvider(context);
  const dashboardView = vscode.window.registerWebviewViewProvider(
    "agentsync.dashboard",
    dashboardProvider,
    {
      webviewOptions: { retainContextWhenHidden: true }
    }
  );
  const treeProvider = new AgentSyncTreeDataProvider();
  const treeView = vscode.window.createTreeView("agentsync.panel", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  const hotFileDecorationProvider = new AgentSyncHotFileDecorationProvider();
  const decorationProviderDisposable = vscode.window.registerFileDecorationProvider(hotFileDecorationProvider);
  const refreshHotFileDecorations = () => {
    const folder = getActiveWorkspaceFolder();
    if (!folder) {
      hotFileDecorationProvider.clear();
      return;
    }
    const snapshot = getWorkspaceSnapshot(folder);
    const state = snapshot.state;
    const hotFiles = Array.isArray(state?.hotFiles) ? state.hotFiles : [];
    if (hotFiles.length > 0) {
      const agent = state?.activeSession?.agent || state?.lastSession?.agent || "unknown";
      hotFileDecorationProvider.update(folder, hotFiles, agent);
    } else {
      hotFileDecorationProvider.clear();
    }
  };
  const refresh = () => {
    updateStatusBar(statusItem);
    treeProvider.refresh();
    dashboardProvider.refresh();
    refreshHotFileDecorations();
  };
  let refreshTimer = null;
  let refreshInFlight = false;
  let refreshQueued = false;
  const runRefresh = () => {
    if (refreshInFlight) {
      refreshQueued = true;
      return;
    }
    refreshInFlight = true;
    try {
      refresh();
    } finally {
      refreshInFlight = false;
      if (refreshQueued) {
        refreshQueued = false;
        setTimeout(runRefresh, 0);
      }
    }
  };
  const scheduleRefresh = (workspaceFolder = null, delayMs = 120) => {
    if (workspaceFolder) invalidateWorkspaceCaches(workspaceFolder);
    else invalidateWorkspaceCaches(null);
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      runRefresh();
    }, delayMs);
  };
  const metricDebounceTimers = /* @__PURE__ */ new Map();
  const queueSessionMetricFileChange = (workspaceFolder, changedPath) => {
    if (!workspaceFolder || !changedPath) return;
    const rootPath = workspaceFolder.uri.fsPath;
    const relPath = normalizeRepoRelativePath(path.relative(rootPath, changedPath));
    if (!relPath || relPath.startsWith("..") || relPath.includes(".agentsync/")) return;
    const timerKey = `${rootPath}::${relPath.toLowerCase()}`;
    const existingTimer = metricDebounceTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      metricDebounceTimers.delete(timerKey);
      const state = readStateFile(workspaceFolder);
      if (!state?.sessionActive || !state?.sessionMetrics) return;
      state.sessionMetrics.filesModified = (state.sessionMetrics.filesModified || 0) + 1;
      writeStateFile(workspaceFolder, state);
    }, 350);
    metricDebounceTimers.set(timerKey, timer);
  };
  const trackerWatcher = vscode.workspace.createFileSystemWatcher("**/AgentTracker.md");
  trackerWatcher.onDidChange((uri) => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) queueSessionMetricFileChange(workspaceFolder, uri.fsPath);
    scheduleRefresh(workspaceFolder);
  });
  trackerWatcher.onDidCreate((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  trackerWatcher.onDidDelete((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  const configWatcher = vscode.workspace.createFileSystemWatcher("**/.agentsync.json");
  configWatcher.onDidChange((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  configWatcher.onDidCreate((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  configWatcher.onDidDelete((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  const handoffsWatcher = vscode.workspace.createFileSystemWatcher("**/.agentsync/handoffs.json");
  handoffsWatcher.onDidChange((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  handoffsWatcher.onDidCreate((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  handoffsWatcher.onDidDelete((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  const stateWatcher = vscode.workspace.createFileSystemWatcher("**/.agentsync/state.json");
  stateWatcher.onDidChange((uri) => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) queueSessionMetricFileChange(workspaceFolder, uri.fsPath);
    scheduleRefresh(workspaceFolder);
  });
  stateWatcher.onDidCreate((uri) => scheduleRefresh(vscode.workspace.getWorkspaceFolder(uri)));
  const requestWatcher = vscode.workspace.createFileSystemWatcher("**/.agentsync/request.json");
  requestWatcher.onDidChange(async (uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) await processDropZoneRequest(folder);
  });
  requestWatcher.onDidCreate(async (uri) => {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) await processDropZoneRequest(folder);
  });
  const agencySyncTimers = /* @__PURE__ */ new Map();
  const queueAgencySync = (workspaceFolder) => {
    if (!workspaceFolder) return;
    const key = workspaceFolder.uri.fsPath;
    const existingTimer = agencySyncTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(async () => {
      agencySyncTimers.delete(key);
      await syncAgencyRunsCommand({ workspaceFolder, silent: true });
      scheduleRefresh(workspaceFolder);
    }, 500);
    agencySyncTimers.set(key, timer);
  };
  const agencyEventsWatcher = vscode.workspace.createFileSystemWatcher(
    "**/.agencysync/events/**/*.json"
  );
  agencyEventsWatcher.onDidChange((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)));
  agencyEventsWatcher.onDidCreate((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)));
  agencyEventsWatcher.onDidDelete((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)));
  const agencyRunsWatcher = vscode.workspace.createFileSystemWatcher("**/.agencysync/runs.json");
  agencyRunsWatcher.onDidChange((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)));
  agencyRunsWatcher.onDidCreate((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)));
  agencyRunsWatcher.onDidDelete((uri) => queueAgencySync(vscode.workspace.getWorkspaceFolder(uri)));
  const onEditorChange = vscode.window.onDidChangeActiveTextEditor(() => scheduleRefresh());
  const onWorkspaceChange = vscode.workspace.onDidChangeWorkspaceFolders(() => scheduleRefresh());
  const onOpenDoc = vscode.workspace.onDidOpenTextDocument((doc) => {
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!folder) return;
    const state = getWorkspaceSnapshot(folder).state;
    if (!state?.sessionActive) return;
    const hotFiles = Array.isArray(state?.hotFiles) ? state.hotFiles : [];
    if (hotFiles.length === 0) return;
    const rel = path.relative(folder.uri.fsPath, doc.uri.fsPath).replace(/\\/g, "/");
    if (!hotFiles.includes(rel)) return;
    const agent = state?.activeSession?.agent || state?.lastSession?.agent || "another agent";
    vscode.window.showWarningMessage(
      `AgentSync: "${rel}" is a hot file currently being modified by ${agent}. Check AgentTracker.md before editing.`,
      "Open AgentTracker"
    ).then((choice) => {
      if (choice === "Open AgentTracker") {
        vscode.commands.executeCommand("agentsync.openTracker");
      }
    });
  });
  const elapsedTimer = setInterval(() => {
    const folder = getActiveWorkspaceFolder();
    if (!folder) return;
    const statePath = getStatePath(folder);
    if (!fs.existsSync(statePath)) return;
    try {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      if (state.sessionActive) scheduleRefresh(folder, 0);
    } catch {
    }
  }, 60 * 1e3);
  const initCmd = vscode.commands.registerCommand("agentsync.init", () => initWorkspace(context));
  const openCmd = vscode.commands.registerCommand(
    "agentsync.openTracker",
    () => openTracker(context)
  );
  const openDashboardCmd = vscode.commands.registerCommand("agentsync.openDashboard", async () => {
    const opened = await openAgentSyncDashboard();
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Live dashboard not found. Run "View: Reset View Locations" and try again.'
      );
    }
  });
  const openPanelCmd = vscode.commands.registerCommand("agentsync.openPanel", async () => {
    const opened = await openAgentSyncPanel();
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Panel not found. Run "View: Reset View Locations" and then "AgentSync: Open Panel".'
      );
    }
  });
  const openTutorialCmd = vscode.commands.registerCommand("agentsync.openTutorial", async () => {
    const opened = await openAgentSyncTutorial(context);
    if (!opened) {
      vscode.window.showWarningMessage(
        'AgentSync: Could not open the walkthrough. Open "Getting Started" and select AgentSync.'
      );
    }
  });
  const openDocsCmd = vscode.commands.registerCommand("agentsync.openDocs", async () => {
    const opened = await openAgentSyncDocs(context);
    if (!opened) {
      vscode.window.showWarningMessage("AgentSync: Could not open the documentation URL.");
    }
  });
  const openHandoffsCmd = vscode.commands.registerCommand(
    "agentsync.openHandoffs",
    () => openHandoffs()
  );
  const openConfigCmd = vscode.commands.registerCommand(
    "agentsync.openConfig",
    () => openConfigFile()
  );
  const listHandoffsCmd = vscode.commands.registerCommand(
    "agentsync.listHandoffs",
    () => listHandoffsCommand()
  );
  const claimHandoffCmd = vscode.commands.registerCommand(
    "agentsync.claimHandoff",
    () => claimHandoffCommand()
  );
  const completeHandoffCmd = vscode.commands.registerCommand(
    "agentsync.completeHandoff",
    () => completeHandoffCommand()
  );
  const contextCapsuleCmd = vscode.commands.registerCommand(
    "agentsync.contextCapsule",
    () => contextCapsuleCommand()
  );
  const syncAgencyRunsCmd = vscode.commands.registerCommand(
    "agentsync.syncAgencyRuns",
    () => syncAgencyRunsCommand()
  );
  const clearActiveSessionCmd = vscode.commands.registerCommand(
    "agentsync.clearActiveSession",
    () => clearActiveSession()
  );
  const startCmd = vscode.commands.registerCommand(
    "agentsync.startSession",
    () => startSession(context)
  );
  const endCmd = vscode.commands.registerCommand("agentsync.endSession", () => endSession(context));
  const detectCmd = vscode.commands.registerCommand("agentsync.detectCommands", async () => {
    const workspaceFolder = await resolveWorkspaceFolder({ allowPick: true });
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("AgentSync: No workspace folder is open.");
      return;
    }
    const wrote = await autoDetectCommands(workspaceFolder, { force: true });
    if (!wrote) {
      vscode.window.showInformationMessage(
        "AgentSync: No new npm scripts detected, or .agentsync.json is already configured."
      );
    }
  });
  const contextStatusCmd = vscode.commands.registerCommand("agentsync.contextStatus", async () => {
    const workspaceFolder = await resolveWorkspaceFolder();
    if (!workspaceFolder) {
      vscode.window.showWarningMessage("AgentSync: No workspace folder is open.");
      return;
    }
    const snapshot = getWorkspaceSnapshot(workspaceFolder);
    const state = snapshot.state;
    const handoffInfo = snapshot.handoffInfo;
    const hotFiles = getHotFilesCached(workspaceFolder, { force: true });
    const inProgressLines = snapshot.inProgressLines || [];
    const openHandoffs2 = handoffInfo.handoffs.filter(
      (h) => OPEN_HANDOFF_STATUSES.has(String(h?.status || "").toLowerCase())
    ).length;
    const diffOutput = runGit(workspaceFolder, ["diff", "--shortstat"]) || "";
    const diffMatch = diffOutput.match(
      /(\d+) files? changed(?:, (\d+) insertions?)?(?:, (\d+) deletions?)?/
    );
    const filesChanged = diffMatch ? parseInt(diffMatch[1], 10) : 0;
    const insertions = diffMatch && diffMatch[2] ? parseInt(diffMatch[2], 10) : 0;
    const deletions = diffMatch && diffMatch[3] ? parseInt(diffMatch[3], 10) : 0;
    const totalChanges = insertions + deletions;
    let complexity = "Low";
    if (totalChanges > 500 || filesChanged > 10) complexity = "High";
    else if (totalChanges > 100 || filesChanged > 5) complexity = "Medium";
    let sessionDuration = "No active session";
    const sessionProvider = getSessionProviderInfo(state?.activeSession || state?.lastSession || null);
    const sessionPersonality = getSessionPersonalityInfo(workspaceFolder, state?.activeSession || null);
    if (state?.sessionActive && state?.activeSession?.startedAt) {
      const started = parseISODate(state.activeSession.startedAt);
      if (Number.isFinite(started)) {
        sessionDuration = formatElapsed(Date.now() - started);
      }
    }
    const lines = [
      `Session: ${state?.sessionActive ? "Active (" + sessionDuration + ")" : "Inactive"}`,
      `Provider: ${sessionProvider.label || "Unknown"}`,
      `Personality: ${state?.sessionActive ? sessionPersonality.name : "None"}`,
      `Hot files: ${hotFiles.length}`,
      `In-progress items: ${inProgressLines.length}`,
      `Open handoffs: ${openHandoffs2}`,
      `Diff: ${filesChanged} file(s), +${insertions} -${deletions}`,
      `Estimated complexity: ${complexity}`
    ];
    const missingHealthChecks = ["Build", "Tests", "Deploy"].filter((label) => {
      const entry = state?.health?.[label];
      return String(entry?.status ?? entry ?? "Not configured") === "Not configured";
    });
    if (missingHealthChecks.length > 0) {
      lines.push(`Setup needed: ${missingHealthChecks.join(", ")} health checks are not configured`);
    }
    if (state?.sessionMetrics) {
      lines.push(`Files modified this session: ${state.sessionMetrics.filesModified || 0}`);
      lines.push(`Commands run: ${state.sessionMetrics.commandsRun || 0}`);
    }
    if (complexity === "High") {
      lines.push("", "Consider ending this session and handing off to reduce context size.");
    }
    vscode.window.showInformationMessage("AgentSync Context Status", {
      modal: true,
      detail: lines.join("\n")
    });
  });
  const setRoleCmd = vscode.commands.registerCommand("agentsync.setRole", async () => {
    const folder = await resolveWorkspaceFolder({ allowPick: true });
    if (!folder) return;
    const existing = readAgentSyncConfig(folder)?.userProfile?.role || void 0;
    const role = await promptForRole(existing);
    if (role) {
      applyRolePreset(folder, role);
      vscode.window.showInformationMessage(`AgentSync: role set to ${role.replace(/_/g, " ")}`);
    }
  });
  const refreshCmd = vscode.commands.registerCommand("agentsync.refreshPanel", () => {
    scheduleRefresh();
  });
  const browseAgentsCmd = vscode.commands.registerCommand(
    "agentsync.browseAgents",
    () => browseAgentsCommand()
  );
  const runNextStepCmd = vscode.commands.registerCommand(
    "agentsync.runNextStep",
    () => runNextStepCommand()
  );
  const runWithAgentCmd = vscode.commands.registerCommand(
    "agentsync.runWithAgent",
    () => runWithAgentCommand()
  );
  const createPipelineCmd = vscode.commands.registerCommand(
    "agentsync.createPipeline",
    () => createPipelineCommand()
  );
  setTimeout(() => checkSessionOnStartup(context), 3e3);
  startSessionReminderTimer(context);
  context.subscriptions.push(
    statusItem,
    dashboardView,
    treeView,
    decorationProviderDisposable,
    trackerWatcher,
    configWatcher,
    handoffsWatcher,
    stateWatcher,
    requestWatcher,
    agencyEventsWatcher,
    agencyRunsWatcher,
    onEditorChange,
    onWorkspaceChange,
    onOpenDoc,
    {
      dispose: () => {
        for (const timer of metricDebounceTimers.values()) {
          clearTimeout(timer);
        }
        metricDebounceTimers.clear();
      }
    },
    {
      dispose: () => {
        if (refreshTimer) clearTimeout(refreshTimer);
      }
    },
    {
      dispose: () => {
        for (const timer of agencySyncTimers.values()) {
          clearTimeout(timer);
        }
        agencySyncTimers.clear();
      }
    },
    { dispose: () => clearInterval(elapsedTimer) },
    initCmd,
    openCmd,
    openDashboardCmd,
    openPanelCmd,
    openTutorialCmd,
    openDocsCmd,
    openHandoffsCmd,
    openConfigCmd,
    listHandoffsCmd,
    claimHandoffCmd,
    completeHandoffCmd,
    contextCapsuleCmd,
    syncAgencyRunsCmd,
    clearActiveSessionCmd,
    startCmd,
    endCmd,
    detectCmd,
    contextStatusCmd,
    setRoleCmd,
    refreshCmd,
    browseAgentsCmd,
    runNextStepCmd,
    runWithAgentCmd,
    createPipelineCmd
  );
}
function deactivate() {
}
module.exports = { activate, deactivate };
if (process.env.NODE_ENV === "test") {
  module.exports._testExports = {
    isEmptyValue,
    parseTracker,
    escapeRegExp,
    getSectionBody,
    setSectionBody,
    canonicalAgentId,
    parseISODate,
    parseCommandArgv,
    resolveHealthCheckProgram,
    validateHandoff,
    getOperationalState,
    formatElapsed,
    buildSessionIdentity,
    getSessionProviderInfo,
    getHandoffOwners,
    scoreNextTaskCapabilities,
    normalizeHandoffStatus,
    createHandoffRecord,
    claimHandoffRecord,
    completeHandoffRecord,
    listHandoffRecords,
    startSessionCore: (ws, agent, goal, opts) => SessionManager.startSessionCore(ws, agent, goal, opts),
    listRunnableQueuedHandoffs,
    syncAgencyRunsCore,
    generateContextCapsule,
    processDropZoneRequest
  };
}
//# sourceMappingURL=extension.js.map
