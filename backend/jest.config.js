/* Pruebas con Jest + SWC (TypeScript como módulos ES). Usan una base de datos dedicada: TEST_DATABASE_URL. */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', { jsc: { parser: { syntax: 'typescript' }, target: 'es2022' }, module: { type: 'es6' } }],
  },
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['<rootDir>/src/__tests__/setup-env.ts'],
  testTimeout: 30000,
};
