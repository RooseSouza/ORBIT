/**
 * Jest configuration for frontend tests.
 * To run frontend tests:
 * 1. npm install --save-dev jest
 * 2. npm test
 */

module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/frontend/setupTests.js'],
  testMatch: ['**/tests/frontend/**/*.test.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/static/js/$1',
  },
  collectCoverageFrom: [
    'static/js/**/*.js',
    '!static/js/firebase-config.js', // Skip Firebase config
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
