# Implementation TODO

This document tracks the implementation progress for porting the marcelblijleven/goodwe Python library to Node-RED.

## Completed ✅

### Project Foundation
- [x] Initial project structure and scaffolding
- [x] Basic Node-RED node configuration (goodwe.js and goodwe.html)
- [x] Test framework setup with Jest (146+ tests passing)
- [x] ESLint configuration for code quality
- [x] GitHub Actions CI/CD workflow
- [x] Comprehensive documentation (README, CONTRIBUTING, CHANGELOG)
- [x] Example flows for basic usage, discovery, and read node
- [x] Node structure and configuration design (see [docs/NODE_DESIGN.md](./docs/NODE_DESIGN.md))

### Multi-Node Architecture (#15)
- [x] Shared configuration node (`nodes/config.js`) — #17
- [x] Dedicated read node with multiple output formats (`nodes/read.js`) — #18
- [x] Dedicated discover node (`nodes/discover.js`) — #20

### Core Protocol Layer
- [x] UDP client for inverter communication (`lib/protocol.js`)
- [x] TCP/Modbus client connection handling
- [x] Request/response with timeout and retry (exponential backoff)
- [x] Connection status tracking and event emission
- [x] UDP broadcast discovery with response parsing
- [x] Basic AA55 protocol command definitions

## v1.0 Roadmap 🚧

### Phase 1: Port Sensor Register Maps — #33 (Priority: HIGH, Critical Path)

The current `_parseRuntimeData()` uses hardcoded byte offsets that only partially work for ET series. The Python library uses register-based Modbus reads with per-family sensor definition tables. This is the bulk of remaining work.

- [ ] Create `lib/sensors.js` — port sensor definition tables from Python library
  - [ ] ET series (ET, EH, BT, BH, GEH) — register addresses, data types, scale factors
  - [ ] ES series (ES, EM, BP)
  - [ ] DT series (DT, MS, D-NS, XS)
- [ ] Create `lib/modbus.js` — Modbus register framing
  - [ ] Modbus RTU frame construction (for UDP ModbusRTU protocol)
  - [ ] Modbus TCP frame construction
  - [ ] Read holding registers (function code 0x03)
  - [ ] Read input registers (function code 0x04)
- [ ] Implement register-based data parser
  - [ ] Parse raw register data using sensor definitions (address, length, type, scale)
  - [ ] Replace hardcoded `_parseRuntimeData()` in `lib/protocol.js`
  - [ ] Generate `SENSOR_METADATA` from sensor definitions instead of static map
- [ ] Tests for each inverter family's sensor parsing

### Phase 2: Remove Mock Data Fallback — #35 (Priority: HIGH, Bug)

Production code in `read.js` silently returns fake data for hosts `192.168.1.100` and `192.168.1.101` — common real LAN addresses.

- [ ] Remove host-based mock data check from `nodes/read.js`
- [ ] Refactor tests to mock at the protocol handler level (dependency injection or jest mocks)
- [ ] Verify real protocol path works end-to-end

### Phase 3: Connection Management in Config Node — #34 (Priority: HIGH)

Each node currently creates its own `ProtocolHandler`. The config node should own the connection and serialize access, following patterns used by `node-red-contrib-modbus` and the built-in serial node.

- [ ] Config node creates and owns the `ProtocolHandler`
- [ ] Operational nodes use `configNode.sendCommand()` instead of own connections
- [ ] Command queue to serialize concurrent requests
- [ ] Connection lifecycle tied to config node lifecycle
- [ ] Update read node to use shared connection
- [ ] Update discover node (may need ephemeral socket for broadcast)

### Phase 4: Info Node — #21 (Priority: MEDIUM)

- [ ] Create `nodes/info.js` and `nodes/info.html`
- [ ] Implement device info retrieval (AA55 command `01 01`)
- [ ] Parse model name, serial number, firmware versions, rated power
- [ ] Status updates during retrieval
- [ ] Tests and documentation

### Phase 5: Enhanced Error Messages — #23 (Priority: MEDIUM)

- [ ] Add `suggestions` array to error response structure
- [ ] Create suggestion generator per error code (TIMEOUT, ECONNREFUSED, PROTOCOL_ERROR, etc.)
- [ ] Include contextual info (IP, port, setting name) in suggestions
- [ ] Update error handling in all nodes

### Phase 6: Testing, Documentation & Release

- [ ] Unit tests for new modules (`lib/sensors.js`, `lib/modbus.js`)
- [ ] Integration tests with mock inverter responses per family
- [ ] Maintain >70% code coverage
- [ ] Update API documentation for all node inputs/outputs
- [ ] Getting started and troubleshooting guides
- [ ] npm package preparation and publish
- [ ] Tag v1.0.0 release

## Post-v1.0 📋

### Write Node — #19 (Priority: LOW)

Writing inverter settings over the network is risky and poorly documented. Deferred to reduce v1.0 scope and avoid shipping a feature that could damage hardware before thorough validation.

- [ ] Create `nodes/write.js` and `nodes/write.html`
- [ ] Safety warnings in UI
- [ ] Optional confirmation feature (`confirm: true` in message)
- [ ] Parameter validation (range, writable check)
- [ ] Return previous value on success

### Future Enhancements

- [ ] Caching for better performance (cache recent readings, invalidation)
- [ ] Authentication support (if any models require it)

## Dependencies

No external production dependencies — uses only Node.js built-in modules:
- `dgram` — UDP protocol
- `net` — TCP protocol
- `events` — EventEmitter

## References

- [marcelblijleven/goodwe Python library](https://github.com/marcelblijleven/goodwe)
- [Node-RED Creating Nodes Guide](https://nodered.org/docs/creating-nodes/)
- [Modbus Protocol Specification](https://modbus.org/specs.php)

## Notes

- Focus on TDD: Write tests before implementing features
- Keep changes minimal and focused
- Document as you go
- Prioritize core features over nice-to-haves
- Node-RED already handles multi-device (multiple config nodes) and data transformation (CSV node, function node) — don't duplicate built-in capabilities
