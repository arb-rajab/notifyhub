/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  clearMocks: true,
  testTimeout: 20000,
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**'],
};
