'use strict'

const fs = require('fs')

/**
 * Write a file atomically: write to a .tmp sibling then rename.
 * Prevents partial-write corruption if VS Code or the OS crashes mid-write.
 * On same-volume targets this rename is atomic on both NTFS and POSIX file systems.
 * C3 fix.
 * @param {string} filePath
 * @param {string} content
 * @param {BufferEncoding} [encoding]
 */
function atomicWriteFileSync(filePath, content, encoding = 'utf8') {
  const tmpPath = `${filePath}.tmp`
  fs.writeFileSync(tmpPath, content, encoding)
  fs.renameSync(tmpPath, filePath)
}

/**
 * Parse an ISO 8601 timestamp string into a numeric epoch ms value.
 * Returns NaN for non-ISO strings, avoiding silent misparse from Date.parse().
 * M5 fix.
 * @param {string | null | undefined} str
 * @returns {number}
 */
function parseISODate(str) {
  if (!str || typeof str !== 'string') return NaN
  // Require at least YYYY-MM-DDTHH:MM prefix to reject locale date strings
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) return NaN
  return Date.parse(str)
}

/**
 * Tokenise a command string into [program, ...args] without invoking a shell.
 * Handles quoted substrings (" and ') and backslash escapes within quotes.
 * Does NOT support shell operators (&&, ||, ;, |, $(), backticks) — use a
 * shell script file if you need composition in a health check command.
 * C1 fix: prevents shell injection via user-controlled .agentsync.json commands.
 * @param {string} cmd
 * @returns {string[]}
 */
function parseCommandArgv(cmd) {
  const args = []
  let current = ''
  let i = 0
  while (i < cmd.length) {
    const ch = cmd[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      while (i < cmd.length && cmd[i] !== quote) {
        if (cmd[i] === '\\' && i + 1 < cmd.length) {
          i++
          current += cmd[i]
        } else {
          current += cmd[i]
        }
        i++
      }
      // skip closing quote (i++ at end of outer loop handles it)
    } else if (ch === ' ' || ch === '\t') {
      if (current.length > 0) {
        args.push(current)
        current = ''
      }
    } else {
      current += ch
    }
    i++
  }
  if (current.length > 0) args.push(current)
  return args
}

/**
 * Create a nonce for webview script/style tags.
 * @returns {string}
 */
function createNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''
  for (let i = 0; i < 32; i += 1) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

module.exports = {
  atomicWriteFileSync,
  parseISODate,
  parseCommandArgv,
  createNonce
}
