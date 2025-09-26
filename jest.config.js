module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true
    }],
  },
  // Handle ES modules properly
  extensionsToTreatAsEsm: ['.ts'],
  // Transform ES modules from node_modules - include all @octokit packages
  transformIgnorePatterns: [
    'node_modules/(?!(@octokit|simple-git)/)'
  ],
  // Module name mapping for ES modules
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/index.ts' // Main entry point, typically just exports
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'clover'
  ],
  // No global coverage threshold - coverage is tracked but not enforced
  // Fail tests if coverage is below threshold
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/lib/',
    '/coverage/',
    '/scripts/'
  ]
};
