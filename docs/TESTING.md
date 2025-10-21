# Testing Guide for node-red-contrib-goodwe

This document provides comprehensive guidance for test-driven development (TDD) in the node-red-contrib-goodwe project.

## Table of Contents

1. [Overview](#overview)
2. [Test Framework](#test-framework)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Mocking Inverter Responses](#mocking-inverter-responses)
6. [TDD Workflow](#tdd-workflow)
7. [Best Practices](#best-practices)
8. [CI Integration](#ci-integration)

## Overview

This project follows Test-Driven Development (TDD) principles:

- **All features must have tests before implementation**
- **Minimum 70% code coverage required**
- **All tests must pass before merging**
- **CI validates tests on every commit**

## Test Framework

### Technology Stack

- **Test Runner**: [Jest](https://jestjs.io/) - JavaScript testing framework
- **Node-RED Testing**: [node-red-node-test-helper](https://github.com/node-red/node-red-node-test-helper) - Official Node-RED testing utility
- **Code Coverage**: Jest built-in coverage with Istanbul
- **Linting**: ESLint with Node-RED best practices

### Configuration Files

- `jest.config.js` - Jest configuration
- `.eslintrc.json` - ESLint configuration
- `.github/workflows/ci.yml` - CI pipeline

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage

# Run specific test file
npm test -- test/goodwe.test.js

# Run tests matching a pattern
npm test -- --testNamePattern="configuration"

# Run tests with verbose output
npm test -- --verbose
```

### Coverage Reports

Coverage reports are generated in the `coverage/` directory:

- `coverage/lcov-report/index.html` - HTML coverage report (open in browser)
- `coverage/lcov.info` - LCOV format for CI tools
- `coverage/coverage-final.json` - JSON format

```bash
# View coverage report in browser
npm test -- --coverage
open coverage/lcov-report/index.html  # macOS
xdg-open coverage/lcov-report/index.html  # Linux
start coverage/lcov-report/index.html  # Windows
```

### Linting

```bash
# Check code style
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

## Writing Tests

### Test File Structure

Test files are located in the `test/` directory and follow this naming convention:
- `*.test.js` - All test files must end with `.test.js`

```javascript
/**
 * Tests for Feature Name
 * 
 * Brief description of what this test suite covers
 */

const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe.js");

helper.init(require.resolve("node-red"));

describe("feature name", () => {
    
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it("should do something specific", (done) => {
        const flow = [
            { 
                id: "n1", 
                type: "goodwe",
                host: "192.168.1.100",
                wires: [["n2"]]
            },
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

### Node-RED Test Helper API

#### Loading Nodes

```javascript
// Load a single node
helper.load(goodweNode, flow, callback);

// Load multiple nodes
helper.load([goodweNode, otherNode], flow, callback);
```

#### Creating Test Flows

```javascript
const flow = [
    {
        id: "n1",
        type: "goodwe",
        name: "test node",
        host: "192.168.1.100",
        port: 8899,
        protocol: "udp",
        family: "ET",
        wires: [["n2"]]
    },
    { id: "n2", type: "helper" }
];
```

#### Getting Node References

```javascript
const node = helper.getNode("n1");
const helperNode = helper.getNode("n2");
```

#### Sending Messages to Nodes

```javascript
// Simple message
node.receive({ payload: "test" });

// Complex message
node.receive({
    payload: { command: "read", params: {} },
    topic: "custom/topic",
    correlationId: "123"
});
```

#### Listening for Output

```javascript
helperNode.on("input", (msg) => {
    // Assertions here
    expect(msg.payload).toBeDefined();
    done();
});
```

#### Cleanup

```javascript
afterEach(function (done) {
    helper.unload();      // Unload all nodes
    helper.stopServer(done);
});
```

## Mocking Inverter Responses

Since we can't connect to real inverters during testing, we mock responses for offline development.

### Mock Data Structure

Create mock data files in `test/fixtures/`:

```javascript
// test/fixtures/mock-inverter-data.js
module.exports = {
    runtimeData: {
        success: true,
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            vpv1: 245.5,  // PV1 voltage
            vpv2: 242.3,  // PV2 voltage
            ipv1: 8.2,    // PV1 current
            ipv2: 7.9,    // PV2 current
            vac1: 230.1,  // AC voltage phase 1
            iac1: 12.5,   // AC current phase 1
            pac: 2875,    // Active power
            temperature: 42.5,
            e_day: 12.5,  // Daily energy
            e_total: 1234.5  // Total energy
        }
    },
    
    deviceInfo: {
        success: true,
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            modelName: "GW5000-ET",
            serialNumber: "12345678",
            firmwareVersion: "V1.2.3",
            moduleSoftwareVersion: "V2.0.1",
            rated_power: 5000,
            ac_output_type: 1
        }
    },
    
    errorResponse: {
        success: false,
        timestamp: "2025-10-21T12:00:00.000Z",
        error: {
            code: "CONNECTION_TIMEOUT",
            message: "Failed to connect to inverter",
            details: "Timeout after 5000ms"
        }
    }
};
```

### Using Mocks in Tests

```javascript
const mockData = require("./fixtures/mock-inverter-data");

describe("runtime data reading", () => {
    it("should parse runtime data correctly", (done) => {
        const flow = [
            { 
                id: "n1", 
                type: "goodwe",
                host: "192.168.1.100",
                wires: [["n2"]]
            },
            { id: "n2", type: "helper" }
        ];
        
        helper.load(goodweNode, flow, () => {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");
            
            // Mock the internal communication method
            n1._readInverter = jest.fn().mockResolvedValue(
                mockData.runtimeData.data
            );
            
            n2.on("input", (msg) => {
                try {
                    expect(msg.payload.success).toBe(true);
                    expect(msg.payload.data.vpv1).toBe(245.5);
                    expect(msg.payload.data.pac).toBe(2875);
                    done();
                } catch(err) {
                    done(err);
                }
            });
            
            n1.receive({ payload: "read" });
        });
    });
});
```

### Mocking Network Requests

For UDP/Modbus communication mocking:

```javascript
// Mock UDP communication
jest.mock("dgram", () => ({
    createSocket: jest.fn(() => ({
        send: jest.fn((msg, offset, length, port, host, callback) => {
            // Simulate successful send
            callback(null);
        }),
        on: jest.fn(),
        close: jest.fn()
    }))
}));

// Mock Modbus TCP
jest.mock("modbus-serial", () => ({
    default: jest.fn(() => ({
        connectTCP: jest.fn().mockResolvedValue(true),
        readHoldingRegisters: jest.fn().mockResolvedValue({
            data: [0x1234, 0x5678]
        }),
        close: jest.fn()
    }))
}));
```

## TDD Workflow

### Red-Green-Refactor Cycle

1. **RED**: Write a failing test
   ```javascript
   it("should connect to inverter via UDP", (done) => {
       // This test will fail because feature doesn't exist yet
       expect(node.connected).toBe(true);
       done();
   });
   ```

2. **GREEN**: Write minimum code to make test pass
   ```javascript
   // In goodwe.js
   this.connected = false;
   
   this.connect = function() {
       this.connected = true;
   };
   ```

3. **REFACTOR**: Improve code while keeping tests green
   ```javascript
   this.connect = async function() {
       try {
           await this.establishConnection();
           this.connected = true;
           this.status({ fill: "green", shape: "dot", text: "connected" });
       } catch(err) {
           this.connected = false;
           this.status({ fill: "red", shape: "ring", text: "error" });
       }
   };
   ```

### Example TDD Session

**Feature**: Add support for reading specific sensor

**Step 1: Write Test First**
```javascript
describe("sensor reading", () => {
    it("should read specific sensor by ID", (done) => {
        const flow = [
            { id: "n1", type: "goodwe", host: "192.168.1.100", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];
        
        helper.load(goodweNode, flow, () => {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");
            
            n2.on("input", (msg) => {
                try {
                    expect(msg.payload.success).toBe(true);
                    expect(msg.payload.sensorId).toBe("vpv1");
                    expect(msg.payload.value).toBeDefined();
                    done();
                } catch(err) {
                    done(err);
                }
            });
            
            n1.receive({ 
                payload: { 
                    command: "read_sensor",
                    sensor_id: "vpv1"
                }
            });
        });
    });
});
```

**Step 2: Run Test (it fails)**
```bash
npm test
# Expected: Test fails because feature not implemented
```

**Step 3: Implement Feature**
```javascript
// In goodwe.js
if (command === "read_sensor" && msg.payload.sensor_id) {
    const sensorId = msg.payload.sensor_id;
    const value = await this.readSensorValue(sensorId);
    
    outputMsg.payload = {
        success: true,
        sensorId: sensorId,
        value: value,
        timestamp: new Date().toISOString()
    };
}
```

**Step 4: Run Test (it passes)**
```bash
npm test
# Expected: All tests pass
```

**Step 5: Refactor**
- Extract sensor reading logic
- Add error handling
- Improve code structure
- Run tests after each change

## Best Practices

### Test Organization

1. **Group related tests**: Use `describe` blocks
   ```javascript
   describe("configuration", () => {
       describe("host validation", () => {
           it("should accept valid IP address", ...);
           it("should accept hostname", ...);
       });
   });
   ```

2. **Use descriptive test names**: Test names should read like documentation
   ```javascript
   // Good
   it("should retry connection 3 times before failing", ...);
   
   // Bad
   it("test retry", ...);
   ```

3. **One assertion per test**: Keep tests focused
   ```javascript
   // Good
   it("should return success flag", (done) => {
       expect(msg.payload.success).toBe(true);
       done();
   });
   
   it("should return timestamp", (done) => {
       expect(msg.payload.timestamp).toBeDefined();
       done();
   });
   
   // Acceptable for related assertions
   it("should include all required response fields", (done) => {
       expect(msg.payload).toHaveProperty("success");
       expect(msg.payload).toHaveProperty("command");
       expect(msg.payload).toHaveProperty("timestamp");
       done();
   });
   ```

### Mock Best Practices

1. **Keep mocks simple**: Mock only what's necessary
2. **Use realistic data**: Mock data should match actual inverter responses
3. **Test error paths**: Mock failures and edge cases
4. **Clean up mocks**: Reset mocks between tests

### Common Patterns

#### Testing Asynchronous Operations

```javascript
it("should handle async operations", (done) => {
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
```

#### Testing Error Handling

```javascript
it("should handle connection errors gracefully", (done) => {
    const flow = [
        { id: "n1", type: "goodwe", host: "invalid.host", wires: [["n2"]] },
        { id: "n2", type: "helper" }
    ];
    
    helper.load(goodweNode, flow, () => {
        const n1 = helper.getNode("n1");
        const n2 = helper.getNode("n2");
        
        n2.on("input", (msg) => {
            try {
                expect(msg.payload.success).toBe(false);
                expect(msg.payload.error).toBeDefined();
                done();
            } catch(err) {
                done(err);
            }
        });
        
        n1.receive({ payload: "read" });
    });
});
```

#### Testing Status Updates

```javascript
it("should update status during operation", (done) => {
    // Status updates are internal to the node
    // We verify behavior indirectly through node state
    helper.load(goodweNode, flow, () => {
        const n1 = helper.getNode("n1");
        
        // Capture status calls if needed
        const statusCalls = [];
        const originalStatus = n1.status;
        n1.status = function(status) {
            statusCalls.push(status);
            originalStatus.call(n1, status);
        };
        
        n1.receive({ payload: "read" });
        
        setTimeout(() => {
            expect(statusCalls.length).toBeGreaterThan(0);
            done();
        }, 100);
    });
});
```

## CI Integration

### GitHub Actions Workflow

Our CI pipeline runs on every push and pull request:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x, 22.x]
    
    steps:
    - uses: actions/checkout@v3
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
    - name: Install dependencies
      run: npm ci
    - name: Run linter
      run: npm run lint
    - name: Run tests
      run: npm test
    - name: Upload coverage
      uses: codecov/codecov-action@v3
```

### Coverage Requirements

Minimum coverage thresholds (enforced by CI):

- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Pre-commit Checks

Before committing:

```bash
# Run all checks
npm run lint && npm test

# Or use npm scripts
npm run lint:fix  # Fix auto-fixable issues
npm test          # Verify tests pass
```

## Troubleshooting

### Common Issues

#### "Worker process has failed to exit gracefully"

This warning appears when tests don't clean up properly. Usually harmless but can be fixed:

```javascript
afterEach(function (done) {
    helper.unload();
    helper.stopServer(() => {
        // Give timers time to clear
        setTimeout(done, 10);
    });
});
```

#### "Coverage threshold not met"

Add more tests to cover untested code paths:

```bash
# Generate coverage report to see what's missing
npm test -- --coverage
open coverage/lcov-report/index.html
```

#### Tests timing out

Increase Jest timeout or check for missing `done()` calls:

```javascript
// Increase timeout for specific test
it("slow test", (done) => {
    // Test code
}, 10000); // 10 second timeout
```

### Debugging Tests

```bash
# Run with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Run single test file
npm test -- test/goodwe.test.js

# Run with verbose output
npm test -- --verbose

# Detect open handles
npm test -- --detectOpenHandles
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Node-RED Test Helper](https://github.com/node-red/node-red-node-test-helper)
- [Node-RED Creating Nodes](https://nodered.org/docs/creating-nodes/)
- [Testing Best Practices](https://testingjavascript.com/)

## Contributing

When contributing tests:

1. Follow the TDD workflow (Red-Green-Refactor)
2. Write descriptive test names
3. Keep tests independent and isolated
4. Mock external dependencies
5. Maintain or improve coverage
6. Ensure all tests pass before submitting PR

---

**Remember**: Tests are documentation. Write them clearly so future developers can understand your intent!
