'use strict'

const { PLACEHOLDER, EM_DASH } = require('./constants')

/**
 * Whether a parsed value should be treated as empty.
 * @param {string | undefined | null} value
 */
function isEmptyValue(value) {
  const normalized = (value || '').trim()
  return normalized.length === 0 || normalized === PLACEHOLDER || normalized === EM_DASH
}

/**
 * Escape a string for use in a regular expression.
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse AgentTracker.md content for status and automation.
 * @param {string} content
 */
function parseTracker(content) {
  const pick = (label) => {
    const match = content.match(new RegExp(`\\*\\*${escapeRegExp(label)}:\\*\\*\\s*(.+)`))
    return match?.[1]?.trim() ?? PLACEHOLDER
  }

  return {
    agent: pick('Agent'),
    date: pick('Date'),
    summary: pick('Summary'),
    branch: pick('Branch'),
    commit: pick('Commit')
  }
}

/**
 * Get the content body for a given section heading.
 * @param {string} content
 * @param {string} heading
 * @returns {string}
 */
function getSectionBody(content, heading) {
  const matcher = new RegExp(
    `## ${escapeRegExp(heading)}\\r?\\n\\r?\\n([\\s\\S]*?)(?=\\r?\\n## |$)`,
    'm'
  )
  const match = content.match(matcher)
  return match?.[1]?.trim() ?? ''
}

/**
 * Replace a section body and keep the rest of the document intact.
 * @param {string} content
 * @param {string} heading
 * @param {string} body
 * @returns {string}
 */
function setSectionBody(content, heading, body) {
  const normalizedBody = body.trimEnd()
  const matcher = new RegExp(
    `(## ${escapeRegExp(heading)}\\r?\\n\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |$)`,
    'm'
  )

  if (matcher.test(content)) {
    return content.replace(matcher, `$1${normalizedBody}\n`)
  }

  return `${content.trimEnd()}\n\n## ${heading}\n\n${normalizedBody}\n`
}

/**
 * Normalize agent names/ids for comparisons.
 * @param {string | undefined | null} value
 * @returns {string}
 */
function canonicalAgentId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

/**
 * Normalize arbitrary text to a single trimmed line.
 * @param {string | undefined | null} value
 * @returns {string}
 */
function toSingleLine(value) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
}

/**
 * Truncate text while preserving a one-line shape.
 * @param {string} value
 * @param {number} maxLength
 * @returns {string}
 */
function truncateSingleLine(value, maxLength) {
  const line = toSingleLine(value)
  if (maxLength && line.length > maxLength) {
    return line.slice(0, maxLength - 3) + '...'
  }
  return line
}

/**
 * Format a duration in milliseconds as a human-readable elapsed string.
 * @param {number} ms
 * @returns {string}
 */
function formatElapsed(ms) {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function getInProgressLines(trackerContent) {
  if (!trackerContent) return []
  const body = getSectionBody(trackerContent, 'In Progress')
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== '*Nothing active*' && !line.startsWith('<!--'))
}

module.exports = {
  isEmptyValue,
  escapeRegExp,
  parseTracker,
  getSectionBody,
  setSectionBody,
  getInProgressLines,
  canonicalAgentId,
  toSingleLine,
  truncateSingleLine,
  formatElapsed
}
