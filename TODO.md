# Implementation TODO

This document tracks the implementation progress for porting the marcelblijleven/goodwe Python library to Node-RED.

## Completed ✅

- [x] Initial project structure and scaffolding
- [x] Basic Node-RED node configuration (goodwe.js and goodwe.html)
- [x] Test framework setup with Jest
- [x] ESLint configuration for code quality
- [x] GitHub Actions CI/CD workflow
- [x] Comprehensive documentation (README, CONTRIBUTING, CHANGELOG)
- [x] Example flow for basic usage
- [x] Configuration UI with multiple inverter families

## In Progress 🚧

- [x] Node structure and configuration design (see [docs/NODE_DESIGN.md](./docs/NODE_DESIGN.md))
- [x] Design specifications and TDD test plan
- [ ] Core protocol implementation

## TODO 📋

### Phase 1: Core Connectivity (Priority: High)

- [ ] Research GoodWe inverter communication protocols
  - [ ] UDP protocol on port 8899
  - [ ] Modbus TCP protocol on port 502
- [ ] Implement UDP client for inverter communication
  - [ ] Create connection handler
  - [ ] Implement request/response handling
  - [ ] Add timeout and error handling
- [ ] Implement Modbus TCP client
  - [ ] Research existing Node.js Modbus libraries
  - [ ] Create Modbus connection handler
  - [ ] Implement register read/write operations
- [ ] Add connection status tracking
  - [ ] Update node status indicators
  - [ ] Handle reconnection logic
  - [ ] Implement connection pooling if needed

### Phase 2: Inverter Discovery (Priority: High)

- [ ] Implement network discovery
  - [ ] UDP broadcast for device discovery
  - [ ] Parse discovery responses
  - [ ] Return list of available inverters
- [ ] Add inverter family detection
  - [ ] Identify inverter model from responses
  - [ ] Auto-detect communication protocol
- [ ] Create discovery command in node
  - [ ] Handle "discover" payload command
  - [ ] Return discovered devices in output

### Phase 3: Runtime Data Readout (Priority: High)

- [ ] Define sensor data structures
  - [ ] Map Python library sensor definitions to JavaScript
  - [ ] Create TypeScript type definitions (optional)
- [ ] Implement data readout for each inverter family
  - [ ] ET Series (ET, EH)
  - [ ] BT Series (BT, BH)
  - [ ] ES Series
  - [ ] EM Series
  - [ ] BP Series
  - [ ] DT Series (three-phase)
  - [ ] MS Series
  - [ ] D-NS Series
  - [ ] XS Series
- [ ] Parse and format sensor data
  - [ ] Convert raw data to human-readable values
  - [ ] Apply unit conversions
  - [ ] Handle missing/invalid data gracefully
- [ ] Implement periodic polling
  - [ ] Add configurable polling interval
  - [ ] Handle polling lifecycle with node lifecycle
  - [ ] Avoid resource leaks on node close

### Phase 4: Configuration Read/Write (Priority: Medium)

- [ ] Research configuration parameters for each family
  - [ ] Identify read-only vs read-write parameters
  - [ ] Document parameter ranges and validation
- [ ] Implement configuration reading
  - [ ] Read parameters via appropriate protocol
  - [ ] Parse configuration data
- [ ] Implement configuration writing
  - [ ] Validate parameters before writing
  - [ ] Write parameters via appropriate protocol
  - [ ] Verify write success
- [ ] Add safety checks and warnings
  - [ ] Warn users about potentially dangerous operations
  - [ ] Implement write confirmation if needed

### Phase 5: Advanced Features (Priority: Low)

- [ ] Add caching for better performance
  - [ ] Cache recent sensor readings
  - [ ] Implement cache invalidation
- [ ] Support for multiple inverters in one node
  - [ ] Array of inverter configurations
  - [ ] Aggregate data from multiple sources
- [ ] Add data transformation options
  - [ ] Custom output formats (JSON, CSV, etc.)
  - [ ] Filter specific sensors
  - [ ] Calculate derived values (e.g., efficiency)
- [ ] Implement authentication if needed
  - [ ] Research if any models require authentication
  - [ ] Add password/token configuration

### Phase 6: Testing & Quality (Priority: High - Ongoing)

- [ ] Unit tests for each module
  - [ ] Protocol handlers
  - [ ] Data parsers
  - [ ] Configuration validators
- [ ] Integration tests
  - [ ] Mock inverter for testing
  - [ ] Test full communication flow
  - [ ] Test error scenarios
- [ ] End-to-end tests
  - [ ] Test with Node-RED flows
  - [ ] Verify UI functionality
- [ ] Performance testing
  - [ ] Test with multiple concurrent connections
  - [ ] Measure memory usage
  - [ ] Test long-running stability
- [ ] Code coverage
  - [ ] Maintain >70% coverage
  - [ ] Test edge cases thoroughly

### Phase 7: Documentation (Priority: High - Ongoing)

- [ ] API documentation
  - [ ] Document all node inputs/outputs
  - [ ] Document configuration options
  - [ ] Add JSDoc comments to code
- [ ] User guides
  - [ ] Getting started guide
  - [ ] Troubleshooting guide
  - [ ] Advanced usage examples
- [ ] Examples
  - [ ] Basic read example (already created)
  - [ ] Discovery example
  - [ ] Configuration example
  - [ ] Multi-inverter example
  - [ ] Dashboard integration example
- [ ] FAQ
  - [ ] Common issues and solutions
  - [ ] Performance tips
  - [ ] Security best practices

### Phase 8: Release Preparation (Priority: Medium)

- [ ] Version 1.0.0 checklist
  - [ ] All core features implemented
  - [ ] Tests passing with good coverage
  - [ ] Documentation complete
  - [ ] Examples provided
- [ ] npm package preparation
  - [ ] Verify package.json metadata
  - [ ] Test installation process
  - [ ] Prepare npm keywords for discoverability
- [ ] Create GitHub releases
  - [ ] Tag versions properly
  - [ ] Write release notes
  - [ ] Attach build artifacts if needed
- [ ] Publish to npm registry
  - [ ] Test package on Node-RED
  - [ ] Publish stable version
- [ ] Announce release
  - [ ] Node-RED forums
  - [ ] GoodWe community
  - [ ] Home automation communities

## Dependencies to Add

As implementation progresses, we may need to add:

- [ ] UDP/networking libraries (built-in Node.js modules should suffice)
- [ ] Modbus TCP library (e.g., `jsmodbus`, `modbus-serial`, or similar)
- [ ] Buffer manipulation utilities (likely built-in)
- [ ] Optional: TypeScript for better type safety
- [ ] Optional: Additional testing utilities

## Research References

- [marcelblijleven/goodwe Python library](https://github.com/marcelblijleven/goodwe)
- [Node-RED Creating Nodes Guide](https://nodered.org/docs/creating-nodes/)
- [GoodWe Inverter Protocol Documentation](https://github.com/marcelblijleven/goodwe/tree/master/goodwe/protocols)
- [Modbus Protocol Specification](https://modbus.org/specs.php)

## Notes

- Focus on TDD: Write tests before implementing features
- Keep changes minimal and focused
- Document as you go
- Regular progress commits to track work
- Prioritize core features over nice-to-haves
