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
    '^.+\\.js$': ['ts-jest', {
      useESM: true
    }]
  },
  // Handle ES modules properly
  extensionsToTreatAsEsm: ['.ts'],
  // Transform ES modules from node_modules - be more permissive
  transformIgnorePatterns: [
    'node_modules/(?!(chalk|inquirer|ora|ansi-styles|strip-ansi|wrap-ansi|string-width|emoji-regex|is-fullwidth-code-point|ansi-regex|supports-color|has-flag|cli-cursor|restore-cursor|cli-spinners|is-interactive|figures|wcwidth|mute-stream|run-async|rxjs|through|base64-js|chardet|tmp|iconv-lite|safer-buffer|external-editor|@octokit|simple-git)/)'
  ],
  // Module name mapping for ES modules
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^#ansi-styles$': 'ansi-styles',
    '^#supports-color$': 'supports-color'
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
