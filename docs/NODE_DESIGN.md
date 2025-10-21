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

- **Node Structure**: Multiple specialized nodes (`goodwe-read`, `goodwe-write`, `goodwe-discover`, `goodwe-config`) with shared helper library
- **Configuration**: Shared configuration node (`goodwe-config`) for connection settings
- **Operation**: Purpose-built nodes for specific operations with simplified interfaces
- **Status**: Visual feedback using Node-RED status API
- **Error Handling**: Comprehensive error messages with retry tracking
- **Code Sharing**: Common protocol and communication functions in helper library

---

## 1. Node Structure

### 1.1 Node Types

After analyzing the requirements and Node-RED best practices, we will implement **multiple specialized nodes** with a shared helper library:

#### Configuration Node: `goodwe-config`

**Purpose**: Shared configuration for connection settings
- Stores inverter connection details (host, port, protocol, family)
- Manages connection pooling and lifecycle
- Used by all operational nodes

**Rationale**:
- Eliminates configuration duplication across nodes
- Centralizes connection management
- Allows multiple nodes to share one connection
- Follows Node-RED best practices for reusable configurations

#### Operational Nodes:

1. **`goodwe-read`** - Read runtime sensor data
   - Input: Trigger message (optional sensor filter)
   - Output: Runtime sensor data
   - Purpose: Primary data acquisition node

2. **`goodwe-write`** - Write configuration settings
   - Input: Setting ID and value
   - Output: Write confirmation
   - Purpose: Configuration management (use with caution)

3. **`goodwe-discover`** - Discover inverters on network
   - Input: Trigger message
   - Output: List of discovered inverters
   - Purpose: Network discovery and auto-configuration

4. **`goodwe-info`** - Get device information
   - Input: Trigger message
   - Output: Device model, serial, firmware info
   - Purpose: Device identification and diagnostics

**Rationale for Multiple Nodes**:
- ✅ **Clearer purpose** - Each node has a single, well-defined responsibility
- ✅ **Simpler interfaces** - No need to learn command structures
- ✅ **Better visual flows** - Flow diagrams are more self-documenting
- ✅ **Safety** - Write operations isolated in dedicated node
- ✅ **Easier testing** - Each node can be tested independently
- ✅ **Code reuse** - Common functions in shared helper library

**Tradeoffs**:
- ❌ More nodes to maintain
- ❌ Users need to learn multiple node types
- ✅ Mitigated by: Shared helper library reduces duplication
- ✅ Mitigated by: Consistent patterns across all nodes

#### Helper Library: `lib/goodwe-helper.js`

**Purpose**: Shared protocol and communication functions

Contains:
- Protocol implementations (UDP AA55, ModbusRTU, Modbus TCP)
- Connection management and pooling
- Data parsing and encoding
- Error handling and retry logic
- Sensor definitions per inverter family

**Benefits**:
- Eliminates code duplication
- Centralizes protocol logic
- Easier to maintain and test
- Single source of truth for protocol details

### 1.2 Node Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GoodWe Node Ecosystem                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │ goodwe-read  │  │ goodwe-write │  │goodwe-discover│    │
│  │              │  │              │  │              │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │            │
│         └─────────────────┼─────────────────┘            │
│                           │                              │
│                           ▼                              │
│              ┌─────────────────────────┐                 │
│              │   goodwe-config node    │                 │
│              │  (Shared Configuration) │                 │
│              │  - Host, Port, Protocol │                 │
│              │  - Family, Timeout      │                 │
│              └────────────┬────────────┘                 │
│                           │                              │
│                           ▼                              │
│              ┌─────────────────────────┐                 │
│              │  lib/goodwe-helper.js   │                 │
│              │  (Shared Functions)     │                 │
│              │  - Protocol handlers    │                 │
│              │  - Connection mgmt      │                 │
│              │  - Data parsing         │                 │
│              │  - Error handling       │                 │
│              └────────────┬────────────┘                 │
│                           │                              │
│                           ▼                              │
│                    UDP/TCP Transport                     │
│                           │                              │
└───────────────────────────┼──────────────────────────────┘
                            ▼
                    [GoodWe Inverter]
```

### 1.3 Node Details

#### goodwe-config (Configuration Node)

**Properties**:
- Host (IP address or hostname)
- Port (8899 for UDP, 502 for Modbus)
- Protocol (UDP or Modbus TCP)
- Family (ET, ES, DT series)
- Timeout (milliseconds)
- Retries (number of attempts)

**Responsibilities**:
- Store connection configuration
- Manage connection lifecycle
- Provide connection to operational nodes
- Track connection status

#### goodwe-read (Data Read Node)

**Inputs**: 1 (trigger or filter)
**Outputs**: 1 (sensor data)

**Input Options**:
```javascript
// Trigger read all sensors
msg.payload = "read"

// Read specific sensor
msg.payload = { sensor_id: "vpv1" }

// Read multiple sensors
msg.payload = { sensors: ["vpv1", "vpv2", "battery_soc"] }
```

**Output Format**:
```javascript
{
    payload: {
        vpv1: 245.5,
        ipv1: 6.2,
        ppv1: 1522,
        battery_soc: 87,
        // ... more sensors
    },
    topic: "goodwe/runtime_data",
    _inverter: { model: "...", serial: "...", family: "..." }
}
```

#### goodwe-write (Configuration Write Node)

**Inputs**: 1 (setting and value)
**Outputs**: 1 (confirmation)

**Input Format**:
```javascript
msg.payload = {
    setting_id: "grid_export_limit",
    value: 5000
}
```

**Output Format**:
```javascript
{
    payload: {
        success: true,
        setting_id: "grid_export_limit",
        value: 5000,
        previous_value: 4000
    },
    topic: "goodwe/write_confirm"
}
```

#### goodwe-discover (Discovery Node)

**Inputs**: 1 (trigger)
**Outputs**: 1 (discovered devices)

**Input**: Any message triggers discovery

**Output Format**:
```javascript
{
    payload: {
        devices: [
            {
                host: "192.168.1.100",
                model: "GW5000-EH",
                serial: "ETxxxxxxxx",
                family: "ET"
            }
        ],
        count: 1
    },
    topic: "goodwe/discover"
}
```

#### goodwe-info (Device Info Node)

**Inputs**: 1 (trigger)
**Outputs**: 1 (device information)

**Output Format**:
```javascript
{
    payload: {
        model_name: "GW5000-EH",
        serial_number: "ETxxxxxxxx",
        rated_power: 5000,
        firmware: "V1.2.3",
        arm_firmware: "V2.0.1",
        family: "ET"
    },
    topic: "goodwe/device_info"
}
```

---

## 2. Configuration UI Design

### 2.1 goodwe-config Node Properties

The configuration node stores shared connection settings used by all operational nodes.

#### 2.1.1 Basic Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Name** | text | No | `""` | Configuration name (for identification) |
| **Host** | text | Yes | `""` | IP address or hostname (e.g., `192.168.1.100`) |
| **Port** | number | Yes | `8899` | Communication port (8899 for UDP, 502 for Modbus TCP) |
| **Protocol** | select | Yes | `udp` | Communication protocol: `udp` or `modbus` |
| **Family** | select | Yes | `ET` | Inverter family (ET, ES, DT, etc.) |

#### 2.1.2 Advanced Configuration

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Timeout** | number | No | `1000` | Response timeout in milliseconds |
| **Retries** | number | No | `3` | Number of retry attempts for failed requests |
| **Comm Address** | number | No | `auto` | Communication address (0xF7 or 0x7F, auto-detected) |
| **Keep Alive** | boolean | No | `true` | Keep connection alive between requests |

### 2.2 Operational Node Properties

Each operational node has minimal configuration since connection settings are in the config node.

#### goodwe-read Node

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Name** | text | No | `""` | Node display name |
| **Config** | config | Yes | - | Reference to goodwe-config node |
| **Output Format** | select | No | `flat` | Output data format: `flat`, `categorized`, `array` |
| **Polling** | number | No | `0` | Auto-polling interval in seconds (0 = disabled) |

#### goodwe-write Node

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Name** | text | No | `""` | Node display name |
| **Config** | config | Yes | - | Reference to goodwe-config node |
| **Confirm** | boolean | No | `false` | Require confirmation before write |

#### goodwe-discover Node

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Name** | text | No | `""` | Node display name |
| **Timeout** | number | No | `5000` | Discovery timeout in milliseconds |

#### goodwe-info Node

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Name** | text | No | `""` | Node display name |
| **Config** | config | Yes | - | Reference to goodwe-config node |

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

### 2.3 UI Mockup - goodwe-config Node

```
┌───────────────────────────────────────────────┐
│ Edit goodwe-config node                   [X] │
├───────────────────────────────────────────────┤
│                                               │
│  Name         [My GoodWe Inverter_______]    │
│                                               │
│  ━━━━━━━━ Connection Settings ━━━━━━━        │
│                                               │
│  Host         [192.168.1.100____________] *  │
│               (IP address or hostname)        │
│                                               │
│  Protocol     [UDP (port 8899)      ▼] *     │
│                                               │
│  Port         [8899_____________________] *  │
│                                               │
│  Family       [ET Series (ET, EH)   ▼] *     │
│                                               │
│  ━━━━━━━━ Advanced Settings ━━━━━━━ [+]      │
│                                               │
│  [Cancel]                            [Done]   │
└───────────────────────────────────────────────┘

When Advanced Settings expanded:

│  ━━━━━━━━ Advanced Settings ━━━━━━━ [-]      │
│                                               │
│  Timeout      [1000____________________] ms   │
│  Retries      [3_______________________]      │
│  Comm Addr    [Auto (detect)        ▼]       │
│  Keep Alive   [✓] Keep connection alive      │
```

### 2.4 UI Mockup - goodwe-read Node

```
┌───────────────────────────────────────────────┐
│ Edit goodwe-read node                     [X] │
├───────────────────────────────────────────────┤
│                                               │
│  Name         [Read Inverter Data_______]    │
│                                               │
│  Config       [My GoodWe Inverter    ▼] *    │
│               (Select configuration node)     │
│                                               │
│  Output       [Flat (default)        ▼]      │
│               (Data format)                   │
│                                               │
│  Polling      [0_______________________] sec  │
│               (0 = manual trigger only)       │
│                                               │
│  [Cancel]                            [Done]   │
└───────────────────────────────────────────────┘
```

### 2.5 UI Mockup - goodwe-write Node

```
┌───────────────────────────────────────────────┐
│ Edit goodwe-write node                    [X] │
├───────────────────────────────────────────────┤
│                                               │
│  Name         [Write Settings___________]    │
│                                               │
│  Config       [My GoodWe Inverter    ▼] *    │
│               (Select configuration node)     │
│                                               │
│  ⚠️  WARNING: Writing settings can damage     │
│     your inverter or void warranty           │
│                                               │
│  Confirm      [✓] Require confirmation       │
│                                               │
│  [Cancel]                            [Done]   │
└───────────────────────────────────────────────┘
```

### 2.6 Validation Rules

**goodwe-config Node:**
1. **Host**: Must be valid IP address or hostname (regex validated)
2. **Port**: Must be 1-65535 (number validation)
3. **Timeout**: Must be >= 100ms
4. **Retries**: Must be >= 0

**goodwe-read Node:**
1. **Config**: Must reference a valid goodwe-config node
2. **Polling Interval**: Must be >= 0 (0 means disabled)

**goodwe-write Node:**
1. **Config**: Must reference a valid goodwe-config node

**goodwe-discover Node:**
1. **Timeout**: Must be >= 1000ms (discovery needs time)

**goodwe-info Node:**
1. **Config**: Must reference a valid goodwe-config node

---

## 3. Message Structure

Since we have specialized nodes, each node has its own simpler message structure without commands.

### 3.1 goodwe-read Node Messages

#### 3.1.1 Input Messages

**Trigger all sensors** (any message triggers read):
```javascript
// Simple trigger
msg.payload = true

// Or empty object
msg.payload = {}
```

**Read specific sensor(s)**:
```javascript
// Single sensor
msg.payload = { sensor_id: "vpv1" }

// Multiple sensors
msg.payload = { sensors: ["vpv1", "vpv2", "battery_soc"] }
```

#### 3.1.2 Output Messages

**Flat format** (default):
```javascript
{
    payload: {
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
    },
    topic: "goodwe/runtime_data",
    _timestamp: "2025-10-20T21:37:42.452Z",
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
    },
    topic: "goodwe/runtime_data",
    _timestamp: "2025-10-20T21:37:42.452Z",
    _inverter: { /* ... */ }
}
```

**Array format** (with metadata):
```javascript
{
    payload: [
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
    ],
    topic: "goodwe/runtime_data",
    _timestamp: "2025-10-20T21:37:42.452Z",
    _inverter: { /* ... */ }
}
```

### 3.2 goodwe-write Node Messages

#### 3.2.1 Input Messages

**Write single setting**:
```javascript
msg.payload = {
    setting_id: "grid_export_limit",
    value: 5000  // Watts
}
```

**Write with confirmation** (if enabled in node config):
```javascript
msg.payload = {
    setting_id: "grid_export_limit",
    value: 5000,
    confirm: true  // Explicitly confirm dangerous operation
}
```

#### 3.2.2 Output Messages

**Success**:
```javascript
{
    payload: {
        success: true,
        setting_id: "grid_export_limit",
        value: 5000,
        previous_value: 4000
    },
    topic: "goodwe/write_confirm",
    _timestamp: "2025-10-20T21:37:42.452Z"
}
```

**Error**:
```javascript
{
    payload: {
        success: false,
        setting_id: "grid_export_limit",
        error: {
            message: "Value out of range",
            code: "VALIDATION_ERROR",
            details: {
                min: 0,
                max: 10000,
                provided: 15000
            }
        }
    },
    topic: "goodwe/error",
    _timestamp: "2025-10-20T21:37:42.452Z"
}
```

### 3.3 goodwe-discover Node Messages

#### 3.3.1 Input Messages

**Trigger discovery** (any message):
```javascript
msg.payload = true
// or
msg.payload = {}
```

#### 3.3.2 Output Messages

**Discovery results**:
```javascript
{
    payload: {
        devices: [
            {
                host: "192.168.1.100",
                model: "GW5000-EH",
                serial: "ETxxxxxxxx",
                family: "ET",
                port: 8899,
                protocol: "udp"
            },
            {
                host: "192.168.1.101",
                model: "GW10K-ET",
                serial: "ETyyyyyyyy",
                family: "ET",
                port: 8899,
                protocol: "udp"
            }
        ],
        count: 2
    },
    topic: "goodwe/discover",
    _timestamp: "2025-10-20T21:37:42.452Z"
}
```

**No devices found**:
```javascript
{
    payload: {
        devices: [],
        count: 0
    },
    topic: "goodwe/discover",
    _timestamp: "2025-10-20T21:37:42.452Z"
}
```

### 3.4 goodwe-info Node Messages

#### 3.4.1 Input Messages

**Trigger device info** (any message):
```javascript
msg.payload = true
```

#### 3.4.2 Output Messages

**Device information**:
```javascript
{
    payload: {
        model_name: "GW5000-EH",
        serial_number: "ETxxxxxxxx",
        rated_power: 5000,        // W
        firmware: "V1.2.3",
        arm_firmware: "V2.0.1",
        modbus_version: 2,
        family: "ET",
        dsp1_version: "V1.0.0",
        dsp2_version: "V1.0.0"
    },
    topic: "goodwe/device_info",
    _timestamp: "2025-10-20T21:37:42.452Z"
}
```
            
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

### 3.5 Error Messages (All Nodes)

All nodes use a consistent error message format:

```javascript
{
    payload: {
        success: false,
        error: {
            message: "Connection timeout",
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
    },
    topic: "goodwe/error",
    _timestamp: "2025-10-20T21:37:42.452Z"
}
```

### 3.6 Message Topic Convention

All operational nodes use consistent topic patterns:
- **goodwe-read**: `goodwe/runtime_data`
- **goodwe-write**: `goodwe/write_confirm` or `goodwe/error`
- **goodwe-discover**: `goodwe/discover`
- **goodwe-info**: `goodwe/device_info`

Topics can be overridden by setting `msg.topic` in the input message.

### 3.7 Preserving Input Message Properties

All nodes preserve properties from the input message except `payload`. This allows chaining and correlation:

```javascript
// Input
{
    payload: true,
    _msgid: "abc123",
    correlationId: "user-defined-id",
    customProperty: "preserved"
}

// Output
{
    payload: { /* result data */ },
    _msgid: "abc123",                  // preserved
    correlationId: "user-defined-id",  // preserved
    customProperty: "preserved",       // preserved
    topic: "goodwe/runtime_data",      // added
    _timestamp: "...",                 // added
    _inverter: { /* inverter info */ } // added (if applicable)
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

### 5.1 Multiple Specialized Nodes vs Single Unified Node

**Decision**: Multiple specialized nodes with shared helper library

**Rationale**:
- ✅ **Clearer purpose** - Each node has single, well-defined responsibility
- ✅ **Simpler interfaces** - No command structure to learn
- ✅ **Better visual flows** - Flow diagrams are self-documenting
- ✅ **Safety** - Write operations isolated in dedicated node
- ✅ **Easier testing** - Each node tested independently
- ✅ **Code reuse** - Shared helper library eliminates duplication
- ✅ **Follows Node-RED patterns** - Similar to serial, modbus, HTTP nodes

**Tradeoff**:
- ❌ More nodes to maintain (4 operational + 1 config)
- ❌ Users need to learn multiple node types
- ✅ Mitigated by: Shared helper library reduces code duplication
- ✅ Mitigated by: Consistent patterns across all nodes
- ✅ Mitigated by: Each node is simpler than unified approach

**Alternative Considered**: Single unified node with command-based operation
- **Rejected because**: User feedback indicated preference for specialized nodes
- **Rejected because**: Write operations need extra safety, easier with dedicated node
- **Rejected because**: Self-documenting flows are more important than node count

### 5.2 Shared Config Node vs Inline Configuration

**Decision**: Shared `goodwe-config` configuration node

**Rationale**:
- ✅ Eliminates configuration duplication
- ✅ Single point of truth for connection settings
- ✅ Multiple nodes can share one connection
- ✅ Easier to manage multiple inverters
- ✅ Follows Node-RED best practices
- ✅ Centralizes connection lifecycle management

**Tradeoff**:
- ❌ One extra click to set up (create config node first)
- ✅ Mitigated by: Standard Node-RED pattern, users familiar with it
- ✅ Benefit: Much better for real-world usage with multiple nodes

**Alternative Considered**: Inline configuration in each node
- **Rejected because**: Would duplicate config across read/write/info nodes
- **Rejected because**: Harder to change host/port when duplicated
- **Rejected because**: Config node is Node-RED best practice

### 5.3 Helper Library for Shared Code

**Decision**: Create `lib/goodwe-helper.js` for common functions

**Rationale**:
- ✅ Eliminates code duplication across nodes
- ✅ Single source of truth for protocol logic
- ✅ Easier to maintain and test
- ✅ Centralized error handling
- ✅ Consistent behavior across all nodes

**Tradeoff**:
- ❌ Additional abstraction layer
- ✅ Benefit: Greatly reduces overall code complexity
- ✅ Benefit: Changes in protocol logic only needed in one place

### 5.4 Output Format Options

**Decision**: Support multiple output formats (flat, categorized, array) in goodwe-read node

**Rationale**:
- ✅ Different users prefer different formats
- ✅ Flat is simple for beginners
- ✅ Categorized is better for dashboards
- ✅ Array preserves metadata

**Tradeoff**:
- ❌ Adds complexity to goodwe-read node
- ✅ Configuration option makes it user choice
- ✅ Helper library can provide formatter functions

### 5.5 Auto-Polling in goodwe-read Node

**Decision**: Support optional auto-polling in goodwe-read only

**Rationale**:
- ✅ Auto-polling convenient for monitoring
- ✅ Manual trigger better for on-demand reads
- ✅ Polling interval = 0 disables auto-polling
- ✅ Only makes sense for read operations

**Tradeoff**:
- ❌ Need to manage polling lifecycle
- ✅ Common requirement for monitoring use cases
- ✅ Other nodes remain simple (no polling)

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

**File**: `test/config-node.test.js`

```javascript
describe("goodwe-config node configuration", () => {
    test("should load with default configuration", () => {
        // Verify default values: port=8899, protocol=udp, family=ET
    });
    
    test("should validate required host field", () => {
        // Verify host is required in config node
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

describe("operational node configuration", () => {
    test("goodwe-read should require config reference", () => {
        // Verify config node is required
    });
    
    test("goodwe-write should require config reference", () => {
        // Verify config node is required
    });
    
    test("goodwe-info should require config reference", () => {
        // Verify config node is required
    });
    
    test("goodwe-discover should work without config", () => {
        // Discovery node is independent
    });
    
    test("goodwe-read should accept output format option", () => {
        // flat, categorized, array
    });
});
```

#### 6.1.2 Node-Specific Message Tests

**File**: `test/goodwe-read.test.js`

```javascript
describe("goodwe-read input messages", () => {
    test("should accept simple trigger", () => {
        // msg.payload = true
    });
    
    test("should accept sensor filter", () => {
        // msg.payload = { sensor_id: "vpv1" }
    });
    
    test("should accept multiple sensor filter", () => {
        // msg.payload = { sensors: ["vpv1", "battery_soc"] }
    });
});

describe("goodwe-read output messages", () => {
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
        // Verify _timestamp field
    });
    
    test("should include inverter metadata", () => {
        // Verify _inverter object
    });
    
    test("should set correct topic", () => {
        // Verify goodwe/runtime_data
    });
    
    test("should preserve input message properties", () => {
        // Verify _msgid, custom properties preserved
    });
});
```

**File**: `test/goodwe-write.test.js`

```javascript
describe("goodwe-write input messages", () => {
    test("should accept setting write", () => {
        // msg.payload = { setting_id: "...", value: ... }
    });
    
    test("should validate setting_id presence", () => {
        // Reject if missing
    });
    
    test("should validate value presence", () => {
        // Reject if missing
    });
    
    test("should handle confirmation requirement", () => {
        // If confirmation enabled in config
    });
});

describe("goodwe-write output messages", () => {
    test("should include success flag", () => {
        // success: true/false
    });
    
    test("should include previous value on success", () => {
        // previous_value field
    });
    
    test("should include error details on failure", () => {
        // error object with details
    });
});
```

**File**: `test/goodwe-discover.test.js`

```javascript
describe("goodwe-discover operation", () => {
    test("should trigger on any message", () => {
        // Any payload triggers discovery
    });
    
    test("should return devices array", () => {
        // payload.devices
    });
    
    test("should return device count", () => {
        // payload.count
    });
    
    test("should handle no devices found", () => {
        // Empty array, count = 0
    });
    
    test("should include device details", () => {
        // host, model, serial, family, port, protocol
    });
});
```

**File**: `test/goodwe-info.test.js`

```javascript
describe("goodwe-info operation", () => {
    test("should trigger on any message", () => {
        // Any payload triggers info read
    });
    
    test("should return device information", () => {
        // model_name, serial_number, etc.
    });
    
    test("should include firmware versions", () => {
        // firmware, arm_firmware, etc.
    });
    
    test("should set correct topic", () => {
        // goodwe/device_info
    });
});
```

#### 6.1.3 Helper Library Tests

**File**: `test/goodwe-helper.test.js`

```javascript
describe("protocol handlers", () => {
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

describe("data parsing", () => {
    test("should parse sensor values correctly", () => {});
    
    test("should apply unit conversions", () => {});
    
    test("should handle missing data gracefully", () => {});
    
    test("should format flat output", () => {});
    
    test("should format categorized output", () => {});
    
    test("should format array output", () => {});
});

describe("error handling", () => {
    test("should create error messages with details", () => {});
    
    test("should track consecutive failures", () => {});
    
    test("should provide helpful suggestions", () => {});
});
```

#### 6.1.4 Status Reporting Tests

**File**: `test/status-reporting.test.js`

```javascript
describe("node status updates", () => {
    test("goodwe-read should show status transitions", () => {});
    
    test("goodwe-write should show status transitions", () => {});
    
    test("goodwe-discover should show discovery progress", () => {});
    
    test("goodwe-info should show info retrieval", () => {});
    
    test("should show 'connecting...' when connecting", () => {});
    
    test("should show 'connected' when successful", () => {});
    
    test("should show 'reading...' during read operation", () => {});
    
    test("should show 'writing...' during write operation", () => {});
    
    test("should show 'error: message' on failure", () => {});
    
    test("should show retry count during retries", () => {});
    
    test("should track consecutive failures", () => {});
    
    test("should clear status after success", () => {});
});
```

#### 6.1.5 Integration Tests

**File**: `test/integration.test.js`

```javascript
describe("end-to-end scenarios", () => {
    test("should create config node and use with read node", () => {});
    
    test("should discover and then connect to inverter", () => {});
    
    test("should read data using goodwe-read node", () => {});
    
    test("should write setting using goodwe-write node", () => {});
    
    test("should get device info using goodwe-info node", () => {});
    
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

### 7.1 Design Questions (RESOLVED)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Should we use single unified node or specialized nodes? | **Specialized nodes** | User feedback, better safety, clearer flows |
| Should we add a config node for shared connections? | **Yes** (implemented) | Eliminates duplication, follows best practices |
| Should we create helper library? | **Yes** (lib/goodwe-helper.js) | Code reuse, single source of truth |

### 7.2 Implementation Questions

| Question | Options | Recommendation | Priority |
|----------|---------|----------------|----------|
| Should we implement auto-discovery of inverters on network? | Yes / No / Later | **Yes** (goodwe-discover node) | High |
| Should we cache sensor data? | Yes / No | **No** (real-time only) | Low |
| Should write operations require explicit confirmation? | Yes / No | **Optional** (config option) | Medium |
| Which protocol to implement first? | UDP / Modbus / Both | **UDP** (more common) | High |
| Which family to implement first? | ET / ES / DT | **ET** (most popular) | High |
| Should we use TypeScript? | Yes / No | **No** (keep simple) | Low |

### 7.3 Future Considerations

1. **Dashboard Integration**: Pre-built dashboard widgets for common displays
2. **Historical Data**: Option to store and query historical sensor data
3. **Alerts**: Configurable alerts based on sensor thresholds
4. **Multi-Inverter Aggregation**: Node to aggregate data from multiple inverters
5. **Configuration Backup**: Ability to backup/restore inverter settings
6. **Settings Read Node**: Dedicated node for reading inverter settings (vs goodwe-read for sensors)

---

## 8. Diagrams

### 8.1 Node Interaction Flow

```
┌──────────┐        ┌────────────────┐        ┌──────────┐
│  Inject  │──msg──▶│ goodwe-read    │──msg──▶│  Debug   │
│   Node   │        │     Node       │        │   Node   │
└──────────┘        └───────┬────────┘        └──────────┘
                            │
                            │ uses config
                            ▼
                    ┌───────────────┐
                    │ goodwe-config │
                    │     Node      │
                    └───────┬───────┘
                            │
                            │ delegates to
                            ▼
                    ┌───────────────┐
                    │ goodwe-helper │
                    │  (lib/*.js)   │
                    └───────┬───────┘
                            │
                            │ UDP/TCP
                            ▼
                    ┌───────────────┐
                    │   Inverter    │
                    └───────────────┘

Multiple nodes sharing config:

┌──────────┐     ┌────────────────┐
│  Inject  │────▶│ goodwe-read    │────▶ [output]
└──────────┘     └────────┬───────┘
                          │
                          │ shares
                          ▼
                  ┌───────────────┐
                  │ goodwe-config │
                  │     Node      │
                  └───────┬───────┘
                          ▲
                          │ shares
┌──────────┐     ┌────────┴───────┐
│  Inject  │────▶│ goodwe-info    │────▶ [output]
└──────────┘     └────────────────┘
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

### 8.3 Data Flow (goodwe-read example)

```
Input Msg                                    Output Msg
   │                                            ▲
   ├─ msg.payload = true                       │
   ├─ msg.correlationId                        │
   └─ msg.customProps                          │
        │                                      │
        ▼                                      │
   ┌─────────────────┐                        │
   │  goodwe-read    │                        │
   │     Node        │                        │
   └────────┬────────┘                        │
            │                                  │
            │ get config                       │
            ▼                                  │
   ┌─────────────────┐                        │
   │ goodwe-config   │                        │
   └────────┬────────┘                        │
            │                                  │
            │ call helper                      │
            ▼                                  │
   ┌─────────────────────────┐                │
   │  lib/goodwe-helper.js   │                │
   ├─────────────────────────┤                │
   │  Protocol Handler       │                │
   └────────┬────────────────┘                │
            │                                  │
       UDP/TCP Request                         │
            │                                  │
            ▼                                  │
       [Inverter]                              │
            │                                  │
       UDP/TCP Response                        │
            │                                  │
   ┌────────▼────────────┐                    │
   │   Data Parser       │                    │
   │   (in helper)       │                    │
   └────────┬────────────┘                    │
            │                                  │
   ┌────────▼────────────┐                    │
   │  Output Formatter   │                    │
   │  (in read node)     │                    │
   └────────┬────────────┘                    │
            │                                  │
            └──────────────────────────────────┘
```
                             └─────────────────┘
```

---

## 9. Next Steps

### 9.1 Immediate Actions (This PR)

1. ✅ Create this design document
2. ✅ Define test structure and specifications
3. ✅ Revise to use specialized nodes approach
4. ⏭️ Review and validate design decisions
5. ⏭️ Get stakeholder feedback

### 9.2 Implementation Phase (Next PRs)

#### Phase 1: Helper Library and Config Node
1. Create `lib/goodwe-helper.js` with protocol stubs
2. Implement `goodwe-config` configuration node
3. Add connection management in helper
4. Create tests for config node

#### Phase 2: goodwe-read Node
1. Implement `goodwe-read` node
2. Add output formatting options (flat/categorized/array)
3. Implement polling functionality
4. Create tests for read node

#### Phase 3: Protocol Implementation
1. UDP AA55 protocol in helper
2. ModbusRTU over UDP in helper
3. Modbus TCP protocol in helper
4. ET family sensor definitions
5. Data parsing and conversion

#### Phase 4: Additional Operational Nodes
1. Implement `goodwe-discover` node
2. Implement `goodwe-info` node
3. Implement `goodwe-write` node (with safety warnings)
4. Create tests for all nodes

#### Phase 5: Error Handling and Polish
1. Comprehensive error handling in helper
2. Retry logic with exponential backoff
3. Status indicators for all nodes
4. Connection pooling optimization

#### Phase 6: Additional Families
1. ES family support
2. DT family support
3. Additional protocol variants
4. Extended sensor definitions

#### Phase 7: Configuration Management
1. Settings read functionality
2. Settings write with validation
3. Specialized APIs (grid export limit, operation mode, etc.)

### 9.3 File Structure

```
nodes/
├── goodwe-config.js         # Configuration node
├── goodwe-config.html       # Config node UI
├── goodwe-read.js           # Read runtime data node
├── goodwe-read.html         # Read node UI
├── goodwe-write.js          # Write settings node
├── goodwe-write.html        # Write node UI
├── goodwe-discover.js       # Discovery node
├── goodwe-discover.html     # Discovery node UI
├── goodwe-info.js           # Device info node
├── goodwe-info.html         # Info node UI
└── icons/                   # Node icons
    ├── goodwe-config.svg
    ├── goodwe-read.svg
    ├── goodwe-write.svg
    ├── goodwe-discover.svg
    └── goodwe-info.svg

lib/
└── goodwe-helper.js         # Shared protocol and utility functions

test/
├── config-node.test.js      # Config node tests
├── goodwe-read.test.js      # Read node tests
├── goodwe-write.test.js     # Write node tests
├── goodwe-discover.test.js  # Discovery node tests
├── goodwe-info.test.js      # Info node tests
├── goodwe-helper.test.js    # Helper library tests
├── status-reporting.test.js # Status indicator tests
└── integration.test.js      # End-to-end tests
```

### 9.4 Documentation Phase

1. Update README with specialized nodes examples
2. Create user guide for each node type
3. Create troubleshooting guide
4. Add JSDoc comments to all functions
5. Document helper library API
6. Create video tutorials (optional)

---

## Appendix A: Example Flows

### A.1 Basic Read Flow

```json
[
    {
        "id": "config1",
        "type": "goodwe-config",
        "name": "My GoodWe Inverter",
        "host": "192.168.1.100",
        "port": 8899,
        "protocol": "udp",
        "family": "ET"
    },
    {
        "id": "inject1",
        "type": "inject",
        "name": "Read every 10s",
        "repeat": "10",
        "payload": "true",
        "wires": [["read1"]]
    },
    {
        "id": "read1",
        "type": "goodwe-read",
        "name": "Read Inverter Data",
        "config": "config1",
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "Show Data"
    }
]
```

### A.2 Discovery and Auto-Configure Flow

```json
[
    {
        "id": "inject1",
        "type": "inject",
        "name": "Discover",
        "once": true,
        "payload": "true",
        "wires": [["discover1"]]
    },
    {
        "id": "discover1",
        "type": "goodwe-discover",
        "name": "Find Inverters",
        "wires": [["function1"]]
    },
    {
        "id": "function1",
        "type": "function",
        "name": "Extract First Device",
        "func": "if (msg.payload.devices.length > 0) {\n  msg.payload = msg.payload.devices[0];\n  return msg;\n}",
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "Show Found Inverter"
    }
]
```

### A.3 Dashboard Integration Flow

```json
[
    {
        "id": "config1",
        "type": "goodwe-config",
        "name": "My Inverter",
        "host": "192.168.1.100",
        "port": 8899,
        "protocol": "udp",
        "family": "ET"
    },
    {
        "id": "inject1",
        "type": "inject",
        "repeat": "5",
        "wires": [["read1"]]
    },
    {
        "id": "read1",
        "type": "goodwe-read",
        "config": "config1",
        "wires": [["extract-power", "extract-soc"]]
    },
    {
        "id": "extract-power",
        "type": "function",
        "func": "msg.payload = msg.payload.ppv1 + msg.payload.ppv2;\nreturn msg;",
        "wires": [["gauge-power"]]
    },
    {
        "id": "extract-soc",
        "type": "function",
        "func": "msg.payload = msg.payload.battery_soc;\nreturn msg;",
        "wires": [["gauge-soc"]]
    },
    {
        "id": "gauge-power",
        "type": "ui_gauge",
        "name": "PV Power",
        "min": 0,
        "max": 10000,
        "unit": "W"
    },
    {
        "id": "gauge-soc",
        "type": "ui_gauge",
        "name": "Battery SoC",
        "min": 0,
        "max": 100,
        "unit": "%"
    }
]
```

### A.4 Write Setting Flow (with Safety)

```json
[
    {
        "id": "config1",
        "type": "goodwe-config",
        "name": "My Inverter",
        "host": "192.168.1.100"
    },
    {
        "id": "inject1",
        "type": "inject",
        "name": "Set Export Limit",
        "payload": "{\"setting_id\":\"grid_export_limit\",\"value\":5000}",
        "payloadType": "json",
        "wires": [["write1"]]
    },
    {
        "id": "write1",
        "type": "goodwe-write",
        "name": "Write Setting",
        "config": "config1",
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug",
        "name": "Write Result"
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

### B.1 goodwe-config Node - Basic Configuration

```javascript
{
    name: "Living Room Inverter",
    host: "192.168.1.100",
    port: 8899,
    protocol: "udp",
    family: "ET"
}
```

### B.2 goodwe-config Node - Advanced Configuration

```javascript
{
    name: "Garage Inverter",
    host: "192.168.1.101",
    port: 8899,
    protocol: "udp",
    family: "ES",
    timeout: 2000,
    retries: 5,
    commAddr: "auto",  // or 0xF7, 0x7F
    keepAlive: true
}
```

### B.3 goodwe-config Node - Modbus TCP Configuration

```javascript
{
    name: "Main Inverter",
    host: "192.168.1.100",
    port: 502,
    protocol: "modbus",
    family: "DT",
    timeout: 3000,
    retries: 1  // TCP is more reliable
}
```

### B.4 goodwe-read Node Configuration

```javascript
{
    name: "Read Inverter Data",
    config: "config1",  // Reference to goodwe-config node
    outputFormat: "flat",  // or "categorized", "array"
    pollingInterval: 10  // Auto-poll every 10 seconds, 0 = disabled
}
```

### B.5 goodwe-write Node Configuration

```javascript
{
    name: "Write Settings",
    config: "config1",  // Reference to goodwe-config node
    confirm: true  // Require confirmation
}
```

---

**Document Status**: ✅ Complete and Ready for Implementation  
**Design Approach**: Multiple specialized nodes with shared helper library  
**Next Steps**: Begin implementation with helper library and config node
