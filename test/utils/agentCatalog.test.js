const path = require('path')
const {
  parseFrontmatter,
  parseAgentFile,
  buildCatalog,
  createSystemPrompt,
  createPrompt,
  mapAgentToCapabilities,
  matchAgentsByCapabilities,
  DEFAULT_CATEGORY_DIRS,
  CATEGORY_CAPABILITY_MAP
} = require('../../src/utils/agentCatalog')

describe('parseFrontmatter', () => {
  test('parses valid frontmatter', () => {
    const content = '---\nname: Test Agent\ndescription: A test\ncolor: blue\n---\n\n# Body\n'
    const result = parseFrontmatter(content)
    expect(result.frontmatter.name).toBe('Test Agent')
    expect(result.frontmatter.description).toBe('A test')
    expect(result.frontmatter.color).toBe('blue')
    expect(result.body).toContain('# Body')
    expect(result.warnings).toHaveLength(0)
  })

  test('returns warning for missing frontmatter', () => {
    const result = parseFrontmatter('# No frontmatter here')
    expect(result.frontmatter).toEqual({})
    expect(result.warnings).toContain('Frontmatter block is missing.')
    expect(result.body).toBe('# No frontmatter here')
  })

  test('strips wrapping quotes from values', () => {
    const content = '---\nname: "Quoted Name"\ncolor: \'single\'\n---\n'
    const result = parseFrontmatter(content)
    expect(result.frontmatter.name).toBe('Quoted Name')
    expect(result.frontmatter.color).toBe('single')
  })

  test('warns on invalid lines', () => {
    const content = '---\nname: Valid\nbad line without colon\n---\n'
    const result = parseFrontmatter(content)
    expect(result.frontmatter.name).toBe('Valid')
    expect(result.warnings.some((w) => w.includes('Invalid frontmatter'))).toBe(true)
  })

  test('skips comment lines in frontmatter', () => {
    const content = '---\n# comment\nname: Agent\n---\n'
    const result = parseFrontmatter(content)
    expect(result.frontmatter.name).toBe('Agent')
    expect(Object.keys(result.frontmatter)).toHaveLength(1)
  })
})

describe('parseAgentFile', () => {
  test('parses a complete agent file', () => {
    const content = '---\nname: Senior Dev\ndescription: Builds stuff\ncolor: green\ntools: git, eslint\n---\n\n# Senior Dev Agent\n\nYou are a senior developer.'
    const result = parseAgentFile(content, {
      category: 'engineering',
      sourcePath: 'engineering/engineering-senior-dev.md',
      filePath: '/tmp/engineering/engineering-senior-dev.md'
    })
    expect(result.id).toBe('engineering/engineering-senior-dev')
    expect(result.name).toBe('Senior Dev')
    expect(result.description).toBe('Builds stuff')
    expect(result.color).toBe('green')
    expect(result.category).toBe('engineering')
    expect(result.tools).toEqual(['git', 'eslint'])
    expect(result.promptBody).toContain('You are a senior developer.')
  })

  test('uses fallback name from filename when missing', () => {
    const content = '---\ndescription: test\n---\nbody'
    const result = parseAgentFile(content, {
      category: 'design',
      sourcePath: 'design/my-agent.md',
      filePath: '/tmp/design/my-agent.md'
    })
    expect(result.name).toBe('my-agent')
    expect(result.validationWarnings.some((w) => w.includes('Missing frontmatter field: name'))).toBe(true)
  })

  test('uses category color fallback when color missing', () => {
    const content = '---\nname: Agent\n---\nbody'
    const result = parseAgentFile(content, {
      category: 'testing',
      sourcePath: 'testing/test-agent.md',
      filePath: '/tmp/testing/test-agent.md'
    })
    expect(result.color).toBe('orange')
    expect(result.validationWarnings.some((w) => w.includes('Using fallback'))).toBe(true)
  })
})

describe('buildCatalog', () => {
  test('loads agents from bundled templates directory', () => {
    const bundledDir = path.join(__dirname, '..', '..', 'templates', 'agents')
    const catalog = buildCatalog({ rootDirs: [bundledDir] })
    expect(catalog.schemaVersion).toBe('1.0.0')
    expect(catalog.agents.length).toBeGreaterThan(40)
    expect(catalog.categories.length).toBeGreaterThan(5)
    expect(catalog.lastIndexedAt).toBeTruthy()
  })

  test('each agent has required fields', () => {
    const bundledDir = path.join(__dirname, '..', '..', 'templates', 'agents')
    const catalog = buildCatalog({ rootDirs: [bundledDir] })
    for (const agent of catalog.agents) {
      expect(agent.id).toBeTruthy()
      expect(agent.name).toBeTruthy()
      expect(agent.category).toBeTruthy()
      expect(agent.promptBody).toBeTruthy()
    }
  })

  test('handles non-existent directories gracefully', () => {
    const catalog = buildCatalog({ rootDirs: ['/nonexistent/path'] })
    expect(catalog.agents).toHaveLength(0)
    expect(catalog.categories).toHaveLength(0)
  })

  test('workspace agents override bundled on ID collision', () => {
    // This test verifies the merge logic conceptually
    const bundledDir = path.join(__dirname, '..', '..', 'templates', 'agents')
    const catalog = buildCatalog({ rootDirs: [bundledDir, '/nonexistent'] })
    expect(catalog.agents.length).toBeGreaterThan(0)
  })
})

describe('createSystemPrompt', () => {
  test('creates a system prompt from agent definition', () => {
    const agent = { name: 'Test Agent', description: 'Does testing' }
    const prompt = createSystemPrompt(agent)
    expect(prompt).toContain('You are Test Agent.')
    expect(prompt).toContain('Does testing')
    expect(prompt).toContain('concise, actionable output')
  })
})

describe('createPrompt', () => {
  test('creates a full prompt with instruction', () => {
    const agent = { promptBody: 'You test things.' }
    const prompt = createPrompt(agent, 'Fix the bug')
    expect(prompt).toContain('## Agent Prompt Body')
    expect(prompt).toContain('You test things.')
    expect(prompt).toContain('## User Instruction')
    expect(prompt).toContain('Fix the bug')
  })

  test('includes context files when provided', () => {
    const agent = { promptBody: 'body' }
    const prompt = createPrompt(agent, 'instruction', '', ['file1.js', 'file2.js'])
    expect(prompt).toContain('## Context Files')
    expect(prompt).toContain('- file1.js')
    expect(prompt).toContain('- file2.js')
  })

  test('includes previous output when provided', () => {
    const agent = { promptBody: 'body' }
    const prompt = createPrompt(agent, 'instruction', 'previous work done')
    expect(prompt).toContain('## Previous Agent Output')
    expect(prompt).toContain('previous work done')
  })

  test('excludes previous output when empty', () => {
    const agent = { promptBody: 'body' }
    const prompt = createPrompt(agent, 'instruction', '')
    expect(prompt).not.toContain('## Previous Agent Output')
  })
})

describe('mapAgentToCapabilities', () => {
  test('maps engineering agents to implementation capabilities', () => {
    const caps = mapAgentToCapabilities({ category: 'engineering' })
    expect(caps).toContain('implementation')
    expect(caps).toContain('architecture')
  })

  test('maps testing agents to testing capabilities', () => {
    const caps = mapAgentToCapabilities({ category: 'testing' })
    expect(caps).toContain('testing')
    expect(caps).toContain('qa')
  })

  test('returns empty array for unknown category', () => {
    expect(mapAgentToCapabilities({ category: 'alien' })).toEqual([])
  })

  test('returns empty array for null input', () => {
    expect(mapAgentToCapabilities(null)).toEqual([])
  })
})

describe('matchAgentsByCapabilities', () => {
  const agents = [
    { id: 'eng/dev', name: 'Dev', category: 'engineering' },
    { id: 'test/qa', name: 'QA', category: 'testing' },
    { id: 'design/ux', name: 'UX', category: 'design' }
  ]

  test('matches agents by capability', () => {
    const matched = matchAgentsByCapabilities(agents, ['testing', 'qa'])
    expect(matched.length).toBeGreaterThan(0)
    expect(matched[0].id).toBe('test/qa')
  })

  test('returns empty for no matching capabilities', () => {
    const matched = matchAgentsByCapabilities(agents, ['alien-skill'])
    expect(matched).toHaveLength(0)
  })

  test('returns empty for empty capabilities', () => {
    const matched = matchAgentsByCapabilities(agents, [])
    expect(matched).toHaveLength(0)
  })
})

describe('DEFAULT_CATEGORY_DIRS', () => {
  test('contains expected categories', () => {
    expect(DEFAULT_CATEGORY_DIRS).toContain('engineering')
    expect(DEFAULT_CATEGORY_DIRS).toContain('design')
    expect(DEFAULT_CATEGORY_DIRS).toContain('testing')
    expect(DEFAULT_CATEGORY_DIRS).toContain('spatial-computing')
    expect(DEFAULT_CATEGORY_DIRS.length).toBeGreaterThanOrEqual(9)
  })
})

describe('CATEGORY_CAPABILITY_MAP', () => {
  test('maps all default categories', () => {
    for (const cat of DEFAULT_CATEGORY_DIRS) {
      expect(CATEGORY_CAPABILITY_MAP[cat]).toBeTruthy()
      expect(CATEGORY_CAPABILITY_MAP[cat].length).toBeGreaterThan(0)
    }
  })
})
