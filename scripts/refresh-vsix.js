#!/usr/bin/env node

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const workspaceRoot = path.resolve(__dirname, '..')
const extensionId = 'Teambotics.agentsync'
const defaultVsixName = 'agentsync-local.vsix'
const isWindows = process.platform === 'win32'

function hasFlag(flag) {
  return process.argv.includes(flag)
}

function readArg(name) {
  const idx = process.argv.indexOf(name)
  if (idx < 0) return null
  return process.argv[idx + 1] || null
}

function printHelp() {
  console.log('Usage: node scripts/refresh-vsix.js [options]')
  console.log('')
  console.log('Options:')
  console.log('  --skip-package      Skip packaging and use an existing VSIX file')
  console.log('  --skip-install      Package only, do not install')
  console.log('  --vsix <path>       VSIX output/input path (default: agentsync-local.vsix)')
  console.log('  --help              Show this help message')
  console.log('')
  console.log('Environment variables:')
  console.log(
    '  CODE_CLI            Explicit VS Code CLI command/path (ex: code, code-insiders, C:\\...\\code.cmd)'
  )
}

function run(command, args, options = {}) {
  const result = isWindows
    ? spawnSync(toShellCommand(command, args), {
        cwd: workspaceRoot,
        stdio: 'inherit',
        shell: true,
        ...options
      })
    : spawnSync(command, args, {
        cwd: workspaceRoot,
        stdio: 'inherit',
        ...options
      })

  if (result.error) {
    return { ok: false, status: result.status ?? 1, error: result.error }
  }

  return { ok: result.status === 0, status: result.status ?? 0 }
}

function canRun(command) {
  const result = isWindows
    ? spawnSync(toShellCommand(command, ['--version']), {
        cwd: workspaceRoot,
        stdio: 'pipe',
        shell: true
      })
    : spawnSync(command, ['--version'], {
        cwd: workspaceRoot,
        stdio: 'pipe'
      })

  return !result.error && result.status === 0
}

function quoteForShell(value) {
  const text = String(value)
  if (/^[a-zA-Z0-9_./:=+-]+$/.test(text)) return text
  return `"${text.replace(/"/g, '\\"')}"`
}

function toShellCommand(command, args) {
  return [command, ...args].map(quoteForShell).join(' ')
}

function resolveCodeCli() {
  const candidates = []

  if (process.env.CODE_CLI) candidates.push(process.env.CODE_CLI)
  candidates.push('code', 'code-insiders')

  if (isWindows && process.env.LOCALAPPDATA) {
    candidates.push(
      path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd')
    )
    candidates.push(
      path.join(
        process.env.LOCALAPPDATA,
        'Programs',
        'Microsoft VS Code Insiders',
        'bin',
        'code-insiders.cmd'
      )
    )
  }

  for (const candidate of candidates) {
    if (canRun(candidate)) return candidate
  }

  return null
}

function fail(message) {
  console.error(`\n[vsix:refresh] ${message}`)
  process.exit(1)
}

if (hasFlag('--help')) {
  printHelp()
  process.exit(0)
}

const skipPackage = hasFlag('--skip-package')
const skipInstall = hasFlag('--skip-install')
const vsixArg = readArg('--vsix')
const vsixPath = path.resolve(workspaceRoot, vsixArg || defaultVsixName)

if (!skipPackage) {
  console.log(`\n[vsix:refresh] Packaging extension to: ${vsixPath}`)
  const pack = run('npx', ['--yes', '@vscode/vsce', 'package', '--out', vsixPath])
  if (!pack.ok) fail('Packaging failed.')
}

if (!fs.existsSync(vsixPath)) {
  fail(`VSIX not found at ${vsixPath}.`)
}

if (skipInstall) {
  console.log('\n[vsix:refresh] Packaging complete. Install step skipped.')
  process.exit(0)
}

const codeCli = resolveCodeCli()
if (!codeCli) {
  fail(
    [
      'Could not find a VS Code CLI command.',
      "Install the 'code' shell command or set CODE_CLI to your CLI path, then rerun."
    ].join(' ')
  )
}

console.log(`\n[vsix:refresh] Using VS Code CLI: ${codeCli}`)
console.log(`[vsix:refresh] Uninstalling previous version (${extensionId}) if present...`)
run(codeCli, ['--uninstall-extension', extensionId])

console.log(`[vsix:refresh] Installing ${vsixPath}...`)
const install = run(codeCli, ['--install-extension', vsixPath, '--force'])
if (!install.ok) fail('VSIX install failed.')

console.log('\n[vsix:refresh] Done. Reload VS Code window to verify the updated extension.')
