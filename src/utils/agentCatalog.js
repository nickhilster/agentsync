'use strict'

const fs = require('fs')
const path = require('path')

// ━━━ Constants ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEFAULT_CATEGORY_DIRS = [
  'engineering',
  'design',
  'marketing',
  'product',
  'project-management',
  'support',
  'testing',
  'specialized',
  'spatial-computing',
  'strategy'
]

const CATEGORY_COLOR_FALLBACKS = {
  engineering: 'cyan',
  design: 'purple',
  marketing: 'blue',
  product: 'green',
  'project-management': 'gold',
  support: 'teal',
  testing: 'orange',
  specialized: 'indigo',
  'spatial-computing': 'neon-cyan',
  strategy: 'emerald'
}

/**
 * Maps agent categories to AgentSync capability strings used in handoff routing.
 */
const CATEGORY_CAPABILITY_MAP = {
  engineering: ['implementation', 'architecture'],
  design: ['design', 'ux'],
  marketing: ['content', 'marketing'],
  product: ['product_planning', 'analysis'],
  'project-management': ['coordination', 'planning'],
  support: ['documentation', 'support'],
  testing: ['testing', 'qa'],
  specialized: ['data', 'automation'],
  'spatial-computing': ['xr', 'spatial'],
  strategy: ['strategy', 'analysis']
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/
const _catalogCache = new Map()

// ━━━ Frontmatter parsing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse YAML-like frontmatter from markdown content.
 * @param {string} content
 * @returns {{ frontmatter: Record<string, string>, body: string, warnings: string[] }}
 */
function parseFrontmatter(content) {
  const warnings = []
  const match = content.match(FRONTMATTER_REGEX)
  if (!match) {
    return { frontmatter: {}, body: content, warnings: ['Frontmatter block is missing.'] }
  }

  const frontmatterBlock = match[1] || ''
  const body = content.slice(match[0].length)
  const frontmatter = {}

  for (const rawLine of frontmatterBlock.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf(':')
    if (separatorIndex === -1) {
      warnings.push('Invalid frontmatter line: "' + line + '"')
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const value = line.slice(separatorIndex + 1).trim()
    if (!key) {
      warnings.push('Frontmatter key is empty in line: "' + line + '"')
      continue
    }

    frontmatter[key] = stripWrappingQuotes(value)
  }

  return { frontmatter, body, warnings }
}

// ━━━ File helpers ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function normalizePath(value) {
  return value.replace(/\\/g, '/')
}

function stripWrappingQuotes(value) {
  if (!value) return value
  const hasDoubleQuotes = value.startsWith('"') && value.endsWith('"')
  const hasSingleQuotes = value.startsWith("'") && value.endsWith("'")
  if (hasDoubleQuotes || hasSingleQuotes) return value.slice(1, -1)
  return value
}

function parseTools(rawTools) {
  if (!rawTools || !rawTools.trim()) return []
  return rawTools
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

function extractFirstHeading(body) {
  const headingMatch = body.match(/^#\s+(.+)$/m)
  if (!headingMatch) return ''
  return (headingMatch[1] || '').trim()
}

function headingContainsName(heading, name) {
  return heading.toLowerCase().includes(name.toLowerCase())
}

/**
 * Recursively list .md files under a directory.
 * @param {string} rootDir
 * @returns {string[]}
 */
function listMarkdownFilesSync(rootDir) {
  const files = []

  function walk(currentDir) {
    let entries
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        walk(absolutePath)
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
        files.push(absolutePath)
      }
    }
  }

  walk(rootDir)
  return files.sort()
}

// ━━━ Agent parsing ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Parse a single agent markdown file into an AgentDefinition.
 * @param {string} content
 * @param {{ category: string, sourcePath: string, filePath: string }} context
 * @returns {object}
 */
function parseAgentFile(content, context) {
  const { frontmatter, body, warnings } = parseFrontmatter(content)
  const validationWarnings = [...warnings]

  const fallbackName = path.basename(context.filePath, '.md')
  const name = (frontmatter.name || '').trim() || fallbackName
  if (!(frontmatter.name || '').trim()) {
    validationWarnings.push('Missing frontmatter field: name')
  }

  const description = (frontmatter.description || '').trim() || 'No description provided.'
  if (!(frontmatter.description || '').trim()) {
    validationWarnings.push('Missing frontmatter field: description')
  }

  const categoryFallback = CATEGORY_COLOR_FALLBACKS[context.category] || 'slate'
  const color = (frontmatter.color || '').trim() || categoryFallback
  if (!(frontmatter.color || '').trim()) {
    validationWarnings.push('Missing frontmatter field: color. Using fallback "' + categoryFallback + '".')
  }

  const tools = parseTools(frontmatter.tools)
  const title = extractFirstHeading(body)
  if (title && !headingContainsName(title, name)) {
    validationWarnings.push(
      'Heading/title mismatch. First heading "' + title + '" does not include agent name "' + name + '".'
    )
  }

  return {
    id: context.category + '/' + path.basename(context.sourcePath, '.md'),
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
  }
}

/**
 * Annotate agents with duplicate name warnings.
 * @param {object[]} agents
 */
function annotateDuplicateNameWarnings(agents) {
  const groups = new Map()
  for (const agent of agents) {
    const key = agent.name.trim().toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(agent)
  }
  for (const [nameKey, groupedAgents] of groups) {
    if (groupedAgents.length < 2) continue
    for (const agent of groupedAgents) {
      agent.validationWarnings.push(
        'Duplicate agent name detected ("' + nameKey + '"). Review uniqueness across categories.'
      )
    }
  }
}

// ━━━ Catalog builder ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Build a catalog index from one or more root directories.
 * @param {{ rootDirs: string[], categories?: string[] }} options
 * @returns {{ schemaVersion: string, agents: object[], categories: string[], lastIndexedAt: string }}
 */
function buildCatalog(options) {
  const categories = Array.isArray(options.categories) && options.categories.length > 0
    ? options.categories
    : [...DEFAULT_CATEGORY_DIRS]

  const rootDirs = Array.isArray(options.rootDirs) ? options.rootDirs : [options.rootDir || '.']
  const agents = []
  const seenIds = new Set()

  for (const rootDir of rootDirs) {
    if (!fs.existsSync(rootDir)) continue

    for (const category of categories) {
      const categoryDir = path.join(rootDir, category)
      if (!fs.existsSync(categoryDir)) continue

      const markdownFiles = listMarkdownFilesSync(categoryDir)
      for (const filePath of markdownFiles) {
        let content
        try {
          content = fs.readFileSync(filePath, 'utf8')
        } catch {
          continue
        }
        const relativePath = normalizePath(path.relative(rootDir, filePath))
        const agent = parseAgentFile(content, {
          category,
          sourcePath: relativePath,
          filePath
        })

        // Later root directories override earlier ones on ID collision (workspace overrides bundled)
        if (seenIds.has(agent.id)) {
          const idx = agents.findIndex((a) => a.id === agent.id)
          if (idx >= 0) agents[idx] = agent
        } else {
          seenIds.add(agent.id)
          agents.push(agent)
        }
      }
    }
  }

  annotateDuplicateNameWarnings(agents)

  return {
    schemaVersion: '1.0.0',
    agents,
    categories: Array.from(new Set(agents.map((a) => a.category))).sort(),
    lastIndexedAt: new Date().toISOString()
  }
}

/**
 * Create a file system watcher that rebuilds the catalog on changes.
 * @param {{ rootDirs: string[], categories?: string[] }} options
 * @param {function} onChange
 * @returns {{ close: function }}
 */
function createCatalogWatcher(options, onChange) {
  const categories = Array.isArray(options.categories) && options.categories.length > 0
    ? options.categories
    : [...DEFAULT_CATEGORY_DIRS]

  const rootDirs = Array.isArray(options.rootDirs) ? options.rootDirs : [options.rootDir || '.']
  const watchers = []
  let timer = null

  const scheduleRefresh = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        const updated = buildCatalog(options)
        onChange(updated)
      } catch {
        // Keep watcher resilient
      }
    }, 200)
  }

  for (const rootDir of rootDirs) {
    for (const category of categories) {
      const categoryDir = path.join(rootDir, category)
      if (!fs.existsSync(categoryDir)) continue
      try {
        const watcher = fs.watch(categoryDir, { recursive: true }, scheduleRefresh)
        watchers.push(watcher)
      } catch {
        // fs.watch may not be supported on all platforms
      }
    }
  }

  return {
    close: () => {
      if (timer) clearTimeout(timer)
      for (const watcher of watchers) {
        watcher.close()
      }
    }
  }
}

// ━━━ Prompt assembly (ported from orchestrator-core) ━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a system-level prompt from an agent definition.
 * @param {object} agent - An agent definition from the catalog
 * @returns {string}
 */
function createSystemPrompt(agent) {
  return [
    'You are ' + agent.name + '.',
    agent.description,
    'Follow your role definition and deliver concise, actionable output.',
    'If handing off to another agent, provide a clear summary of decisions and outputs.'
  ].join('\n\n')
}

/**
 * Create a full prompt from an agent, instruction, and optional context.
 * @param {object} agent - An agent definition from the catalog
 * @param {string} userInstruction
 * @param {string} [previousOutput]
 * @param {string[]} [contextFiles]
 * @returns {string}
 */
function createPrompt(agent, userInstruction, previousOutput, contextFiles) {
  const lines = [
    '## Agent Prompt Body',
    agent.promptBody,
    '',
    '## User Instruction',
    userInstruction
  ]

  if (contextFiles && contextFiles.length > 0) {
    lines.push('', '## Context Files', ...contextFiles.map((entry) => '- ' + entry))
  }

  if (previousOutput && previousOutput.trim()) {
    lines.push('', '## Previous Agent Output', previousOutput)
  }

  return lines.join('\n')
}

// ━━━ Capability mapping ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Map an agent definition to AgentSync capability strings.
 * @param {object} agentDef - An agent definition from the catalog
 * @returns {string[]}
 */
function mapAgentToCapabilities(agentDef) {
  if (!agentDef || !agentDef.category) return []
  return CATEGORY_CAPABILITY_MAP[agentDef.category] || []
}

/**
 * Find the best matching agent(s) for a set of required capabilities.
 * @param {object[]} agents - Array of agent definitions
 * @param {string[]} requiredCapabilities
 * @returns {object[]} Sorted by match score (best first)
 */
function matchAgentsByCapabilities(agents, requiredCapabilities) {
  if (!requiredCapabilities || requiredCapabilities.length === 0) return []
  const requiredSet = new Set(requiredCapabilities.map((c) => c.toLowerCase()))

  const scored = agents.map((agent) => {
    const agentCaps = mapAgentToCapabilities(agent)
    const matchCount = agentCaps.filter((c) => requiredSet.has(c.toLowerCase())).length
    return { agent, score: matchCount }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.agent)
}

/**
 * Load and cache the bundled/workspace agent catalog.
 * @param {import('vscode').WorkspaceFolder | null} [workspaceFolder]
 * @returns {{ schemaVersion: string, agents: object[], categories: string[], lastIndexedAt: string }}
 */
function getAgentCatalog(workspaceFolder) {
  const cacheKey = workspaceFolder?.uri?.fsPath || '__global__'
  const cached = _catalogCache.get(cacheKey)
  if (cached) return cached

  const bundledDir = path.join(__dirname, '..', '..', 'templates', 'agents')
  const rootDirs = [bundledDir]

  if (workspaceFolder) {
    const workspaceAgentsDir = path.join(workspaceFolder.uri.fsPath, '.agentsync', 'agents')
    if (fs.existsSync(workspaceAgentsDir)) {
      rootDirs.push(workspaceAgentsDir)
    }
  }

  const catalog = buildCatalog({ rootDirs })
  _catalogCache.set(cacheKey, catalog)
  return catalog
}

// ━━━ Exports ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

module.exports = {
  DEFAULT_CATEGORY_DIRS,
  CATEGORY_COLOR_FALLBACKS,
  CATEGORY_CAPABILITY_MAP,
  buildCatalog,
  createCatalogWatcher,
  parseFrontmatter,
  parseAgentFile,
  createSystemPrompt,
  createPrompt,
  mapAgentToCapabilities,
  matchAgentsByCapabilities,
  getAgentCatalog
}
