# Quick Start: Testing with node-red-contrib-goodwe

This is a quick reference guide for developers. For comprehensive documentation, see [TESTING.md](./TESTING.md).

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
npm test -- test/goodwe.test.js

# Run tests matching pattern
npm test -- --testNamePattern="configuration"
```

## Common Testing Patterns

### 1. Basic Test Structure

```javascript
const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe.js");

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
            { id: "n1", type: "goodwe", host: "192.168.1.100", wires:[["n2"]] },
            { id: "n2", type: "helper" }
        ];
        
        helper.load(goodweNode, flow, () => {
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

### 2. Using Test Utilities (Recommended)

```javascript
const testUtils = require("./test-utils");
const goodweNode = require("../nodes/goodwe.js");

describe("my feature", () => {
    beforeEach(testUtils.testLifecycle.beforeEach);
    afterEach(testUtils.testLifecycle.afterEach);

    it("should do something", async () => {
        const flow = testUtils.createBasicFlow();
        const nodes = await testUtils.loadFlowWithNodes(goodweNode, flow);
        
        const response = await testUtils.sendAndWait(
            nodes.n1,
            nodes.n2,
            testUtils.sampleMessages.read
        );
        
        testUtils.assertions.isSuccess(response);
    });
});
```

### 3. Using Mock Data

```javascript
const mockData = require("./fixtures/mock-inverter-data");

// In your test
const expectedData = mockData.runtimeData;
expect(response.payload.data.vpv1).toBe(expectedData.data.vpv1);
```

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
npm test -- test/goodwe.test.js

# Detect open handles (for cleanup issues)
npm test -- --detectOpenHandles

# Use Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Useful Test Utilities

```javascript
const testUtils = require("./test-utils");

// Create flows
testUtils.createBasicFlow({ host: "192.168.1.100" });

// Wait for messages
await testUtils.waitForMessage(helperNode);
await testUtils.waitForMessages(helperNode, 3);

// Send and wait pattern
await testUtils.sendAndWait(sourceNode, helperNode, message);

// Create mocks
testUtils.createMockResponse(mockData);
testUtils.createMockError("Connection failed");

// Monitor status
const statusCalls = testUtils.captureStatusCalls(node);
await testUtils.waitForStatus(node, { fill: "green" });

// Assertions
testUtils.assertions.isSuccess(msg);
testUtils.assertions.isError(msg, "ERROR_CODE");
testUtils.assertions.hasFields(msg, ["success", "data"]);
```

## Mock Data Available

```javascript
const mockData = require("./fixtures/mock-inverter-data");

// Available mocks:
mockData.runtimeData              // Runtime sensor data
mockData.runtimeDataET            // ET series specific
mockData.deviceInfo               // Device information
mockData.discoveryResponse        // Multiple inverters
mockData.discoverySingleInverter  // Single inverter
mockData.discoveryNoInverters     // No inverters found
mockData.sensorsListResponse      // Sensor list
mockData.singleSensorResponse     // Single sensor read
mockData.settingsDataResponse     // Settings/config
mockData.writeSettingSuccess      // Write success
mockData.errors.*                 // Various error scenarios
```

## Pre-commit Checklist

Before committing:

1. ✅ Tests pass: `npm test`
2. ✅ Linting passes: `npm run lint`
3. ✅ Coverage maintained: `npm test -- --coverage`
4. ✅ No console errors in tests

## CI Information

- Tests run automatically on every push and PR
- Multiple Node.js versions tested (20.x, 22.x)
- Coverage reports uploaded to Codecov
- Must pass before merging

## Getting Help

- 📖 **Full Testing Guide**: [docs/TESTING.md](./TESTING.md)
- 📖 **Contributing Guide**: [CONTRIBUTING.md](../CONTRIBUTING.md)
- 📖 **Node Design**: [docs/NODE_DESIGN.md](./NODE_DESIGN.md)
- 💬 **Issues**: [GitHub Issues](https://github.com/pkot/node-red-contrib-goodwe/issues)

---

**Remember**: Write tests first, then implement features! 🧪✨
