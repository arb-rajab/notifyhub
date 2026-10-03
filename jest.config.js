/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  transform: {
    // The Prisma 7 generated client (src/generated/prisma) loads its query
    // compiler with a dynamic `import()`. Under tsconfig's `module: Node16`,
    // tsc keeps that as a native import() in CommonJS output, which Jest's VM
    // can't run without --experimental-vm-modules. Emitting plain CommonJS
    // turns it into require(). ts-jest is already transpile-only here
    // (`isolatedModules` in tsconfig), so this changes emit only; type
    // checking of src/ and tests/ still happens in `npm run typecheck`.
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', moduleResolution: 'Node10' } }],
  },
  setupFiles: ['<rootDir>/tests/setup/env.ts'],
  clearMocks: true,
  testTimeout: 20000,
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**'],
};
