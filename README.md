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

### Basic Configuration

1. Drag the **goodwe** node from the palette to your flow
2. Double-click to configure:
   - **Host**: IP address or hostname of your GoodWe inverter (e.g., `192.168.1.100`)
   - **Protocol**: Choose UDP (port 8899) or Modbus TCP (port 502)
   - **Port**: Communication port (default: 8899 for UDP, 502 for Modbus)
   - **Inverter Family**: Select your inverter series (ET, EH, BT, etc.)
3. Wire the node to an inject node for triggering reads and a debug node for output

### Example Flow

```json
[
    {
        "id": "inject-node",
        "type": "inject",
        "name": "Read inverter data",
        "repeat": "60",
        "payload": "read",
        "wires": [["goodwe-node"]]
    },
    {
        "id": "goodwe-node",
        "type": "goodwe",
        "name": "My GoodWe Inverter",
        "host": "192.168.1.100",
        "port": "8899",
        "protocol": "udp",
        "family": "ET"
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

# Run tests with coverage
npm test -- --coverage

# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

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
