module.exports = {
    testEnvironment: "node",
    coverageDirectory: "coverage",
    collectCoverageFrom: [
        "nodes/**/*.js",
        "!nodes/**/*.spec.js"
    ],
    testMatch: [
        "**/test/**/*.test.js"
    ]
};
