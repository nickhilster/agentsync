'use strict'

// Barrel re-export for all utils modules.
// This allows both `require('./utils')` and `require('./utils/text')` etc.

module.exports = {
  ...require('./constants'),
  ...require('./paths'),
  ...require('./text'),
  ...require('./io'),
  ...require('./git'),
  ...require('./workspace')
}
