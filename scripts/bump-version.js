'use strict'

const cp = require('child_process')
const fs = require('fs')
const path = require('path')

const type = process.argv[2] || 'patch'
const allowed = new Set(['patch', 'minor', 'major'])

if (!allowed.has(type)) {
  console.error('Usage: node scripts/bump-version.js [patch|minor|major]')
  process.exit(1)
}

function run(command, args) {
  const result = cp.spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
run(npmCmd, ['version', type, '--no-git-tag-version'])

const pkgPath = path.join(process.cwd(), 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const nextVersion = pkg.version

console.log(`Bumped to v${nextVersion}`)

run('git', ['add', 'package.json'])

console.log('')
console.log('Next steps:')
console.log(`  1. Update CHANGELOG.md - add a '## [${nextVersion}]' block at the top`)
console.log('  2. git add CHANGELOG.md')
console.log(`  3. git commit -m "chore: release v${nextVersion}"`)
console.log(`  4. git tag v${nextVersion}`)
console.log('  5. git push && git push --tags')
console.log('')
console.log('  Pushing the tag triggers .github/workflows/release.yml automatically.')
