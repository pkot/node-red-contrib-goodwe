# Node-RED GoodWe Node Design Specification

**Version**: 1.0  
**Date**: 2025-10-20  
**Status**: Design Specification  
**Related**: [FEATURE_ANALYSIS.md](./FEATURE_ANALYSIS.md)

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Node Structure](#node-structure)
3. [Configuration UI Design](#configuration-ui-design)
4. [Message Structure](#message-structure)
5. [Error and Status Reporting](#error-and-status-reporting)
6. [Design Decisions and Tradeoffs](#design-decisions-and-tradeoffs)
7. [Test-Driven Development Plan](#test-driven-development-plan)
8. [Open Questions](#open-questions)

---

## Executive Summary

This document specifies the design for the Node-RED node(s) that provide integration with GoodWe inverters. The design follows Node-RED best practices and TDD principles.

### Key Decisions

- **Node Structure**: Single unified node (`goodwe`) with command-based operation
- **Configuration**: Connection-level settings in node properties
- **Operation**: Message-driven commands for different operations (read, write, discover)
- **Status**: Visual feedback using Node-RED status API
- **Error Handling**: Comprehensive error messages with retry tracking

---

## 1. Node Structure

### 1.1 Node Types

After analyzing the requirements and Node-RED best practices, we will implement a **single unified node** approach:

#### Primary Node: `goodwe`

**Rationale**: 
- Simplifies user experience - one node to learn
- Reduces maintenance complexity
- Command-based operation provides flexibility
- Follows Node-RED patterns (similar to MQTT, HTTP Request nodes)

**Alternative Considered**: Multiple specialized nodes (`goodwe-read`, `goodwe-write`, `goodwe-discover`)
- **Rejected because**: Would require 3+ nodes, increasing complexity and duplication
- **May reconsider for**: Future v2.0 if demand for specialized workflows emerges

### 1.2 Node Architecture

```
┌─────────────────────────────────────────┐
│         GoodWe Node (goodwe)            │
├─────────────────────────────────────────┤
│  Configuration (Node Properties)        │
│  - Host, Port, Protocol, Family         │
│  - Timeout, Retries                     │
│  - Output Format                        │
├─────────────────────────────────────────┤
│  Input Processing                       │
│  - Command router (read/write/discover) │
│  - Parameter validation                 │
├─────────────────────────────────────────┤
│  Protocol Layer                         │
│  - UDP Client (AA55, ModbusRTU)        │
│  - Modbus TCP Client                    │
│  - Connection pooling                   │
├─────────────────────────────────────────┤
│  Data Processing                        │
│  - Sensor data parsing                  │
│  - Configuration read/write             │
│  - Device info retrieval                │
├─────────────────────────────────────────┤
│  Output Formatting                      │
│  - JSON structure builder               │
│  - Error message formatter              │
│  - Status updater                       │
└─────────────────────────────────────────┘
```

### 1.3 Node Category and Appearance

- **Category**: `function` (since it processes/transforms data from inverter)
- **Color**: `#3FADB5` (teal/cyan - represents solar/energy theme)
- **Icon**: `bridge.png` (represents connection/gateway to hardware)
- **Inputs**: 1 (command input)
- **Outputs**: 1 (data/result output)

---

## 2. Configuration UI Design

### 2.1 Node Properties

The configuration dialog will have the following fields:

#### 2.1.1 Basic Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Name** | text | No | `""` | Human-readable node name |
| **Host** | text | Yes | `""` | IP address or hostname (e.g., `192.168.1.100`) |
| **Port** | number | Yes | `8899` | Communication port (8899 for UDP, 502 for Modbus TCP) |
| **Protocol** | select | Yes | `udp` | Communication protocol: `udp` or `modbus` |
| **Family** | select | Yes | `ET` | Inverter family (ET, ES, DT, etc.) |

#### 2.1.2 Advanced Configuration (Expandable Section)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Timeout** | number | No | `1000` | Response timeout in milliseconds |
| **Retries** | number | No | `3` | Number of retry attempts for failed requests |
| **Comm Address** | number | No | `auto` | Communication address (0xF7 or 0x7F, auto-detected) |
| **Output Format** | select | No | `flat` | Output data format: `flat`, `categorized`, `array` |
| **Polling Interval** | number | No | `0` | Auto-polling interval in seconds (0 = disabled) |

### 2.2 UI Field Specifications

#### Host Field
```javascript
{
    id: "node-input-host",
    type: "text",
    required: true,
    validate: RED.validators.regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^[a-zA-Z0-9.-]+$/),
    placeholder: "192.168.1.100 or inverter.local"
}
```

#### Port Field
```javascript
{
    id: "node-input-port",
    type: "number",
    required: true,
    validate: RED.validators.number(),
    placeholder: "8899"
}
```

#### Protocol Field
```javascript
{
    id: "node-input-protocol",
    type: "select",
    options: [
        { value: "udp", label: "UDP (port 8899)" },
        { value: "modbus", label: "Modbus TCP (port 502)" }
    ],
    onChange: function(value) {
        // Auto-update port based on protocol
        if (value === "udp") $("#node-input-port").val(8899);
        if (value === "modbus") $("#node-input-port").val(502);
    }
}
```

#### Family Field
```javascript
{
    id: "node-input-family",
    type: "select",
    options: [
        { value: "ET", label: "ET Series (ET, EH, BT, BH)" },
        { value: "ES", label: "ES Series (ES, EM, BP)" },
        { value: "DT", label: "DT Series (DT, MS, D-NS, XS)" }
    ]
}
```

### 2.3 UI Mockup

```
┌─────────────────────────────────────────────┐
│ Edit goodwe node                        [X] │
├─────────────────────────────────────────────┤
│                                             │
│  Name:        [My GoodWe Inverter____]     │
│                                             │
│  ━━━━━━━━ Connection Settings ━━━━━━━      │
│                                             │
│  Host:        [192.168.1.100_________] *   │
│               (IP address or hostname)      │
│                                             │
│  Protocol:    [UDP (port 8899)    ▼] *     │
│                                             │
│  Port:        [8899_______________] *       │
│                                             │
│  Family:      [ET Series (ET, EH) ▼] *     │
│                                             │
│  ━━━━━━━━ Advanced Settings ━━━━━━━ [+]    │
│                                             │
│  [Cancel]                      [Done]       │
└─────────────────────────────────────────────┘

When expanded:

│  ━━━━━━━━ Advanced Settings ━━━━━━━ [-]    │
│                                             │
│  Timeout:     [1000_______________] ms      │
│  Retries:     [3__________________]         │
│  Output:      [Flat (default)     ▼]       │
│  Polling:     [0__________________] sec     │
│               (0 = manual trigger only)     │
```

### 2.4 Validation Rules

1. **Host**: Must be valid IP address or hostname (regex validated)
2. **Port**: Must be 1-65535 (number validation)
3. **Timeout**: Must be >= 100ms
4. **Retries**: Must be >= 0
5. **Polling Interval**: Must be >= 0 (0 means disabled)

---

## 3. Message Structure

### 3.1 Input Messages

The node accepts input messages with commands specified in `msg.payload`.

#### 3.1.1 Command: Read Runtime Data

**Simplest form** (string):
```javascript
msg.payload = "read"
```

**Object form**:
```javascript
msg.payload = {
    command: "read"
}
```

**Read specific sensor**:
```javascript
msg.payload = {
    command: "read_sensor",
    sensor_id: "vpv1"  // PV1 voltage
}
```

#### 3.1.2 Command: Discovery

**Network broadcast discovery**:
```javascript
msg.payload = "discover"
// or
msg.payload = {
    command: "discover",
    type: "broadcast"  // optional, default
}
```

**Direct device discovery**:
```javascript
msg.payload = {
    command: "discover",
    type: "direct"
}
```

#### 3.1.3 Command: Device Info

```javascript
msg.payload = "info"
// or
msg.payload = {
    command: "device_info"
}
```

#### 3.1.4 Command: Read Settings

**All settings**:
```javascript
msg.payload = {
    command: "read_settings"
}
```

**Specific setting**:
```javascript
msg.payload = {
    command: "read_setting",
    setting_id: "grid_export_limit"
}
```

#### 3.1.5 Command: Write Setting (DANGEROUS)

```javascript
msg.payload = {
    command: "write_setting",
    setting_id: "grid_export_limit",
    value: 5000  // Watts
}
```

**Safety requirement**: Write operations require confirmation in UI (checkbox or warning)

#### 3.1.6 Command: Get Sensor List

```javascript
msg.payload = {
    command: "list_sensors"
}
```

### 3.2 Output Messages

#### 3.2.1 Success Response - Runtime Data

**Flat format** (default):
```javascript
{
    payload: {
        success: true,
        command: "read",
        timestamp: "2025-10-20T21:37:42.452Z",
        data: {
            // PV Strings
            vpv1: 245.5,      // V
            ipv1: 6.2,        // A
            ppv1: 1522,       // W
            vpv2: 240.2,
            ipv2: 5.8,
            ppv2: 1393,
            
            // Battery
            battery_voltage: 51.2,    // V
            battery_current: -5.5,    // A (negative = charging)
            battery_soc: 87,          // %
            battery_temperature: 23.5, // °C
            
            // Grid
            vgrid: 230.5,     // V
            igrid: 12.4,      // A
            fgrid: 50.02,     // Hz
            pgrid: -2856,     // W (negative = export)
            
            // Energy
            e_day: 15.2,      // kWh
            e_total: 4523.8,  // kWh
            
            // Status
            status: "normal",
            temperature: 42.5  // °C
        }
    },
    topic: "goodwe/runtime_data",
    _inverter: {
        model: "GW5000-EH",
        serial: "ETxxxxxxxx",
        family: "ET"
    }
}
```

**Categorized format**:
```javascript
{
    payload: {
        success: true,
        command: "read",
        timestamp: "2025-10-20T21:37:42.452Z",
        data: {
            pv: {
                vpv1: 245.5, ipv1: 6.2, ppv1: 1522,
                vpv2: 240.2, ipv2: 5.8, ppv2: 1393
            },
            battery: {
                voltage: 51.2, current: -5.5,
                soc: 87, temperature: 23.5
            },
            grid: {
                voltage: 230.5, current: 12.4,
                frequency: 50.02, power: -2856
            },
            energy: {
                daily: 15.2, total: 4523.8
            },
            status: {
                status: "normal",
                temperature: 42.5
            }
        }
    },
    topic: "goodwe/runtime_data",
    _inverter: { /* ... */ }
}
```

**Array format** (with metadata):
```javascript
{
    payload: {
        success: true,
        command: "read",
        timestamp: "2025-10-20T21:37:42.452Z",
        data: [
            {
                id: "vpv1",
                name: "PV1 Voltage",
                value: 245.5,
                unit: "V",
                kind: "PV"
            },
            {
                id: "battery_soc",
                name: "Battery State of Charge",
                value: 87,
                unit: "%",
                kind: "BAT"
            }
            // ... all sensors
        ]
    },
    topic: "goodwe/runtime_data",
    _inverter: { /* ... */ }
}
```

#### 3.2.2 Success Response - Device Info

```javascript
{
    payload: {
        success: true,
        command: "device_info",
        timestamp: "2025-10-20T21:37:42.452Z",
        data: {
            model_name: "GW5000-EH",
            serial_number: "ETxxxxxxxx",
            rated_power: 5000,        // W
            firmware: "V1.2.3",
            arm_firmware: "V2.0.1",
            modbus_version: 2,
            family: "ET"
        }
    },
    topic: "goodwe/device_info"
}
```

#### 3.2.3 Success Response - Discovery

```javascript
{
    payload: {
        success: true,
        command: "discover",
        timestamp: "2025-10-20T21:37:42.452Z",
        data: {
            found: true,
            host: "192.168.1.100",
            model: "GW5000-EH",
            serial: "ETxxxxxxxx",
            family: "ET",
            protocol: "udp",
            port: 8899
        }
    },
    topic: "goodwe/discover"
}
```

#### 3.2.4 Success Response - Sensor List

```javascript
{
    payload: {
        success: true,
        command: "list_sensors",
        timestamp: "2025-10-20T21:37:42.452Z",
        data: {
            count: 127,
            sensors: [
                {
                    id: "vpv1",
                    name: "PV1 Voltage",
                    unit: "V",
                    kind: "PV"
                }
                // ... all sensor definitions
            ]
        }
    },
    topic: "goodwe/sensors"
}
```

#### 3.2.5 Error Response

```javascript
{
    payload: {
        success: false,
        command: "read",
        timestamp: "2025-10-20T21:37:42.452Z",
        error: {
            message: "Connection timeout",
            type: "RequestFailedException",
            code: "TIMEOUT",
            details: {
                host: "192.168.1.100",
                port: 8899,
                consecutiveFailures: 3,
                lastAttempt: "2025-10-20T21:37:39.020Z"
            }
        }
    },
    topic: "goodwe/error"
}
```

### 3.3 Message Topic Convention

All output messages use a consistent topic pattern:
- `goodwe/runtime_data` - Runtime sensor data
- `goodwe/device_info` - Device information
- `goodwe/discover` - Discovery results
- `goodwe/settings` - Configuration data
- `goodwe/sensors` - Sensor list
- `goodwe/error` - Error messages

Topics can be overridden by setting `msg.topic` in input message.

### 3.4 Preserving Input Message Properties

The node preserves all properties from the input message except `payload`. This allows chaining and correlation:

```javascript
// Input
{
    payload: "read",
    _msgid: "abc123",
    correlationId: "user-defined-id",
    customProperty: "preserved"
}

// Output
{
    payload: { /* result data */ },
    _msgid: "abc123",          // preserved
    correlationId: "user-defined-id",  // preserved
    customProperty: "preserved",       // preserved
    topic: "goodwe/runtime_data",      // added
    _inverter: { /* inverter info */ } // added
}
```

---

## 4. Error and Status Reporting

### 4.1 Node Status Indicators

The node uses Node-RED's status API to provide visual feedback:

| State | Fill | Shape | Text | When |
|-------|------|-------|------|------|
| **Disconnected** | `grey` | `ring` | `disconnected` | Initial state, no connection |
| **Connecting** | `yellow` | `ring` | `connecting...` | Attempting to connect |
| **Connected** | `green` | `dot` | `connected` | Successfully connected |
| **Reading** | `blue` | `dot` | `reading...` | Fetching data |
| **Writing** | `blue` | `dot` | `writing...` | Sending configuration |
| **Success** | `green` | `dot` | `ok` | Operation completed (temporary, 2s) |
| **Warning** | `orange` | `dot` | `retry 2/3` | Retrying after failure |
| **Error** | `red` | `ring` | `error: timeout` | Operation failed |
| **Consecutive Failures** | `red` | `dot` | `failures: 5` | Multiple failures tracked |

### 4.2 Status Update Examples

```javascript
// Connecting
node.status({ fill: "yellow", shape: "ring", text: "connecting..." });

// Reading data
node.status({ fill: "blue", shape: "dot", text: "reading..." });

// Success (temporary)
node.status({ fill: "green", shape: "dot", text: "ok" });
setTimeout(() => {
    node.status({ fill: "green", shape: "dot", text: "connected" });
}, 2000);

// Retry warning
node.status({ 
    fill: "orange", 
    shape: "dot", 
    text: `retry ${attempt}/${maxRetries}` 
});

// Error
node.status({ 
    fill: "red", 
    shape: "ring", 
    text: `error: ${errorMessage}` 
});

// Consecutive failures
node.status({ 
    fill: "red", 
    shape: "dot", 
    text: `failures: ${count}` 
});
```

### 4.3 Error Types and Codes

| Error Type | Code | HTTP-like | Description |
|------------|------|-----------|-------------|
| **Connection Error** | `ECONNREFUSED` | 503 | Cannot connect to inverter |
| **Timeout Error** | `TIMEOUT` | 408 | No response within timeout |
| **Protocol Error** | `PROTOCOL_ERROR` | 502 | Invalid protocol response |
| **Validation Error** | `VALIDATION_ERROR` | 400 | Invalid input parameters |
| **Not Found Error** | `NOT_FOUND` | 404 | Sensor/setting not found |
| **Permission Error** | `PERMISSION_DENIED` | 403 | Write operation not allowed |
| **Device Error** | `DEVICE_ERROR` | 500 | Inverter reported error |
| **Max Retries** | `MAX_RETRIES` | 504 | Exceeded retry attempts |

### 4.4 Error Logging

Errors are logged at appropriate levels:

```javascript
// Info level (expected issues)
node.log("Retrying connection after timeout");

// Warning level (recoverable issues)
node.warn("Connection unstable, 3 consecutive failures");

// Error level (operation failures)
node.error("Failed to read runtime data: " + error.message, msg);

// Debug level (detailed info)
node.debug("Received response: " + JSON.stringify(response));
```

### 4.5 Error Message Details

Error messages provide actionable information:

```javascript
{
    success: false,
    error: {
        message: "Connection timeout after 3 retries",
        type: "RequestFailedException",
        code: "TIMEOUT",
        details: {
            host: "192.168.1.100",
            port: 8899,
            protocol: "udp",
            timeout: 1000,
            retries: 3,
            consecutiveFailures: 5,
            lastSuccess: "2025-10-20T20:30:00.000Z",
            suggestions: [
                "Check inverter is powered on",
                "Verify network connection",
                "Confirm IP address is correct",
                "Try increasing timeout value"
            ]
        }
    }
}
```

### 4.6 Debug Output

When Node-RED debug logging is enabled, the node outputs:
- Raw protocol messages (hex dump)
- Timing information (request/response duration)
- State transitions
- Connection lifecycle events

---

## 5. Design Decisions and Tradeoffs

### 5.1 Single Node vs Multiple Nodes

**Decision**: Single unified node

**Rationale**:
- ✅ Simpler user experience
- ✅ Less maintenance overhead
- ✅ Easier to add features
- ✅ Follows Node-RED patterns (MQTT, HTTP)

**Tradeoff**:
- ❌ More complex node implementation
- ❌ Larger node code file
- ✅ Can split later if needed (v2.0)

### 5.2 Configuration vs Config Node

**Decision**: Configuration in node properties (not config node)

**Rationale**:
- ✅ Most users have single inverter
- ✅ Simpler setup for basic use
- ✅ Less abstraction to learn

**Tradeoff**:
- ❌ Multi-inverter setups need duplicate config
- ✅ Can add config node later if demanded

**Future consideration**: Add `goodwe-config` node in v2.0 for advanced users

### 5.3 Command-Based vs Fixed Operation

**Decision**: Command-based operation via `msg.payload`

**Rationale**:
- ✅ Flexible - one node for all operations
- ✅ Easy to extend with new commands
- ✅ Works well with function nodes
- ✅ Familiar pattern (like exec, HTTP request)

**Tradeoff**:
- ❌ Requires understanding command structure
- ✅ Good documentation mitigates this

### 5.4 Output Format Options

**Decision**: Support multiple output formats (flat, categorized, array)

**Rationale**:
- ✅ Different users prefer different formats
- ✅ Flat is simple for beginners
- ✅ Categorized is better for dashboards
- ✅ Array preserves metadata

**Tradeoff**:
- ❌ More code complexity
- ✅ Configuration option makes it user choice

### 5.5 Auto-Polling vs Manual Trigger

**Decision**: Support both modes

**Rationale**:
- ✅ Auto-polling convenient for monitoring
- ✅ Manual trigger better for on-demand reads
- ✅ Polling interval = 0 disables auto-polling

**Tradeoff**:
- ❌ Need to manage polling lifecycle
- ✅ Common requirement, worth the effort

### 5.6 Error Handling Strategy

**Decision**: Comprehensive error messages with retry tracking

**Rationale**:
- ✅ UDP is unreliable, retries essential
- ✅ Users need actionable error info
- ✅ Consecutive failure tracking helps diagnose issues

**Tradeoff**:
- ❌ More state to track
- ✅ Better user experience

### 5.7 Protocol Implementation

**Decision**: Implement protocols from scratch (no external libraries)

**Rationale**:
- ✅ Follows Python library approach
- ✅ Full control over protocol details
- ✅ No dependency on third-party libraries
- ✅ Easier to debug and optimize

**Tradeoff**:
- ❌ More code to write and test
- ✅ Better long-term maintainability

### 5.8 Write Operation Safety

**Decision**: No explicit confirmation required (rely on user awareness)

**Rationale**:
- ✅ Node-RED users are technical
- ✅ Warnings in documentation sufficient
- ✅ Follows Node-RED patterns (exec, file nodes)

**Enhancement**: Add `confirmWrite` config option in future if requested

---

## 6. Test-Driven Development Plan

### 6.1 Test Categories

#### 6.1.1 Configuration Tests

**File**: `test/node-config.test.js`

```javascript
describe("goodwe node configuration", () => {
    test("should load with default configuration", () => {
        // Verify default values: port=8899, protocol=udp, family=ET
    });
    
    test("should validate required host field", () => {
        // Verify host is required
    });
    
    test("should accept valid IP addresses", () => {
        // Test: 192.168.1.100, 10.0.0.1, etc.
    });
    
    test("should accept valid hostnames", () => {
        // Test: inverter.local, goodwe.home, etc.
    });
    
    test("should reject invalid host values", () => {
        // Test: empty, spaces, invalid chars
    });
    
    test("should validate port range", () => {
        // Test: 1-65535, reject 0, 65536, negative
    });
    
    test("should auto-update port when protocol changes", () => {
        // UDP -> 8899, Modbus -> 502
    });
});
```

#### 6.1.2 Message Format Tests

**File**: `test/message-format.test.js`

```javascript
describe("input message processing", () => {
    test("should accept string command 'read'", () => {
        // msg.payload = "read"
    });
    
    test("should accept object command", () => {
        // msg.payload = { command: "read" }
    });
    
    test("should accept read_sensor command", () => {
        // msg.payload = { command: "read_sensor", sensor_id: "vpv1" }
    });
    
    test("should reject invalid commands", () => {
        // Verify error for unknown commands
    });
    
    test("should validate required parameters", () => {
        // read_sensor needs sensor_id
    });
});

describe("output message format", () => {
    test("should output flat format by default", () => {
        // Verify structure matches spec
    });
    
    test("should output categorized format when configured", () => {
        // Verify nested structure
    });
    
    test("should output array format when configured", () => {
        // Verify array with metadata
    });
    
    test("should include timestamp", () => {
        // Verify ISO 8601 format
    });
    
    test("should include inverter metadata", () => {
        // Verify _inverter object
    });
    
    test("should set topic correctly", () => {
        // Verify goodwe/* topics
    });
    
    test("should preserve input message properties", () => {
        // Verify _msgid, custom properties preserved
    });
});

describe("error message format", () => {
    test("should include success=false", () => {});
    
    test("should include error type and code", () => {});
    
    test("should include error details", () => {});
    
    test("should include helpful suggestions", () => {});
});
```

#### 6.1.3 Status Reporting Tests

**File**: `test/status-reporting.test.js`

```javascript
describe("node status updates", () => {
    test("should show 'disconnected' initially", () => {});
    
    test("should show 'connecting...' when connecting", () => {});
    
    test("should show 'connected' when successful", () => {});
    
    test("should show 'reading...' during read operation", () => {});
    
    test("should show 'error: message' on failure", () => {});
    
    test("should show retry count during retries", () => {});
    
    test("should track consecutive failures", () => {});
    
    test("should clear status after success", () => {});
});
```

#### 6.1.4 Protocol Tests

**File**: `test/protocol.test.js`

```javascript
describe("UDP protocol", () => {
    test("should send AA55 discovery command", () => {});
    
    test("should parse discovery response", () => {});
    
    test("should send ModbusRTU read command", () => {});
    
    test("should parse runtime data response", () => {});
    
    test("should handle timeout", () => {});
    
    test("should retry on failure", () => {});
});

describe("Modbus TCP protocol", () => {
    test("should establish TCP connection", () => {});
    
    test("should send Modbus TCP read command", () => {});
    
    test("should parse Modbus TCP response", () => {});
});
```

#### 6.1.5 Integration Tests

**File**: `test/integration.test.js`

```javascript
describe("end-to-end scenarios", () => {
    test("should discover and read from ET inverter", () => {});
    
    test("should handle connection failure gracefully", () => {});
    
    test("should retry and eventually succeed", () => {});
    
    test("should handle rapid sequential requests", () => {});
});
```

### 6.2 Test Coverage Goals

- **Overall coverage**: ≥ 70%
- **Protocol code**: ≥ 95%
- **Message processing**: ≥ 90%
- **Error handling**: ≥ 85%

### 6.3 Mock Data

Create mock inverter responses for testing:

**File**: `test/fixtures/mock-responses.js`

```javascript
module.exports = {
    discovery: {
        aa55: Buffer.from("AA557FC001820D..."), // AA55 discovery response
        et_family: { model: "GW5000-EH", serial: "ETxxxxxxxx" }
    },
    
    runtimeData: {
        et_family: Buffer.from("AA55F7..."), // Runtime data response
        parsed: {
            vpv1: 245.5,
            ipv1: 6.2,
            // ... all sensors
        }
    },
    
    deviceInfo: {
        model_name: "GW5000-EH",
        serial_number: "ETxxxxxxxx",
        // ... all fields
    },
    
    errors: {
        timeout: new Error("TIMEOUT"),
        connectionRefused: new Error("ECONNREFUSED"),
        protocolError: new Error("PROTOCOL_ERROR")
    }
};
```

### 6.4 Test Execution Order

1. **Configuration tests** - Verify UI and properties
2. **Message format tests** - Verify I/O structure
3. **Status tests** - Verify status updates
4. **Protocol tests** - Verify communication
5. **Integration tests** - Verify end-to-end

### 6.5 CI/CD Integration

Tests run on every commit:
- GitHub Actions workflow
- Jest with coverage reporting
- ESLint for code quality
- Minimum 70% coverage enforced

---

## 7. Open Questions

### 7.1 Design Questions

| Question | Options | Recommendation | Priority |
|----------|---------|----------------|----------|
| Should we implement auto-discovery of inverters on network? | Yes / No / Later | **Later** (v1.1) | Medium |
| Should we cache sensor data? | Yes / No | **No** (real-time only) | Low |
| Should we support multiple inverters in one node? | Yes / No | **No** (use multiple nodes) | Low |
| Should write operations require explicit confirmation? | Yes / No | **No** (trust user) | Low |
| Should we add a config node for shared connections? | Yes / No | **Later** (v2.0) | Low |

### 7.2 Implementation Questions

| Question | Options | Recommendation | Priority |
|----------|---------|----------------|----------|
| Which protocol to implement first? | UDP / Modbus / Both | **UDP** (more common) | High |
| Which family to implement first? | ET / ES / DT | **ET** (most popular) | High |
| Should we use TypeScript? | Yes / No | **No** (keep simple) | Low |
| Should we bundle protocol library separately? | Yes / No | **No** (monolithic) | Low |

### 7.3 Future Considerations

1. **Dashboard Integration**: Pre-built dashboard widgets for common displays
2. **Historical Data**: Option to store and query historical sensor data
3. **Alerts**: Configurable alerts based on sensor thresholds
4. **Multi-Inverter**: Support for aggregating data from multiple inverters
5. **Configuration Backup**: Ability to backup/restore inverter settings

---

## 8. Diagrams

### 8.1 Node Interaction Flow

```
┌──────────┐        ┌──────────┐        ┌──────────┐
│  Inject  │──msg──▶│  GoodWe  │──msg──▶│  Debug   │
│   Node   │        │   Node   │        │   Node   │
└──────────┘        └──────────┘        └──────────┘
                         │
                         │ UDP/TCP
                         ▼
                    ┌──────────┐
                    │ Inverter │
                    └──────────┘
```

### 8.2 State Machine

```
    [Init]
       │
       ▼
 [Disconnected] ◀────────┐
       │                 │
       │ connect()       │ close()
       ▼                 │
  [Connecting] ──error──▶│
       │                 │
       │ success         │
       ▼                 │
  [Connected] ───────────┘
       │
       │ read()
       ▼
   [Reading] ──success──▶ output msg
       │
       │ timeout
       ▼
   [Retrying] ──success──▶ [Connected]
       │
       │ max retries
       ▼
    [Error] ────────────▶ [Disconnected]
```

### 8.3 Data Flow

```
Input Msg                                    Output Msg
   │                                            ▲
   ├─ msg.payload = "read"                    │
   ├─ msg.correlationId                       │
   └─ msg.customProps                         │
        │                                      │
        ▼                                      │
   ┌─────────────────┐                        │
   │ Command Router  │                        │
   └────────┬────────┘                        │
            │                                  │
            ├── read ───────────────┐         │
            ├── discover ────┐       │         │
            └── device_info ─┼───┐   │         │
                             │   │   │         │
                    ┌────────▼───▼───▼────┐   │
                    │  Protocol Handler   │   │
                    └────────┬────────────┘   │
                             │                 │
                        UDP/TCP Request        │
                             │                 │
                             ▼                 │
                        [Inverter]             │
                             │                 │
                        UDP/TCP Response       │
                             │                 │
                    ┌────────▼────────────┐   │
                    │   Data Parser       │   │
                    └────────┬────────────┘   │
                             │                 │
                    ┌────────▼────────────┐   │
                    │  Output Formatter   │   │
                    └────────┬────────────┘   │
                             │                 │
                             └─────────────────┘
```

---

## 9. Next Steps

### 9.1 Immediate Actions (This PR)

1. ✅ Create this design document
2. ✅ Define test structure and specifications
3. ⏭️ Review and validate design decisions
4. ⏭️ Get stakeholder feedback

### 9.2 Implementation Phase (Next PRs)

1. **Phase 1**: Basic node structure and configuration UI
2. **Phase 2**: UDP protocol implementation (ET family)
3. **Phase 3**: Runtime data read and parsing
4. **Phase 4**: Device info and discovery
5. **Phase 5**: Error handling and status reporting
6. **Phase 6**: Additional families and protocols
7. **Phase 7**: Configuration read/write operations

### 9.3 Documentation Phase

1. Update README with examples
2. Create user guide
3. Create troubleshooting guide
4. Add JSDoc comments
5. Create video tutorials (optional)

---

## Appendix A: Example Flows

### A.1 Basic Read Flow

```json
[
    {
        "id": "inject1",
        "type": "inject",
        "name": "Read every 10s",
        "repeat": "10",
        "payload": "read",
        "wires": [["goodwe1"]]
    },
    {
        "id": "goodwe1",
        "type": "goodwe",
        "name": "My Inverter",
        "host": "192.168.1.100",
        "port": 8899,
        "protocol": "udp",
        "family": "ET",
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "Show Data"
    }
]
```

### A.2 Dashboard Integration Flow

```json
[
    {
        "id": "goodwe1",
        "type": "goodwe",
        "name": "My Inverter",
        "host": "192.168.1.100",
        "wires": [["extract-power", "extract-soc"]]
    },
    {
        "id": "extract-power",
        "type": "function",
        "func": "msg.payload = msg.payload.data.ppv1 + msg.payload.data.ppv2;\nreturn msg;",
        "wires": [["gauge-power"]]
    },
    {
        "id": "gauge-power",
        "type": "ui_gauge",
        "name": "PV Power",
        "min": 0,
        "max": 10000,
        "unit": "W"
    }
]
```

### A.3 Error Handling Flow

```json
[
    {
        "id": "goodwe1",
        "type": "goodwe",
        "wires": [["success-handler"], ["error-handler"]]
    },
    {
        "id": "success-handler",
        "type": "switch",
        "property": "payload.success",
        "rules": [
            { "t": "true", "v": "true" }
        ],
        "wires": [["process-data"]]
    },
    {
        "id": "error-handler",
        "type": "switch",
        "property": "payload.success",
        "rules": [
            { "t": "false", "v": "false" }
        ],
        "wires": [["log-error", "notify-error"]]
    }
]
```

---

## Appendix B: Configuration Examples

### B.1 Basic Configuration

```javascript
{
    name: "Living Room Inverter",
    host: "192.168.1.100",
    port: 8899,
    protocol: "udp",
    family: "ET"
}
```

### B.2 Advanced Configuration

```javascript
{
    name: "Garage Inverter",
    host: "192.168.1.101",
    port: 8899,
    protocol: "udp",
    family: "ES",
    timeout: 2000,
    retries: 5,
    outputFormat: "categorized",
    pollingInterval: 5  // Auto-poll every 5 seconds
}
```

### B.3 Modbus TCP Configuration

```javascript
{
    name: "Main Inverter",
    host: "192.168.1.100",
    port: 502,
    protocol: "modbus",
    family: "DT",
    timeout: 3000,
    retries: 1  // TCP is more reliable, fewer retries needed
}
```

---

**Document Status**: ✅ Complete and Ready for Review  
**Next Steps**: Get stakeholder approval, then begin implementation
