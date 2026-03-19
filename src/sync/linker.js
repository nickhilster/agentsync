const fs = require('fs')
const path = require('path')

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function backupExisting(filePath) {
  if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isSymbolicLink()) {
    const bak = `${filePath}.bak`
    fs.renameSync(filePath, bak)
    return { backedUp: true, bak }
  }
  return { backedUp: false }
}

function createSymlink(target, linkPath, type = 'file', opts = {}) {
  const { dryRun = false, allowWindowsBypass = false } = opts
  if (dryRun) return { action: 'dryrun', target, linkPath }

  if (
    process.platform === 'win32' &&
    !allowWindowsBypass &&
    process.env.AGENTSYNC_ALLOW_SYMLINKS !== '1'
  ) {
    throw new Error(
      'Symlink creation on Windows requires Developer Mode or AGENTSYNC_ALLOW_SYMLINKS=1'
    )
  }

  ensureDir(path.dirname(linkPath))
  if (fs.existsSync(linkPath)) {
    // remove existing file/link forcefully without raising when absent
    try {
      fs.rmSync(linkPath, { force: true, recursive: false })
    } catch {}
  }
  try {
    fs.symlinkSync(target, linkPath, type)
    return { action: 'created', target, linkPath }
  } catch (e) {
    // On Windows without privileges, fall back to copying the file
    if (e && (e.code === 'EPERM' || e.code === 'EACCES')) {
      fs.copyFileSync(target, linkPath)
      return { action: 'copied', target, linkPath }
    }
    throw e
  }
}

function syncAgentFiles(workspaceRoot, mappings = [], options = {}) {
  const results = []
  mappings.forEach((m) => {
    const src = path.resolve(workspaceRoot, m.source)
    const dest = path.resolve(workspaceRoot, m.dest)
    ensureDir(path.dirname(dest))
    const backup = backupExisting(dest)
    if (options.dryRun) {
      results.push({ src, dest, backup, action: 'dryrun' })
      return
    }
    try {
      const allowWindowsBypass =
        options.allowWindowsBypass || process.env.AGENTSYNC_ALLOW_SYMLINKS === '1'
      createSymlink(src, dest, m.type || 'file', { dryRun: false, allowWindowsBypass })
      results.push({ src, dest, backup, action: 'linked' })
    } catch (e) {
      results.push({ src, dest, backup, action: 'error', error: String(e) })
    }
  })
  return results
}

module.exports = { ensureDir, backupExisting, createSymlink, syncAgentFiles }
