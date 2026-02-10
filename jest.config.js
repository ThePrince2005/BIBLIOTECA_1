module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    testMatch: ['**/__tests__/**/*.test.js'],
    coveragePathIgnorePatterns: [
        '/node_modules/'
    ]
};
