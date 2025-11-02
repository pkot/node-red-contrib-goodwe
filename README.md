# node-red-contrib-goodwe

[![CI](https://github.com/pkot/node-red-contrib-goodwe/actions/workflows/ci.yml/badge.svg)](https://github.com/pkot/node-red-contrib-goodwe/actions/workflows/ci.yml)
[![npm version](https://badge.fury.io/js/node-red-contrib-goodwe.svg)](https://www.npmjs.com/package/node-red-contrib-goodwe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node-RED node for connecting to GoodWe inverters over local network and retrieving runtime sensor values and configuration parameters.

This project is a Node-RED port of the excellent [marcelblijleven/goodwe](https://github.com/marcelblijleven/goodwe) Python library.

## Features

- 🔌 Connect to GoodWe inverters over local network (UDP or Modbus TCP)
- 📊 Read runtime sensor values (power generation, voltage, current, etc.)
- ✍️ Write configuration settings (grid export limit, operation mode, etc.)
- 🔍 Inverter discovery on local network
- ℹ️ Retrieve device information (model, serial, firmware)
- 🎯 Support for multiple inverter families (ET, EH, BT, BH, ES, EM, BP, DT, MS, D-NS, XS)
- ⚡ Asynchronous communication with proper error handling
- 🎨 User-friendly Node-RED configuration interface
- 🧩 **NEW:** Specialized nodes for different operations (config, read, write, discover, info)

## Quick Start

### Using Specialized Nodes (Recommended)

The new architecture provides separate nodes for different operations:

1. **Create a config node** - Stores connection settings (shared across operations)
2. **Add operational nodes** - Choose from read, write, discover, or info nodes
3. **Connect and use** - Wire nodes together in your flow

**Example Flow:**

```
[Inject] → [goodwe-read] → [Debug]
         ↓
   [goodwe-config]
```

### Using Legacy Node

The original unified `goodwe-legacy` node is still available for backward compatibility. See [Migration Guide](docs/MIGRATION.md) for details.

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

### Configuration Node

First, create a **goodwe-config** node to store your inverter connection settings:

1. Add any operational node (read, write, info) to your flow
2. Click the pencil icon next to "Config" to create a new config node
3. Configure:
   - **Host**: IP address or hostname (e.g., `192.168.1.100`)
   - **Protocol**: UDP (port 8899) or Modbus TCP (port 502)
   - **Inverter Family**: Select your series (ET, ES, or DT)
   - **Timeout/Retries**: Advanced settings (optional)
4. Save the config node

### Reading Runtime Data

Use the **goodwe-read** node to retrieve sensor data from your inverter.

**Example Flow:**
```json
[
    {
        "id": "config1",
        "type": "goodwe-config",
        "host": "192.168.1.100",
        "port": 8899,
        "protocol": "udp",
        "family": "ET"
    },
    {
        "id": "read1",
        "type": "goodwe-read",
        "config": "config1",
        "pollingInterval": 10,
        "outputFormat": "flat",
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug"
    }
]
```

**Output:**
```json
{
    "payload": {
        "vpv1": 245.5,
        "ipv1": 6.2,
        "ppv1": 1522,
        "battery_soc": 87,
        "vgrid": 230.5,
        "e_day": 15.2,
        ...
    },
    "topic": "goodwe/runtime_data",
    "_timestamp": "2025-11-02T17:00:00.000Z",
    "_inverter": {
        "family": "ET",
        "host": "192.168.1.100"
    }
}
```

### Discovering Inverters

Use the **goodwe-discover** node to find inverters on your network.

**Example Flow:**
```json
[
    {
        "id": "inject1",
        "type": "inject",
        "once": true,
        "payload": true,
        "wires": [["discover1"]]
    },
    {
        "id": "discover1",
        "type": "goodwe-discover",
        "timeout": 5000,
        "wires": [["debug1"]]
    }
]
```

### Writing Settings

Use the **goodwe-write** node to modify inverter configuration.

⚠️ **WARNING**: Writing settings can damage your inverter or void warranty. Use with extreme caution!

**Example Flow:**
```json
msg.payload = {
    "setting_id": "grid_export_limit",
    "value": 5000
}
```

### Getting Device Info

Use the **goodwe-info** node to retrieve device information.

**Example Flow:**
```
[Inject] → [goodwe-info] → [Debug]
         ↓
   [goodwe-config]
```

**Output:**
```json
{
    "payload": {
        "model_name": "GW5000-EH",
        "serial_number": "ETxxxxxxxx",
        "rated_power": 5000,
        "firmware": "V1.2.3",
        "family": "ET"
    }
}
```

### Legacy Node

For backward compatibility, the original unified node is available as **goodwe-legacy**. See [Migration Guide](docs/MIGRATION.md) for migration instructions.

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
├── nodes/              # Node implementation
│   ├── goodwe.js      # Node runtime logic
│   ├── goodwe.html    # Node UI and help
│   └── icons/         # Node icons
├── test/              # Test files
│   └── goodwe.test.js
├── examples/          # Example flows
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

⚠️ **Note**: This project is currently under active development. Core features are being implemented. See the [implementation plan issue](https://github.com/pkot/node-red-contrib-goodwe/issues) for progress tracking.
