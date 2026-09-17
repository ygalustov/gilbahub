module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // GH-457: every test asserts something, or it fails. See the setup file for
  // why this is a setting and not a review habit.
  setupFilesAfterEnv: ['<rootDir>/jest.setup.assertions.js']
};
