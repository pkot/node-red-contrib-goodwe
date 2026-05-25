# node-red-contrib-goodwe

[![CI](https://github.com/pkot/node-red-contrib-goodwe/actions/workflows/ci.yml/badge.svg)](https://github.com/pkot/node-red-contrib-goodwe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node-RED node for reading runtime sensor data from GoodWe solar inverters over the local network.

A Node-RED port of the [marcelblijleven/goodwe](https://github.com/marcelblijleven/goodwe) Python library.

## Features

- Connect to GoodWe inverters over UDP or Modbus TCP
- Read runtime sensor values (power, voltage, current, battery, etc.)
- Discover inverters on the local network via UDP broadcast
- Support for ET, EH, BT, BH, ES, EM, BP, DT, MS, D-NS, XS families
- Shared configuration node for managing multiple inverters
- Source-IP filtering and frame validation against LAN spoofing (see [SECURITY.md](./SECURITY.md))

## Installation

```bash
npm install node-red-contrib-goodwe
```

Or via Node-RED Palette Manager: **Menu → Manage palette → Install → search `node-red-contrib-goodwe`**.

## Available nodes

| Node | Purpose |
|---|---|
| **goodwe-config** | Shared connection settings (host, port, protocol, family). Referenced by the worker nodes below. |
| **goodwe-read** | Read runtime sensor data. Supports flat / categorized / array output and auto-polling. |
| **goodwe-info** | Retrieve device identification and firmware versions. |
| **goodwe-discover** | UDP-broadcast discovery of inverters on the LAN. No config node required. |

See [`nodes/README.md`](./nodes/README.md) for per-node settings, input/output schemas, and error-handling details.

## Quick start

1. Drop a **goodwe-read** node onto your flow.
2. Click the pencil icon next to **Configuration** and create a `goodwe-config` with your inverter's IP, protocol (`udp` for most installs, port `8899`), and family (`ET`, `DT`, `ES`).
3. Wire an **inject** node into the read node and a **debug** node out, then deploy and click inject.

Minimal flow JSON:

```json
[
    { "id": "cfg", "type": "goodwe-config",
      "host": "192.168.1.100", "port": "8899", "protocol": "udp", "family": "ET" },
    { "id": "inj", "type": "inject", "payload": "true",
      "wires": [["rd"]] },
    { "id": "rd", "type": "goodwe-read", "config": "cfg",
      "outputFormat": "flat", "polling": 0, "wires": [["dbg"]] },
    { "id": "dbg", "type": "debug" }
]
```

More flow examples — categorized output, sensor filtering, discovery → config — in [`examples/README.md`](./examples/README.md).

## Supported inverter families

ET, EH, BT, BH, GEH (hybrid / Modbus) · DT, MS, D-NS, XS, KMT (grid-tie / Modbus) · ES, EM, BP (hybrid storage / AA55). May also work with white-label inverters that share these protocols.

## Security

GoodWe AA55 and Modbus framing use error-detection codes, not authentication. Anyone on the same L2 segment with the public protocol spec can fabricate a syntactically valid frame. This package mitigates the most common spoofing vectors (subnet filtering on discovery, frame validation, request serialization) but doesn't make the protocol authenticated.

Full trust model + what to do about it: [`SECURITY.md`](./SECURITY.md).

## Development & contributing

- Node.js ≥ 20.19, npm ≥ 6
- Clone, `npm install`, `npm test`
- Test framework and patterns: [`test/README.md`](./test/README.md)
- Workflow, code conventions, commit format: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- For AI assistants working on the repo: [`AGENTS.md`](./AGENTS.md)

## License

MIT — see [`LICENSE`](./LICENSE).

## Acknowledgments

- [marcelblijleven/goodwe](https://github.com/marcelblijleven/goodwe) — original Python library
- [Node-RED](https://nodered.org/) — flow-based programming platform
- GoodWe inverter community for protocol documentation

## Support

- [Report bugs](https://github.com/pkot/node-red-contrib-goodwe/issues)
- [Request features](https://github.com/pkot/node-red-contrib-goodwe/issues)
