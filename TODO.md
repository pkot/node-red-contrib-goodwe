# Implementation TODO

This document tracks the implementation progress for porting the marcelblijleven/goodwe Python library to Node-RED.

## Completed ✅

### Project Foundation
- [x] Initial project structure and scaffolding
- [x] Basic Node-RED node configuration (goodwe.js and goodwe.html)
- [x] Test framework setup with Jest (372+ tests passing)
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
- [x] AA55 protocol command definitions

### Phase 1: Sensor Register Maps — #33 ✅
- [x] `lib/sensors.js` — per-family sensor definitions (ET, ES, DT) with type readers
- [x] `lib/modbus.js` — Modbus RTU/TCP frame construction, CRC-16, AA55 protocol
- [x] Register-based data parsing replaces hardcoded byte offsets
- [x] `SENSOR_METADATA` generated from sensor definitions
- [x] Comprehensive tests for sensors and modbus modules

### Phase 2: Remove Mock Data Fallback — #35 ✅
- [x] Removed host-based mock data from `nodes/read.js`
- [x] Removed `generateMockRuntimeData` from `lib/node-helpers.js`
- [x] Tests mock `ProtocolHandler` via `jest.mock()` with deterministic data

### Phase 3: Connection Management in Config Node — #34 ✅
- [x] Config node owns shared `ProtocolHandler` via lazy `getProtocolHandler()`
- [x] Dependent node tracking with `registerUser()`/`deregisterUser()`
- [x] Event forwarding from protocol handler to dependent nodes
- [x] Connection lifecycle tied to config node

### Phase 4: Info Node — #21 ✅
- [x] `nodes/info.js` and `nodes/info.html` — device info retrieval
- [x] `readDeviceInfo()` and `parseDeviceInfo()` in `lib/protocol.js`
- [x] Parses model name, serial number, firmware versions, rated power
- [x] Uses shared connection from config node

### Phase 5: Enhanced Error Messages — #23 ✅
- [x] `lib/errors.js` — suggestion generators for 7 error codes
- [x] `enhanceError()` adds `suggestions` array and `details` to errors
- [x] Integrated into all protocol error paths

### Phase 6: Testing, Documentation & Release ✅
- [x] 372+ tests across 17 test suites
- [x] >70% code coverage (81.7% statements, 72.18% branches)
- [x] Coverage includes both `nodes/` and `lib/` directories
- [x] TODO.md updated to reflect completed work
- [x] All v1.0 GitHub issues closed

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
