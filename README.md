# node-red-contrib-goodwe

[![CI](https://github.com/pkot/node-red-contrib-goodwe/actions/workflows/ci.yml/badge.svg)](https://github.com/pkot/node-red-contrib-goodwe/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/node-red-contrib-goodwe.svg)](https://www.npmjs.com/package/node-red-contrib-goodwe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node-RED node for connecting to GoodWe inverters over local network and retrieving runtime sensor values and configuration parameters.

This project is a Node-RED port of the excellent [marcelblijleven/goodwe](https://github.com/marcelblijleven/goodwe) Python library.

## Features

- 🔌 Connect to GoodWe inverters over local network (UDP or Modbus TCP)
- 📊 Read runtime sensor values (power generation, voltage, current, etc.)
- 🔍 Inverter discovery on local network
- 🎯 Support for multiple inverter families (ET, EH, BT, BH, ES, EM, BP, DT, MS, D-NS, XS)
- ⚡ Asynchronous communication with proper error handling
- 🎨 User-friendly Node-RED configuration interface
- 🔧 Shared configuration nodes for managing multiple inverters
- ♻️ Connection pooling and lifecycle management

## Installation

### Via npm (recommended)

```bash
npm install node-red-contrib-goodwe
```

### Via Node-RED Palette Manager

1. Open Node-RED editor
2. Go to Menu → Manage palette
3. Select the "Install" tab
4. Search for `node-red-contrib-goodwe`
5. Click Install

### Manual Installation

```bash
cd ~/.node-red
npm install node-red-contrib-goodwe
```

## Usage

### Configuration

The GoodWe node requires a configuration node to define connection settings.

1. Create a configuration node:
   - In the Node-RED editor, add a **goodwe** node to your flow
   - In the node settings, click the pencil icon next to **Configuration** to create a new config node
   - Configure the connection settings (host, port, protocol, family)
   - Click **Add** to save the configuration node

2. Reuse the configuration:
   - Additional **goodwe** nodes can reference the same configuration node
   - Changes to the config node automatically apply to all nodes using it

**Benefits:**
- ✅ Eliminates configuration duplication
- ✅ Single point of truth for connection settings
- ✅ Easier to manage multiple inverters
- ✅ Centralized connection lifecycle management

### Available Nodes

This package provides the following Node-RED nodes:

- **goodwe-config** - Configuration node for inverter connection settings (shared across other nodes)
- **goodwe-read** - Read runtime sensor data with multiple output formats and auto-polling
- **goodwe-info** - Retrieve device identification and firmware information
- **goodwe-discover** - Discover GoodWe inverters on the local network via UDP broadcast
- **goodwe** - Legacy unified node (deprecated, use the dedicated nodes above)

### Configuration Node Settings

The configuration node allows you to configure:

**Basic Settings:**
- **Name**: Friendly name to identify this configuration
- **Host**: IP address or hostname of the inverter (required)
- **Protocol**: UDP or Modbus TCP
- **Port**: Communication port (8899 for UDP, 502 for Modbus)
- **Inverter Family**: Your inverter series (ET, EH, BT, etc.)

**Advanced Settings** (click to expand):
- **Timeout**: Response timeout in milliseconds (default: 1000ms, minimum: 100ms)
- **Retries**: Number of retry attempts (default: 3, minimum: 0)
- **Comm Address**: Communication address (auto, 0xF7, or 0x7F)
- **Keep Alive**: Keep connection alive between requests (default: true)

### Read Node (goodwe-read)

The dedicated read node provides an optimized interface for reading runtime sensor data with support for multiple output formats and auto-polling.

**Node Settings:**
- **Name**: Node display name
- **Configuration**: Reference to a goodwe-config node (required)
- **Output Format**: Data format for output
  - **Flat** (default) - Simple object with sensor values
  - **Categorized** - Grouped by category (pv, battery, grid, energy, status)
  - **Array** - Array of objects with metadata (id, name, value, unit, kind)
- **Polling**: Auto-polling interval in seconds (0 = disabled)

**Input Messages:**

Read all sensors:
```javascript
msg.payload = true;  // or any value
```

Read specific sensor:
```javascript
msg.payload = { sensor_id: "vpv1" };
```

Read multiple sensors:
```javascript
msg.payload = { sensors: ["vpv1", "vpv2", "vbattery1"] };
```

**Output Examples:**

Flat format (default):
```javascript
{
    payload: {
        vpv1: 245.5,
        ipv1: 6.2,
        battery_soc: 87,
        // ... more sensors
    },
    topic: "goodwe/runtime_data",
    _timestamp: "2025-11-02T...",
    _inverter: { family: "ET", host: "192.168.1.100" }
}
```

Categorized format:
```javascript
{
    payload: {
        pv: { vpv1: 245.5, ipv1: 6.2, ppv1: 1522, e_day: 15.2, e_total: 4523.8 },
        battery: { vbattery1: 51.2, ibattery1: -5.0, pbattery1: -256 },
        grid: { vgrid: 230.5, igrid: 12.4, total_inverter_power: 2875 },
        status: { temperature: 42.5, work_mode: 1 }
    },
    topic: "goodwe/runtime_data",
    // ... metadata
}
```

Array format (with metadata):
```javascript
{
    payload: [
        { id: "vpv1", name: "PV1 Voltage", value: 245.5, unit: "V", kind: "PV" },
        { id: "vbattery1", name: "Battery Voltage", value: 51.2, unit: "V", kind: "BAT" }
        // ... all sensors
    ],
    topic: "goodwe/runtime_data",
    // ... metadata
}
```

**Use Cases:**
- **Flat Format**: Simple dashboards, direct sensor access
- **Categorized Format**: Organized displays, grouped gauges
- **Array Format**: Dynamic UIs, tables, charts with metadata

### Info Node (goodwe-info)

The info node retrieves device identification and firmware information from the inverter.

**Node Settings:**
- **Name**: Node display name
- **Configuration**: Reference to a goodwe-config node (required)

**Input:** Any message triggers device info retrieval.

**Output:**
```javascript
{
    payload: {
        model_name: "GW5000-EH",
        serial_number: "95027EST123A0001",
        firmware: "V2.01",
        arm_firmware: "V2.01",
        dsp1_version: "V1.14",
        dsp2_version: "V1.14",
        rated_power: 5000,
        ac_output_type: 0,
        family: "ET"
    },
    topic: "goodwe/device_info",
    _timestamp: "2025-11-02T...",
    _inverter: { family: "ET", host: "192.168.1.100" }
}
```

### Discover Node (goodwe-discover)

The discover node finds GoodWe inverters on the local network using UDP broadcast.

**Node Settings:**
- **Name**: Node display name
- **Timeout**: Discovery timeout in milliseconds (default: 5000)
- **Broadcast Address**: Network broadcast address (default: 255.255.255.255)

**Input:** Any message triggers discovery.

**Output:**
```javascript
{
    payload: {
        devices: [
            {
                host: "192.168.1.100",
                port: 8899,
                model: "GW5000-EH",
                serial: "ETxxxxxxxx",
                family: "ET",
                protocol: "udp"
            }
        ],
        count: 1
    },
    topic: "goodwe/discover",
    _timestamp: "2025-11-02T..."
}
```

### Error Handling

All nodes provide enhanced error messages with actionable suggestions:

```javascript
{
    message: "Response timeout",
    code: "TIMEOUT",
    details: { host: "192.168.1.100", port: 8899, protocol: "udp", family: "ET" },
    suggestions: [
        "Verify inverter at 192.168.1.100 is powered on",
        "Check network connection to inverter",
        "Ensure inverter is on the same network segment",
        "Try increasing timeout above 1000ms in configuration"
    ]
}
```

### Example Flows

#### Example 1: Basic Read with Auto-Polling

Using the dedicated read node with auto-polling enabled:

```json
[
    {
        "id": "config-node",
        "type": "goodwe-config",
        "name": "Living Room Inverter",
        "host": "192.168.1.100",
        "port": "8899",
        "protocol": "udp",
        "family": "ET"
    },
    {
        "id": "read-node",
        "type": "goodwe-read",
        "name": "Read Inverter Data",
        "config": "config-node",
        "outputFormat": "flat",
        "polling": 60,
        "wires": [["debug-node"]]
    },
    {
        "id": "debug-node",
        "type": "debug",
        "name": "Show Data"
    }
]
```

#### Example 2: Read with Categorized Output

Using categorized format for organized dashboards:

```json
[
    {
        "id": "config-node",
        "type": "goodwe-config",
        "name": "Living Room Inverter",
        "host": "192.168.1.100",
        "port": "8899",
        "protocol": "udp",
        "family": "ET"
    },
    {
        "id": "inject-node",
        "type": "inject",
        "name": "Read Data",
        "payload": "true",
        "wires": [["read-node"]]
    },
    {
        "id": "read-node",
        "type": "goodwe-read",
        "name": "Read Categorized",
        "config": "config-node",
        "outputFormat": "categorized",
        "polling": 0,
        "wires": [["debug-node"]]
    },
    {
        "id": "debug-node",
        "type": "debug",
        "name": "Show Data"
    }
]
```

#### Example 3: Read Specific Sensors

Reading only specific sensors using array format:

```json
[
    {
        "id": "config-node",
        "type": "goodwe-config",
        "name": "Living Room Inverter",
        "host": "192.168.1.100",
        "port": "8899",
        "protocol": "udp",
        "family": "ET"
    },
    {
        "id": "inject-node",
        "type": "inject",
        "name": "Read Specific",
        "payload": "{\"sensors\":[\"vpv1\",\"battery_soc\",\"pac\"]}",
        "payloadType": "json",
        "wires": [["read-node"]]
    },
    {
        "id": "read-node",
        "type": "goodwe-read",
        "name": "Read Specific Sensors",
        "config": "config-node",
        "outputFormat": "array",
        "polling": 0,
        "wires": [["debug-node"]]
    },
    {
        "id": "debug-node",
        "type": "debug",
        "name": "Show Data"
    }
]
```

#### Example 4: Legacy Unified Node (Basic Usage)

```json
[
    {
        "id": "config-node",
        "type": "goodwe-config",
        "name": "Living Room Inverter",
        "host": "192.168.1.100",
        "port": "8899",
        "protocol": "udp",
        "family": "ET",
        "timeout": 1000,
        "retries": 3
    },
    {
        "id": "inject-node",
        "type": "inject",
        "name": "Read every 60s",
        "repeat": "60",
        "payload": "read",
        "wires": [["goodwe-node"]]
    },
    {
        "id": "goodwe-node",
        "type": "goodwe",
        "name": "Read Inverter",
        "config": "config-node",
        "wires": [["debug-node"]]
    },
    {
        "id": "debug-node",
        "type": "debug",
        "name": "Show Data"
    }
]
```

#### Example 5: Legacy Unified Node (Multiple Nodes Sharing Configuration)

```json
[
    {
        "id": "config-node",
        "type": "goodwe-config",
        "name": "Shared Inverter Config",
        "host": "192.168.1.100",
        "port": "8899",
        "protocol": "udp",
        "family": "ET"
    },
    {
        "id": "inject-read",
        "type": "inject",
        "name": "Read Data",
        "repeat": "60",
        "payload": "read",
        "wires": [["goodwe-read"]]
    },
    {
        "id": "goodwe-read",
        "type": "goodwe",
        "name": "Read Runtime Data",
        "config": "config-node",
        "wires": [["debug-data"]]
    },
    {
        "id": "inject-discover",
        "type": "inject",
        "name": "Discover",
        "payload": "discover",
        "wires": [["goodwe-discover"]]
    },
    {
        "id": "goodwe-discover",
        "type": "goodwe",
        "name": "Discover Inverters",
        "config": "config-node",
        "wires": [["debug-discover"]]
    },
    {
        "id": "debug-data",
        "type": "debug",
        "name": "Runtime Data"
    },
    {
        "id": "debug-discover",
        "type": "debug",
        "name": "Discovery Results"
    }
]
```

See the [examples](./examples/) folder for more usage examples.

## Supported Inverter Families

- **ET Series**: ET, EH series
- **BT Series**: BT, BH series  
- **ES Series**: ES series
- **EM Series**: EM series
- **BP Series**: BP series
- **DT Series**: DT series (three-phase)
- **MS Series**: MS series
- **D-NS Series**: D-NS series
- **XS Series**: XS series

The node may also work with white-label inverters using the same communication protocols.

## Development

### Prerequisites

- Node.js >= 20.0.0
- npm >= 6.0.0

### Setup

```bash
git clone https://github.com/pkot/node-red-contrib-goodwe.git
cd node-red-contrib-goodwe
npm install
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- test/goodwe.test.js

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

See the **[Testing Guide](./docs/TESTING.md)** for comprehensive testing documentation, including:
- TDD workflow and best practices
- Using test utilities and mock data
- Writing tests for Node-RED nodes
- Offline development with mock inverter responses

### Project Structure

```
node-red-contrib-goodwe/
├── nodes/              # Node implementations
│   ├── config.js      # Configuration node (shared connection)
│   ├── config.html    # Configuration node UI
│   ├── read.js        # Read runtime sensor data
│   ├── read.html      # Read node UI
│   ├── info.js        # Device info retrieval
│   ├── info.html      # Info node UI
│   ├── discover.js    # Network discovery
│   ├── discover.html  # Discover node UI
│   ├── goodwe.js      # Legacy unified node
│   ├── goodwe.html    # Legacy node UI
│   └── icons/         # Node icons
├── lib/               # Shared libraries
│   ├── protocol.js    # Protocol handler (UDP/TCP/Modbus)
│   ├── sensors.js     # Per-family sensor definitions and parsers
│   ├── modbus.js      # Modbus RTU/TCP frame construction
│   ├── errors.js      # Enhanced error messages with suggestions
│   └── node-helpers.js # Shared node utilities
├── test/              # Test files (372+ tests)
├── examples/          # Example flows
├── docs/              # Documentation
├── .github/           # CI/CD workflows
├── package.json
├── jest.config.js
├── .eslintrc.json
├── LICENSE
└── README.md
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing Discipline

This project follows Test-Driven Development (TDD) practices:
- Write tests before implementing features
- Maintain high code coverage (>70%)
- All tests must pass before merging

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [marcelblijleven/goodwe](https://github.com/marcelblijleven/goodwe) - Original Python library
- [Node-RED](https://nodered.org/) - Flow-based programming platform
- GoodWe inverter community for protocol documentation

## Documentation

- **[Node Design Specification](./docs/NODE_DESIGN.md)** - Comprehensive design document for the GoodWe Node-RED node
- **[Feature Analysis Document](./docs/FEATURE_ANALYSIS.md)** - Comprehensive analysis of the Python library features mapped to Node-RED
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to this project
- **[Changelog](./CHANGELOG.md)** - Version history and changes

## References

- [GoodWe Python Library Documentation](https://github.com/marcelblijleven/goodwe)
- [Node-RED Creating Nodes Guide](https://nodered.org/docs/creating-nodes/)
- [GoodWe Inverters](https://www.goodwe.com/)

## Support

- 🐛 [Report bugs](https://github.com/pkot/node-red-contrib-goodwe/issues)
- 💡 [Request features](https://github.com/pkot/node-red-contrib-goodwe/issues)
- 📖 [Documentation](https://github.com/pkot/node-red-contrib-goodwe)

## Status

This project implements the core v1.0 feature set. See [TODO.md](./TODO.md) for completed phases and the post-v1.0 roadmap.
