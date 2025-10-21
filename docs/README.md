# Documentation

This folder contains design and implementation documentation for the node-red-contrib-goodwe project.

## Documents

### [NODE_DESIGN.md](./NODE_DESIGN.md)
**Node-RED GoodWe Node Design Specification**

Comprehensive design document specifying:
- Node structure and architecture
- Configuration UI design with field specifications
- Input/output message structure and formats
- Error and status reporting mechanisms
- Design decisions and tradeoffs
- Test-driven development plan
- Example flows and configurations

This document serves as the specification for implementing the GoodWe Node-RED node.

**Status**: ✅ Complete and Ready for Implementation

### [FEATURE_ANALYSIS.md](./FEATURE_ANALYSIS.md)
**GoodWe Python Library Feature Analysis**

Detailed analysis of the marcelblijleven/goodwe Python library, including:
- Supported inverter models and families
- Communication protocols (UDP AA55, ModbusRTU, Modbus TCP)
- Discovery mechanisms
- Runtime sensor data and configuration operations
- Protocol command structures
- Error handling and retry mechanisms
- Node-RED feature mapping

This document provides the foundation for understanding what features need to be ported from the Python library.

**Status**: ✅ Complete

### [TESTING.md](./TESTING.md)
**Comprehensive Testing Guide**

Complete guide for test-driven development in this project, including:
- Test framework setup and configuration
- Writing tests for Node-RED nodes
- Using test utilities and mock data
- TDD workflow (Red-Green-Refactor)
- Mocking inverter responses for offline development
- CI integration and coverage requirements
- Best practices and troubleshooting

This document is essential for all contributors to understand the testing approach.

**Status**: ✅ Complete

## Using These Documents

### For Contributors

1. **Start with NODE_DESIGN.md** to understand the overall architecture and design decisions
2. **Reference FEATURE_ANALYSIS.md** when implementing specific protocol or sensor features
3. **Read TESTING.md** to understand the TDD workflow and testing practices
4. Follow the TDD approach outlined in NODE_DESIGN.md section 6

### For Reviewers

1. Verify implementations match the specifications in NODE_DESIGN.md
2. Check that protocol implementations follow FEATURE_ANALYSIS.md details
3. Ensure test coverage meets the goals in NODE_DESIGN.md section 6.2

### For Users (Future)

These documents will be supplemented with user-facing documentation:
- Getting Started Guide
- Configuration Guide
- Sensor Reference
- Troubleshooting Guide
- FAQ

## Document Status

| Document | Version | Status | Last Updated |
|----------|---------|--------|--------------|
| NODE_DESIGN.md | 1.0 | Complete | 2025-10-20 |
| FEATURE_ANALYSIS.md | 1.0 | Complete | 2025-10-20 |
| TESTING.md | 1.0 | Complete | 2025-10-21 |

## Contributing to Documentation

When adding or updating documentation:

1. Follow the existing structure and format
2. Keep technical accuracy high
3. Include examples and diagrams where helpful
4. Update this README when adding new documents
5. Mark document status and version clearly
