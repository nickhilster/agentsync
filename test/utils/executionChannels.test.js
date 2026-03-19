const path = require('path')
const fs = require('fs')
const os = require('os')
const {
  assembleAgentPrompt,
  writeToDropZone,
  injectPersonalitySection,
  removePersonalitySection
} = require('../../src/utils/executionChannels')

describe('assembleAgentPrompt', () => {
  const agent = {
    name: 'Test Agent',
    description: 'A testing agent',
    promptBody: 'You are a testing expert.',
    id: 'testing/test-agent',
    category: 'testing'
  }

  test('assembles a complete prompt', () => {
    const prompt = assembleAgentPrompt(agent, 'Fix the tests')
    expect(prompt).toContain('# System Prompt')
    expect(prompt).toContain('You are Test Agent.')
    expect(prompt).toContain('A testing agent')
    expect(prompt).toContain('## User Instruction')
    expect(prompt).toContain('Fix the tests')
    expect(prompt).toContain('## Agent Prompt Body')
    expect(prompt).toContain('You are a testing expert.')
  })

  test('includes context files when provided', () => {
    const prompt = assembleAgentPrompt(agent, 'Fix tests', {
      contextFiles: ['src/app.js', 'test/app.test.js']
    })
    expect(prompt).toContain('## Context Files')
    expect(prompt).toContain('- src/app.js')
  })

  test('includes previous output when provided', () => {
    const prompt = assembleAgentPrompt(agent, 'Continue', {
      previousOutput: 'Step 1 completed.'
    })
    expect(prompt).toContain('## Previous Agent Output')
    expect(prompt).toContain('Step 1 completed.')
  })
})

describe('writeToDropZone', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsync-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('writes prompt to .agentsync/agent-prompt.md', () => {
    const ok = writeToDropZone(tmpDir, '# Test Prompt')
    expect(ok).toBe(true)
    const content = fs.readFileSync(
      path.join(tmpDir, '.agentsync', 'agent-prompt.md'),
      'utf8'
    )
    expect(content).toBe('# Test Prompt')
  })

  test('creates .agentsync directory if needed', () => {
    writeToDropZone(tmpDir, 'content')
    expect(fs.existsSync(path.join(tmpDir, '.agentsync'))).toBe(true)
  })
})

describe('personality injection', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentsync-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  const agent = {
    id: 'engineering/senior-dev',
    name: 'Senior Dev',
    category: 'engineering',
    description: 'A senior developer',
    promptBody: 'You build premium web experiences.'
  }

  test('injects personality section into a file', () => {
    const filePath = path.join(tmpDir, 'CLAUDE.md')
    fs.writeFileSync(filePath, '# Existing Content\n\nSome text.\n', 'utf8')

    injectPersonalitySection(filePath, agent)

    const content = fs.readFileSync(filePath, 'utf8')
    expect(content).toContain('## Active Agent Personality')
    expect(content).toContain('Senior Dev')
    expect(content).toContain('engineering/senior-dev')
    expect(content).toContain('You build premium web experiences.')
    expect(content).toContain('# Existing Content')
  })

  test('replaces existing personality section on re-inject', () => {
    const filePath = path.join(tmpDir, 'CLAUDE.md')
    fs.writeFileSync(filePath, '# Header\n', 'utf8')

    injectPersonalitySection(filePath, agent)
    injectPersonalitySection(filePath, { ...agent, name: 'New Agent' })

    const content = fs.readFileSync(filePath, 'utf8')
    const matches = content.match(/## Active Agent Personality/g)
    expect(matches).toHaveLength(1)
    expect(content).toContain('New Agent')
  })

  test('removes personality section', () => {
    const filePath = path.join(tmpDir, 'CLAUDE.md')
    fs.writeFileSync(filePath, '# Header\n', 'utf8')

    injectPersonalitySection(filePath, agent)
    expect(fs.readFileSync(filePath, 'utf8')).toContain('## Active Agent Personality')

    removePersonalitySection(filePath)
    expect(fs.readFileSync(filePath, 'utf8')).not.toContain('## Active Agent Personality')
    expect(fs.readFileSync(filePath, 'utf8')).toContain('# Header')
  })

  test('handles non-existent file gracefully', () => {
    const filePath = path.join(tmpDir, 'nonexistent.md')
    expect(() => injectPersonalitySection(filePath, agent)).not.toThrow()
    expect(() => removePersonalitySection(filePath)).not.toThrow()
  })
})
