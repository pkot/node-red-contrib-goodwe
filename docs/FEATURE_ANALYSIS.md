# GoodWe Python Library Feature Analysis for Node-RED Port

## Executive Summary

This document provides a comprehensive analysis of the [marcelblijleven/goodwe](https://github.com/marcelblijleven/goodwe) Python library, mapping its features to planned Node-RED node implementations. The analysis identifies all major features, supported inverter models, protocols, and API surfaces that must be ported to create a functional Node-RED integration.

**Version**: 1.0  
**Date**: 2025-10-20  
**Source Library Version**: goodwe 0.4.x  
**Target Platform**: Node-RED 3.1+  

---

## 1. Supported Inverter Models and Families

### 1.1 Inverter Families

The Python library supports multiple GoodWe inverter families, each with distinct communication protocols and sensor configurations:

| Family Code | Series Names | Models | Communication Address | Protocol Support |
|------------|--------------|---------|----------------------|------------------|
| **ET** | ET, EH, BT, BH, GEH | ET series (single/three-phase hybrid), EH series, BT series, BH series, General Electric GEH | 0xF7 (default) | UDP (AA55/ModbusRTU), Modbus TCP |
| **ES** | ES, EM, BP | ES series (hybrid storage), EM series, BP series (portable power) | 0xF7 (default) | UDP (AA55/ModbusRTU), Modbus TCP |
| **DT** | DT, MS, D-NS, XS | DT series (three-phase), MS series, D-NS series, XS series, General Electric GEP (PSB, PSC) | 0x7F (default) | UDP (AA55/ModbusRTU), Modbus TCP |

### 1.2 Model Detection

The library uses serial number prefixes to automatically detect inverter families:

- **ET Family**: Serial numbers containing specific ET/EH/BT/BH model tags
- **ES Family**: Serial numbers containing specific ES/EM/BP model tags  
- **DT Family**: Serial numbers containing specific DT/MS/NS/XS model tags

Serial number format: `[Family Tag][Model Identifier][Serial Number]`

### 1.3 White-Label Support

The library supports white-label inverters manufactured by GoodWe:
- **General Electric GEP**: PSB, PSC models (DT family)
- **General Electric GEH**: Various models (ET family)

---

## 2. Communication Protocols

### 2.1 Protocol Overview

| Protocol | Default Port | Transport | Usage | Inverter Support |
|----------|-------------|-----------|-------|------------------|
| **UDP (AA55)** | 8899 | UDP Datagram | Legacy protocol, older inverters | ET, ES, DT (all families) |
| **UDP (ModbusRTU)** | 8899 | UDP Datagram | Modern protocol over UDP | ET, ES, DT (newer models) |
| **Modbus TCP** | 502 | TCP Stream | Standard Modbus protocol | ET, ES, DT (with LAN+WiFi dongle v2.0+) |

### 2.2 Protocol Details

#### 2.2.1 AA55 Protocol (Legacy)

**Structure:**
- Header: `AA 55 C0 7F` (client addr, inverter addr)
- Payload: Variable length command data
- Checksum: 2 bytes (plain sum of header + payload)

**Commands:**
- `01 02`: Read device info
- `01 06`: Read runtime data
- `01 09`: Read settings
- `02 39 05`: Write single register
- `02 39 0B`: Write multiple registers

**Response:**
- Header: `AA 55 7F C0` (inverted addresses)
- Response type: 2 bytes
- Length: 1 byte (payload length)
- Payload: Variable length
- Checksum: 2 bytes

#### 2.2.2 ModbusRTU over UDP

**Structure:**
- Communication address: 1 byte (0xF7 or 0x7F)
- Function code: 1 byte (0x03=read, 0x06=write, 0x10=write multiple)
- Register address: 2 bytes
- Count/Value: 2 bytes
- CRC-16: 2 bytes (Modbus flavor)

**Response:**
- Prefix: `AA 55` 
- Communication address: 1 byte
- Function code: 1 byte (or 0x80+ for errors)
- Length: 1 byte
- Data: Variable length
- CRC-16: 2 bytes

#### 2.2.3 Modbus TCP

**Structure:**
- Transaction ID: 2 bytes (sequential)
- Protocol ID: 2 bytes (0x0000)
- Length: 2 bytes
- Unit ID: 1 byte (comm_addr)
- Function code: 1 byte
- Register address: 2 bytes
- Count/Value: 2 bytes

**Response:**
- Transaction ID: 2 bytes (matching request)
- Protocol ID: 2 bytes (0x0000)
- Length: 2 bytes
- Unit ID: 1 byte
- Function code: 1 byte
- Data: Variable length

### 2.3 Protocol Selection Logic

```
IF port == 502 THEN
    Use Modbus TCP
ELSE IF port == 8899 THEN
    Try AA55 discovery command
    IF response valid THEN
        Detect family from serial number
        Use ModbusRTU over UDP (newer) or AA55 (legacy)
    ELSE
        Probe each family with specific protocol
    END IF
END IF
```

---

## 3. Discovery Mechanisms

### 3.1 Network Discovery (Broadcast)

**Function**: `search_inverters()`

**Method**:
- Broadcast UDP packet to `255.255.255.255:48899`
- Payload: `WIFIKIT-214028-READ` (ASCII string)
- Response includes inverter IP address and basic info

**Returns**: Raw response bytes containing:
- Inverter IP address
- MAC address
- Inverter model
- Serial number

### 3.2 Direct Discovery

**Function**: `discover(host, port, timeout, retries)`

**Method**:
1. Try AA55 discovery command first: `AA55C07F0102000241`
2. Parse response to extract model name and serial number
3. Match serial number against family tags to determine inverter type
4. If AA55 fails, probe each family (ET, DT, ES) sequentially

**Returns**: Initialized `Inverter` instance

### 3.3 Direct Connection

**Function**: `connect(host, port, family, comm_addr, timeout, retries, do_discover)`

**Method**:
- If family specified: Create specific inverter instance (ET/ES/DT)
- If family not specified: Run discovery
- Read device info to validate connection
- Return initialized inverter instance

---

## 4. Runtime Sensor Data

### 4.1 Data Retrieval API

**Primary Method**: `inverter.read_runtime_data() -> dict[str, Any]`

**Process**:
1. Send protocol-specific read command for runtime data registers
2. Parse response bytes according to sensor definitions
3. Return dictionary mapping sensor IDs to values

**Alternative Method**: `inverter.read_sensor(sensor_id: str) -> Any`
- Read single sensor value (may require full data fetch internally)

### 4.2 Sensor Definitions

**Access**: `inverter.sensors() -> tuple[Sensor, ...]`

Each sensor has:
- `id_`: Unique string identifier (e.g., "vpv1", "ppv1", "battery_soc")
- `offset`: Register offset where data starts
- `name`: Human-readable name (e.g., "PV1 Voltage")
- `size_`: Data size in bytes (1, 2, 4, or 8)
- `unit`: Measurement unit (e.g., "V", "A", "W", "kWh", "°C", "%")
- `kind`: Sensor category (PV, AC, UPS, BAT, GRID, BMS)

### 4.3 Sensor Types and Data Encoding

| Sensor Type | Size | Encoding | Unit | Example |
|-------------|------|----------|------|---------|
| **Voltage** | 2 bytes | Unsigned int / 10 | V | PV voltage, battery voltage |
| **Current** | 2 bytes | Unsigned/Signed int / 10 | A | PV current, battery current |
| **Power** | 2/4 bytes | Unsigned/Signed int | W | Active power |
| **Energy** | 2/4/8 bytes | Unsigned int / 10 or 100 | kWh | Total energy, daily energy |
| **Frequency** | 2 bytes | Signed int / 100 | Hz | Grid frequency |
| **Temperature** | 2 bytes | Signed int / 10 | °C | Inverter temperature |
| **Percentage** | 1/2 bytes | Unsigned int | % | Battery SoC, efficiency |
| **Apparent Power** | 2/4 bytes | Signed int | VA | Apparent power |
| **Reactive Power** | 2/4 bytes | Signed int | var | Reactive power |
| **Enum** | 1/2 bytes | Mapping to labels | - | Status, mode, error codes |
| **Timestamp** | 6 bytes | YY/MM/DD HH:MM:SS | - | Last update time |
| **Bitmap** | 2/4 bytes | Bit flags to labels | - | Error/warning flags |

### 4.4 Sensor Categories (SensorKind)

- **PV**: Solar panel data (voltage, current, power from strings)
- **AC**: Grid-connected AC output (voltage, current, power, frequency)
- **UPS**: Backup/EPS/off-grid output
- **BAT**: Battery data (voltage, current, SoC, temperature)
- **GRID**: Smart meter data (import/export power)
- **BMS**: Battery Management System direct data

### 4.5 Family-Specific Sensor Counts

Approximate sensor counts per family (varies by model):

| Family | Runtime Sensors | Settings | Total Registers |
|--------|----------------|----------|-----------------|
| **ET** | 100-150 | 50-80 | 200+ |
| **ES** | 80-120 | 40-60 | 150+ |
| **DT** | 60-100 | 30-50 | 120+ |

---

## 5. Configuration Read/Write Operations

### 5.1 Configuration API

**Read Operations**:
- `inverter.read_settings_data() -> dict[str, Any]`: Read all settings
- `inverter.read_setting(setting_id: str) -> Any`: Read single setting

**Write Operations**:
- `inverter.write_setting(setting_id: str, value: Any)`: Write single setting
- **WARNING**: Modifies installer-level parameters, use with caution

**Settings Access**: `inverter.settings() -> tuple[Sensor, ...]`

### 5.2 Common Configuration Parameters

| Setting Category | Examples | Read/Write | Safety Level |
|------------------|----------|------------|--------------|
| **Operation Mode** | General, Off-Grid, Backup, Eco, Peak-Shaving | R/W | High risk |
| **Battery Management** | DoD (Depth of Discharge), SoC limits | R/W | High risk |
| **Grid Control** | Export limit, frequency limits | R/W | High risk |
| **Time Schedules** | Eco mode schedules, charge/discharge times | R/W | Medium risk |
| **Display Settings** | Language, brightness | R/W | Low risk |
| **System Info** | Rated power, firmware versions | R/O | Safe |

### 5.3 Specialized Configuration APIs

#### 5.3.1 Grid Export Limit
```python
get_grid_export_limit() -> int  # Returns limit in W
set_grid_export_limit(export_limit: int)  # Sets limit in W
```

#### 5.3.2 Operation Mode
```python
get_operation_modes(include_emulated: bool) -> tuple[OperationMode, ...]
get_operation_mode() -> OperationMode
set_operation_mode(operation_mode: OperationMode, eco_mode_power: int, eco_mode_soc: int)
```

**Operation Modes**:
- GENERAL (0): General mode
- OFF_GRID (1): Off-grid mode
- BACKUP (2): Backup mode
- ECO (3): Eco mode with schedules
- PEAK_SHAVING (4): Peak shaving mode
- SELF_USE (5): Self-use mode
- ECO_CHARGE (98): Emulated 24/7 charging
- ECO_DISCHARGE (99): Emulated 24/7 discharging

#### 5.3.3 Battery Depth of Discharge (DoD)
```python
get_ongrid_battery_dod() -> int  # Returns DoD in % (0-89)
set_ongrid_battery_dod(dod: int)  # Sets DoD in % (0-89)
```

### 5.4 Schedule Management

**Eco Mode Schedules**: Time-based charge/discharge schedules
- Start time (HH:MM)
- End time (HH:MM)
- Days of week (bitmap)
- Power setting (% or W)
- SoC setting (%)
- On/Off state

**Encoding**: 8 bytes (v1) or 12 bytes (v2) per schedule group

---

## 6. Error Handling and Reconnection Logic

### 6.1 Exception Hierarchy

```
InverterError (base exception)
├── RequestFailedException
│   ├── Attributes: message, consecutive_failures_count
│   └── Raised when: No valid response after retries
├── RequestRejectedException
│   ├── Attributes: message
│   └── Raised when: Inverter rejects request (protocol exception)
├── PartialResponseException
│   ├── Attributes: length, expected
│   └── Raised when: Fragmented response received
└── MaxRetriesException
    └── Raised when: Maximum retry count exceeded
```

### 6.2 Retry Mechanism

**Configuration Parameters**:
- `timeout`: Seconds to wait for response (default: 1)
- `retries`: Number of retry attempts (default: 3 for UDP, 0 for TCP)

**Retry Logic**:
1. Send request via transport
2. Start timeout timer
3. If no response before timeout:
   - Cancel future
   - Increment retry counter
   - If retries < max_retries: Retry from step 1
   - Else: Raise MaxRetriesException
4. If response invalid:
   - Log invalid response
   - Retry (same logic as timeout)
5. If protocol exception received:
   - Raise RequestRejectedException immediately

### 6.3 Connection Management

**Keep-Alive Mode**:
- UDP: Connection stays open between requests (datagram transport)
- TCP: Socket stays open with TCP keep-alive (configurable)
  - SO_KEEPALIVE: enabled
  - TCP_KEEPIDLE: 10 seconds
  - TCP_KEEPINTVL: 10 seconds
  - TCP_KEEPCNT: 3 attempts

**Connection Lifecycle**:
```python
protocol.keep_alive = True/False  # Enable/disable keep-alive
await protocol.close()  # Explicit connection close
```

### 6.4 Fragmented Response Handling

UDP responses may be fragmented. The library handles this by:
1. Detect partial response (PartialResponseException)
2. Store partial data
3. Wait for remaining fragment(s)
4. Compose complete response
5. Validate and process

### 6.5 Thread Safety

**Asyncio Lock Mechanism**:
- Each protocol instance has an asyncio.Lock
- Lock ensures sequential request processing
- Lock created per event loop (supports multiple asyncio.run() calls)
- Lock released after response received or error

---

## 7. Device Information Retrieval

### 7.1 Device Info API

**Method**: `inverter.read_device_info()`

**Populates**:
- `model_name`: Inverter model name
- `serial_number`: Inverter serial number
- `rated_power`: Rated power in W
- `firmware`: Firmware version string
- `arm_firmware`: ARM firmware version
- `modbus_version`: Modbus protocol version
- `dsp1_version`: DSP1 firmware version
- `dsp2_version`: DSP2 firmware version
- `dsp_svn_version`: DSP SVN version
- `arm_version`: ARM version number
- `arm_svn_version`: ARM SVN version
- `ac_output_type`: AC output type identifier

### 7.2 Version Information Format

Firmware versions typically encoded as:
- String format: "V1.2.3" or similar
- Binary format: Major/Minor/Patch in separate registers
- SVN version: Subversion repository version number

---

## 8. Protocol Command Structure

### 8.1 Command Classes

| Command Class | Purpose | Protocol | Methods |
|--------------|---------|----------|---------|
| **ProtocolCommand** | Base command | All | `execute()`, `request_bytes()`, `trim_response()` |
| **Aa55ProtocolCommand** | AA55 protocol | UDP | Legacy command structure |
| **Aa55ReadCommand** | Read registers | UDP | ModbusRTU-style read over AA55 |
| **Aa55WriteCommand** | Write register | UDP | Single register write |
| **Aa55WriteMultiCommand** | Write registers | UDP | Multiple register write |
| **ModbusRtuReadCommand** | Read registers | UDP | ModbusRTU read function (0x03) |
| **ModbusRtuWriteCommand** | Write register | UDP | ModbusRTU write function (0x06) |
| **ModbusRtuWriteMultiCommand** | Write registers | UDP | ModbusRTU write multi function (0x10) |
| **ModbusTcpReadCommand** | Read registers | TCP | Modbus TCP read |
| **ModbusTcpWriteCommand** | Write register | TCP | Modbus TCP write |
| **ModbusTcpWriteMultiCommand** | Write registers | TCP | Modbus TCP write multi |

### 8.2 Command Execution Flow

```
1. Create command instance with parameters
2. Call command.execute(protocol)
3. Protocol converts to request bytes
4. Send request via transport (UDP/TCP)
5. Wait for response with timeout/retries
6. Validate response
7. Trim headers/checksums from response
8. Return ProtocolResponse wrapper
```

---

## 9. Limitations and Protocol Specifics

### 9.1 Known Limitations

1. **Firmware Requirements**:
   - Old ARM firmware versions may not support UDP communication
   - Users must upgrade ARM firmware (not just inverter firmware)

2. **Protocol Compatibility**:
   - AA55 protocol: Older inverters only
   - ModbusRTU over UDP: Most modern inverters
   - Modbus TCP: Requires LAN+WiFi dongle v2.0+ (model WLA0000-01-00P)

3. **Network Requirements**:
   - Inverter must be on same local network
   - Must be reachable via SolarGo/PvMaster app over Wi-Fi (not Bluetooth)

4. **Write Operation Risks**:
   - Settings writes are installer-level operations
   - Incorrect values can damage equipment or void warranty
   - No built-in validation beyond range checks

5. **Communication Reliability**:
   - UDP inherently unreliable (packets can be lost)
   - TCP more reliable but requires newer hardware
   - Network congestion affects response times

### 9.2 Protocol-Specific Behaviors

**UDP (8899)**:
- Stateless communication
- Each request independent
- No connection establishment
- Fast but unreliable
- Requires retry logic

**Modbus TCP (502)**:
- Stateful connection
- Connection establishment overhead
- More reliable delivery
- Better for high-frequency polling
- Keep-alive recommended

### 9.3 Performance Considerations

**Polling Frequency**:
- Recommended: 5-10 seconds minimum
- Faster polling may overload inverter
- Consider inverter's processing capacity

**Concurrent Requests**:
- Use lock mechanism (one request at a time)
- Queue requests rather than parallel execution
- Prevents transport conflicts

**Memory Usage**:
- Each sensor ~100 bytes
- Full runtime data ~15-30 KB
- Settings data ~10-20 KB

---

## 10. Node-RED Feature Mapping

### 10.1 Node Configuration Properties

| Python Parameter | Node-RED Config | Type | Default | Description |
|------------------|----------------|------|---------|-------------|
| `host` | `host` | string | - | Inverter IP address |
| `port` | `port` | number | 8899 | Communication port |
| `family` | `family` | select | auto | Inverter family (ET/ES/DT) |
| `comm_addr` | `commAddr` | number | auto | Communication address |
| `timeout` | `timeout` | number | 1 | Response timeout (seconds) |
| `retries` | `retries` | number | 3 | Retry attempts |

### 10.2 Node Input Messages

**Message Payload Structure**:

```javascript
// Trigger runtime data read
msg.payload = "read" | { command: "read" }

// Trigger discovery
msg.payload = "discover" | { command: "discover" }

// Read specific sensor
msg.payload = { command: "read_sensor", sensor_id: "vpv1" }

// Read all settings
msg.payload = { command: "read_settings" }

// Read specific setting
msg.payload = { command: "read_setting", setting_id: "grid_export_limit" }

// Write setting (DANGEROUS)
msg.payload = { 
    command: "write_setting", 
    setting_id: "grid_export_limit", 
    value: 5000 
}

// Get device info
msg.payload = { command: "device_info" }

// Low-level command
msg.payload = { 
    command: "send_command", 
    data: "AA55C07F..." // hex string
}
```

### 10.3 Node Output Messages

**Success Response Structure**:

```javascript
msg.payload = {
    success: true,
    command: "read",
    timestamp: "2025-10-20T21:09:39.020Z",
    data: {
        vpv1: 245.5,        // PV1 voltage (V)
        ipv1: 6.2,          // PV1 current (A)
        ppv1: 1522,         // PV1 power (W)
        battery_soc: 87,    // Battery SoC (%)
        // ... more sensors
    },
    deviceInfo: {
        model: "GW5000-EH",
        serialNumber: "ETxxxxxxxx",
        firmware: "V1.2.3"
    }
}

msg.topic = "goodwe/inverter"
```

**Error Response Structure**:

```javascript
msg.payload = {
    success: false,
    command: "read",
    error: "Connection timeout",
    errorType: "RequestFailedException",
    consecutiveFailures: 3,
    timestamp: "2025-10-20T21:09:39.020Z"
}

msg.topic = "goodwe/error"
```

### 10.4 Node Status Indicators

| Status | Fill | Shape | Text |
|--------|------|-------|------|
| Disconnected | grey | ring | "disconnected" |
| Connecting | yellow | ring | "connecting..." |
| Connected | green | dot | "connected" |
| Reading | blue | dot | "reading data..." |
| Error | red | ring | "error: [message]" |
| Consecutive Failures | orange | dot | "failures: N" |

### 10.5 Sensor Data Output Format

**Option 1: Flat Structure** (default)
```javascript
{
    vpv1: 245.5,
    vpv2: 240.2,
    ipv1: 6.2,
    ppv1: 1522,
    battery_soc: 87
    // ... all sensors
}
```

**Option 2: Categorized Structure**
```javascript
{
    pv: {
        vpv1: 245.5,
        ipv1: 6.2,
        ppv1: 1522
    },
    battery: {
        voltage: 51.2,
        current: -5.5,
        soc: 87,
        temperature: 23.5
    },
    grid: {
        voltage: 230.5,
        frequency: 50.02
    }
}
```

**Option 3: Array with Metadata**
```javascript
[
    {
        id: "vpv1",
        name: "PV1 Voltage",
        value: 245.5,
        unit: "V",
        kind: "PV"
    },
    // ... all sensors
]
```

### 10.6 Node-RED Node Types

**Primary Node**: `goodwe` (combined read/write node)

**Potential Future Nodes**:
- `discover`: Discovery-only node
- `sensor`: Single sensor monitor
- `config`: Configuration node (shared connection)

---

## 11. Public API Surface for Node-RED

### 11.1 Required Core APIs

**Connection Management**:
```javascript
connect(host, port, family, commAddr, timeout, retries)
discover(host, port, timeout, retries)
searchInverters()  // Broadcast discovery
close()
```

**Data Retrieval**:
```javascript
readRuntimeData() -> Promise<object>
readSensor(sensorId) -> Promise<any>
getSensors() -> Array<SensorDefinition>
readDeviceInfo() -> Promise<DeviceInfo>
```

**Configuration**:
```javascript
readSettingsData() -> Promise<object>
readSetting(settingId) -> Promise<any>
writeSetting(settingId, value) -> Promise<void>
getSettings() -> Array<SettingDefinition>
```

**Specialized APIs**:
```javascript
getGridExportLimit() -> Promise<number>
setGridExportLimit(limit) -> Promise<void>
getOperationMode() -> Promise<string>
setOperationMode(mode, power, soc) -> Promise<void>
getOnGridBatteryDoD() -> Promise<number>
setOnGridBatteryDoD(dod) -> Promise<void>
```

**Low-Level**:
```javascript
sendCommand(commandBytes) -> Promise<Buffer>
```

### 11.2 Data Type Definitions

**SensorDefinition**:
```typescript
interface SensorDefinition {
    id: string;           // "vpv1"
    offset: number;       // Register offset
    name: string;         // "PV1 Voltage"
    size: number;         // Bytes (1/2/4/8)
    unit: string;         // "V", "A", "W", etc.
    kind: string;         // "PV", "AC", "BAT", etc.
    encode?: (value) => Buffer;
    decode: (buffer, offset) => any;
}
```

**DeviceInfo**:
```typescript
interface DeviceInfo {
    modelName: string;
    serialNumber: string;
    ratedPower: number;
    firmware: string;
    armFirmware: string;
    modbusVersion?: number;
}
```

**InverterConfig**:
```typescript
interface InverterConfig {
    host: string;
    port: number;
    family?: string;      // "ET", "ES", "DT"
    commAddr?: number;    // 0xF7 or 0x7F
    timeout: number;
    retries: number;
    keepAlive?: boolean;
}
```

### 11.3 Event Emitters

```javascript
inverter.on('connected', (deviceInfo) => { })
inverter.on('disconnected', () => { })
inverter.on('data', (sensorData) => { })
inverter.on('error', (error) => { })
inverter.on('retry', (attempt, maxRetries) => { })
```

---

## 12. Testing and Acceptance Criteria

### 12.1 Feature Mapping Acceptance Criteria

**AC-1: Inverter Family Support**
- [ ] Library correctly identifies ET family inverters
- [ ] Library correctly identifies ES family inverters
- [ ] Library correctly identifies DT family inverters
- [ ] Library handles unknown inverter families gracefully

**AC-2: Protocol Implementation**
- [ ] UDP (AA55) protocol successfully reads data
- [ ] UDP (ModbusRTU) protocol successfully reads data
- [ ] Modbus TCP protocol successfully reads data
- [ ] Protocol auto-detection works correctly

**AC-3: Discovery**
- [ ] Network broadcast discovery finds inverters
- [ ] Direct discovery identifies inverter family
- [ ] Connect with explicit family works
- [ ] Connect with auto-detection works

**AC-4: Runtime Data**
- [ ] Read all runtime sensors successfully
- [ ] Sensor values correctly decoded (voltage, current, power, etc.)
- [ ] Sensor categories correctly identified
- [ ] Read single sensor works

**AC-5: Configuration**
- [ ] Read all settings successfully
- [ ] Write setting successfully modifies parameter
- [ ] Grid export limit read/write works
- [ ] Operation mode read/write works
- [ ] Battery DoD read/write works

**AC-6: Error Handling**
- [ ] Timeout triggers retry mechanism
- [ ] Max retries exceeded raises exception
- [ ] Invalid response handled gracefully
- [ ] Connection lost detected and reported
- [ ] Fragmented responses reassembled correctly

**AC-7: Node-RED Integration**
- [ ] Node configuration UI displays all options
- [ ] Node accepts input messages correctly
- [ ] Node outputs data in correct format
- [ ] Node status updates reflect connection state
- [ ] Node handles errors without crashing

### 12.2 Test Data Requirements

**Mock Inverter Responses**:
- Sample AA55 discovery response
- Sample ModbusRTU runtime data response
- Sample Modbus TCP settings response
- Sample error/exception responses
- Sample fragmented responses

**Test Inverter Configurations**:
- ET family test cases
- ES family test cases
- DT family test cases
- Various firmware versions
- White-label models

### 12.3 Unit Test Coverage

**Minimum Coverage**: 70%

**Critical Paths**:
- Protocol encoding/decoding: 100%
- Sensor data parsing: 95%
- Error handling: 90%
- Connection management: 85%

---

## 13. Implementation Priority Matrix

### 13.1 Must-Have (MVP) Features

| Feature | Priority | Complexity | Dependencies |
|---------|----------|------------|--------------|
| UDP connection (8899) | P0 | Medium | None |
| ET family support | P0 | High | UDP connection |
| Basic runtime data read | P0 | High | Family support |
| Device info read | P0 | Low | UDP connection |
| Error handling | P0 | Medium | All |
| Node-RED node UI | P0 | Low | None |
| Basic status indicators | P0 | Low | Node UI |

### 13.2 Should-Have Features

| Feature | Priority | Complexity | Dependencies |
|---------|----------|------------|--------------|
| ES family support | P1 | Medium | ET family |
| DT family support | P1 | Medium | ET family |
| Modbus TCP support | P1 | Medium | UDP support |
| Auto-detection | P1 | Low | All families |
| Network discovery | P1 | Low | UDP connection |
| Configuration read | P1 | High | Runtime data |
| Retry mechanism | P1 | Medium | Connection |

### 13.3 Nice-to-Have Features

| Feature | Priority | Complexity | Dependencies |
|---------|----------|------------|--------------|
| Configuration write | P2 | High | Config read |
| Operation mode control | P2 | Medium | Config write |
| Grid export limit control | P2 | Low | Config write |
| Battery DoD control | P2 | Low | Config write |
| Keep-alive mode | P2 | Low | Connection |
| Single sensor read | P2 | Low | Runtime data |
| Low-level commands | P2 | Low | Connection |

### 13.4 Future Features

| Feature | Priority | Complexity | Dependencies |
|---------|----------|------------|--------------|
| Multiple inverter support | P3 | High | MVP |
| Data caching | P3 | Medium | Runtime data |
| Historical data logging | P3 | High | Data caching |
| Dashboard widgets | P3 | Medium | Node-RED |
| Alarm notifications | P3 | Low | Error handling |
| Schedule management UI | P3 | Very High | Config write |

---

## 14. Dependencies and NPM Packages

### 14.1 Required Dependencies

**None** - The Python library uses only standard library for core functionality:
- `asyncio`: Async I/O (Node.js native: async/await)
- `socket`: UDP/TCP sockets (Node.js native: `dgram`, `net`)
- `struct`: Binary data packing (Node.js native: `Buffer`)
- `logging`: Logging (Node.js: `console` or winston/pino)

### 14.2 Optional Dependencies

For Node-RED implementation, consider:
- **CRC calculation**: Built-in or use `crc` package
- **Modbus TCP**: Pure implementation or `jsmodbus` package
- **Testing**: Jest (already included)
- **Type checking**: TypeScript definitions (optional)

### 14.3 No External Protocol Libraries Needed

The Python library implements all protocols from scratch. This approach:
- ✅ Provides complete control over protocol details
- ✅ Minimizes external dependencies
- ✅ Simplifies debugging and maintenance
- ✅ Enables protocol-specific optimizations

The Node-RED port should follow the same pattern.

---

## 15. Migration Path and Backward Compatibility

### 15.1 Python Library Versions

**Target Version**: 0.4.x (latest)

**Version History**:
- v0.1-0.3: Early versions with AA55 protocol only
- v0.4.x: Added Modbus TCP support, refined API

### 15.2 Protocol Compatibility

The Node-RED implementation should support:
- AA55 protocol: For backward compatibility with old inverters
- ModbusRTU over UDP: For modern inverters
- Modbus TCP: For newest dongles

### 15.3 API Evolution

As the Python library evolves, the Node-RED port should:
- Track major version releases
- Adopt new features incrementally
- Maintain compatibility with common inverter models
- Document breaking changes clearly

---

## 16. Security Considerations

### 16.1 Network Security

**Risks**:
- Inverter communication not encrypted
- No authentication mechanism
- Plain-text commands visible on network

**Mitigations**:
- Use local network only (never expose to internet)
- Implement rate limiting for write operations
- Log all configuration changes
- Provide user warnings for dangerous operations

### 16.2 Write Operation Safety

**Protection Mechanisms**:
- Require explicit user confirmation for writes
- Validate parameter ranges before sending
- Implement undo/restore capability where possible
- Provide dry-run mode for testing

**User Education**:
- Document risks clearly in node help
- Provide examples of safe vs. dangerous operations
- Link to inverter manual for parameter meanings

---

## 17. Documentation Requirements

### 17.1 User Documentation

- **Quick Start Guide**: Basic setup and first read
- **Configuration Guide**: All node configuration options
- **Sensor Reference**: List of all sensors per family
- **Settings Reference**: List of all settings per family
- **Examples**: Common use cases with flows
- **Troubleshooting**: Common errors and solutions
- **FAQ**: Frequently asked questions

### 17.2 Developer Documentation

- **Architecture**: System design and components
- **Protocol Specification**: Detailed protocol docs
- **API Reference**: All classes and methods
- **Testing Guide**: How to run and write tests
- **Contributing Guide**: How to contribute
- **Changelog**: Version history

### 17.3 Inline Documentation

- JSDoc comments for all public APIs
- Inline comments for complex logic
- Protocol command documentation
- Error code explanations

---

## 18. Conclusion

### 18.1 Summary

The marcelblijleven/goodwe Python library provides a comprehensive solution for communicating with GoodWe inverters. The library's architecture is well-suited for porting to Node.js/Node-RED:

**Strengths**:
- ✅ Clean separation of protocols
- ✅ Comprehensive sensor definitions
- ✅ Robust error handling
- ✅ Extensive family support
- ✅ No external dependencies for core functionality

**Challenges**:
- ⚠️ Complex binary protocol parsing
- ⚠️ Multiple protocol variants to support
- ⚠️ Large sensor definition sets
- ⚠️ Safety concerns with write operations

### 18.2 Recommended Implementation Approach

1. **Phase 1**: Core connectivity (UDP, ET family, basic read)
2. **Phase 2**: Additional families (ES, DT) and protocols (Modbus TCP)
3. **Phase 3**: Configuration operations (read then write)
4. **Phase 4**: Advanced features (discovery, specialized APIs)

### 18.3 Success Metrics

- ✅ All major inverter families supported
- ✅ All communication protocols implemented
- ✅ Runtime data retrieval functional
- ✅ Configuration read operational
- ✅ Error handling robust
- ✅ Test coverage >70%
- ✅ Documentation complete

---

## Appendices

### Appendix A: Protocol Examples

#### A.1 AA55 Discovery Command
```
Request:  AA55C07F0102000241
Response: AA55 7F C0 0182 [length] [model_name] [serial_number] [checksum]
```

#### A.2 ModbusRTU Read Runtime Data
```
Request:  F7 03 [offset] [count] [CRC16]
Response: AA55 F7 03 [length] [data...] [CRC16]
```

#### A.3 Modbus TCP Read Registers
```
Request:  [TxID] 0000 [length] F7 03 [offset] [count]
Response: [TxID] 0000 [length] F7 03 [data_length] [data...]
```

### Appendix B: Sensor ID Examples

**ET Family Common Sensors**:
- `vpv1`, `vpv2`, `vpv3`, `vpv4`: PV string voltages
- `ipv1`, `ipv2`, `ipv3`, `ipv4`: PV string currents
- `ppv1`, `ppv2`, `ppv3`, `ppv4`: PV string powers
- `vgrid`, `igrid`, `fgrid`: Grid voltage, current, frequency
- `battery_voltage`, `battery_current`, `battery_soc`: Battery data
- `e_day`, `e_total`: Daily and total energy

### Appendix C: Error Code Mappings

Common error codes from inverter responses:
- `0x01`: Illegal function
- `0x02`: Illegal data address
- `0x03`: Illegal data value
- `0x04`: Slave device failure

### Appendix D: References

- [GoodWe Python Library GitHub](https://github.com/marcelblijleven/goodwe)
- [GoodWe Python Library PyPI](https://pypi.org/project/goodwe/)
- [Modbus Protocol Specification](https://modbus.org/specs.php)
- [Node-RED Creating Nodes Guide](https://nodered.org/docs/creating-nodes/)
- [Home Assistant GoodWe Integration](https://github.com/mletenay/home-assistant-goodwe-inverter)

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-20  
**Author**: GitHub Copilot  
**Review Status**: ✅ Ready for Implementation
