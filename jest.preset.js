/**
 * Shared Jest preset for all workspaces (D8): transpile-only TypeScript via @swc/jest.
 * tsc owns types; swc owns transpilation.
 */
module.exports = {
  transform: {
    '^.+\\.tsx?$': ['@swc/jest'],
  },
  // Workspace links resolve under node_modules/@agent-analytics — those sources are
  // TypeScript and must go through the transform like first-party code.
  transformIgnorePatterns: ['node_modules/(?!@agent-analytics)'],
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'mjs', 'cjs', 'json', 'node'],
};
