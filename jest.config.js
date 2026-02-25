'use strict'

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.js'],
  moduleNameMapper: {
    vscode: '<rootDir>/__mocks__/vscode.js'
  },
  collectCoverageFrom: ['extension.js', 'scripts/**/*.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov']
}
