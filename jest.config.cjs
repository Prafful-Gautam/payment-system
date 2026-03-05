/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  roots: ['<rootDir>/src'],
  moduleNameMapper: {
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@repositories/(.*)$': '<rootDir>/src/repositories/$1',
    '^@entities/(.*)$': '<rootDir>/src/entities/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@type/(.*)$': '<rootDir>/src/types/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@error/(.*)$': '<rootDir>/src/error/$1',
  },
  setupFiles: ['<rootDir>/src/tests/jest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
};

