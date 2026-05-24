# Quick Start: Testing with node-red-contrib-goodwe

This is a quick reference guide for developers. For comprehensive documentation, see [../docs/TESTING.md](../docs/TESTING.md).

## Prerequisites

```bash
# Ensure you have Node.js 20+ installed
node --version  # Should be >= 20.0.0

# Install dependencies
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on changes)
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- test/read-node.test.js

# Run tests matching pattern
npm test -- --testNamePattern="configuration"
```

## Common Testing Patterns

### Basic Test Structure (Read Node)

```javascript
const helper = require("node-red-node-test-helper");
const configNode = require("../nodes/config.js");
const readNode = require("../nodes/read.js");

helper.init(require.resolve("node-red"));

describe("my feature", () => {
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it("should do something", (done) => {
        const flow = [
            {
                id: "c1",
                type: "goodwe-config",
                host: "192.168.1.100",
                port: "8899",
                protocol: "udp",
                family: "ET"
            },
            {
                id: "n1",
                type: "goodwe-read",
                config: "c1",
                wires: [["n2"]]
            },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, readNode], flow, () => {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", (msg) => {
                try {
                    expect(msg.payload).toBeDefined();
                    done();
                } catch(err) {
                    done(err);
                }
            });

            n1.receive({ payload: "test" });
        });
    });
});
```

See `test/read-node.test.js`, `test/info-node.test.js`, `test/discover-node.test.js`, and `test/config-node.test.js` for canonical examples of each node type.

## TDD Workflow

1. **RED**: Write a failing test
   ```bash
   npm test  # Test should fail
   ```

2. **GREEN**: Write minimal code to pass
   ```bash
   npm test  # Test should pass
   ```

3. **REFACTOR**: Improve code
   ```bash
   npm test  # Tests should still pass
   ```

## Code Quality

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Check coverage
npm test -- --coverage
open coverage/lcov-report/index.html
```

## Debugging Tests

```bash
# Run with verbose output
npm test -- --verbose

# Run single test file
npm test -- test/read-node.test.js

# Detect open handles (for cleanup issues)
npm test -- --detectOpenHandles

# Use Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Pre-commit Checklist

Before committing:

1. Tests pass: `npm test`
2. Linting passes: `npm run lint`
3. Coverage maintained: `npm test -- --coverage`
4. No console errors in tests

## CI Information

- Tests run automatically on every push and PR
- Multiple Node.js versions tested (20.x, 22.x)
- Coverage reports uploaded to Codecov
- Must pass before merging

## Getting Help

- **Full Testing Guide**: [../docs/TESTING.md](../docs/TESTING.md)
- **Contributing Guide**: [../CONTRIBUTING.md](../CONTRIBUTING.md)
- **Issues**: [GitHub Issues](https://github.com/pkot/node-red-contrib-goodwe/issues)
