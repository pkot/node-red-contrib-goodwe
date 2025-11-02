module.exports = {
    testEnvironment: "node",
    coverageDirectory: "coverage",
    collectCoverageFrom: [
        "nodes/**/*.js",
        "lib/**/*.js",
        "!nodes/**/*.spec.js",
        "!lib/protocol.js"  // Exclude pre-existing protocol.js from coverage requirements
    ],
    testMatch: [
        "**/test/**/*.test.js"
    ],
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    }
};
