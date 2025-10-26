# Configuration Read/Write Features

This document describes the configuration read/write capabilities implemented in the node-red-contrib-goodwe Node-RED node.

## Overview

The GoodWe Node-RED node now supports reading and writing configuration parameters to GoodWe inverters, based on the capabilities provided by the [marcelblijleven/goodwe](https://github.com/marcelblijleven/goodwe) Python library.

## Implementation Status

✅ **IMPLEMENTED** - Configuration read/write features are fully implemented with the following capabilities:

### Supported Operations

#### Read Operations (Safe)
- **read_settings**: Read all configuration settings from the inverter
- **read_setting**: Read a specific configuration setting by ID
- **get_grid_export_limit**: Get the current grid export limit
- **get_operation_mode**: Get the current inverter operation mode
- **get_battery_dod**: Get the battery depth of discharge setting

#### Write Operations (⚠️ Use with Caution)
- **write_setting**: Write a specific configuration setting
- **set_grid_export_limit**: Set the grid export limit (0-10000W)
- **set_operation_mode**: Set the inverter operation mode
- **set_battery_dod**: Set the battery depth of discharge (0-89%)

## Safety Features

The implementation includes multiple layers of safety to prevent accidental damage:

### 1. Input Validation
All write operations validate input values before sending to the inverter:
- **Type checking**: Ensures values are of the correct type (number, string, etc.)
- **Range validation**: Checks that numeric values are within safe limits
- **Enum validation**: Verifies that mode selections are from valid options

### 2. Error Handling
Comprehensive error handling with specific error codes:
- `MISSING_PARAMETER`: Required parameter not provided
- `INVALID_SETTING`: Unknown or invalid setting ID
- `VALIDATION_ERROR`: Value failed validation checks
- `CONFIG_ERROR`: General configuration operation error

### 3. User Warnings
Prominent warnings in documentation and UI about:
- Installer-level parameter modifications
- Potential warranty implications
- Risk of equipment damage
- Need for professional consultation

## Supported Configuration Parameters

### Grid Export Limit
- **ID**: `grid_export_limit`
- **Type**: Number (Watts)
- **Range**: 0 - 10000 W
- **Description**: Maximum power that can be exported to the grid
- **Use Case**: Comply with grid connection requirements, prevent reverse power flow

### Operation Mode
- **ID**: `operation_mode`
- **Type**: Enum
- **Values**: `GENERAL`, `OFF_GRID`, `BACKUP`, `ECO`, `PEAK_SHAVING`
- **Description**: Inverter operating mode
- **Use Case**: Switch between different operational strategies
- **Special**: ECO mode supports additional parameters (eco_mode_power, eco_mode_soc)

### Battery Depth of Discharge (DoD)
- **ID**: `battery_dod`
- **Type**: Number (Percentage)
- **Range**: 0 - 89%
- **Description**: How deeply the battery can be discharged
- **Use Case**: Battery protection, capacity management
- **Note**: Higher DoD provides more usable capacity but may reduce battery lifespan

## Usage Examples

### Reading All Settings

```javascript
msg.payload = { command: "read_settings" };
return msg;
```

**Response:**
```javascript
{
    success: true,
    command: "read_settings",
    timestamp: "2025-10-26T18:00:00.000Z",
    data: {
        grid_export_limit: 5000,
        operation_mode: "GENERAL",
        battery_dod: 85,
        // ... other settings
    }
}
```

### Reading a Specific Setting

```javascript
msg.payload = {
    command: "read_setting",
    setting_id: "grid_export_limit"
};
return msg;
```

**Response:**
```javascript
{
    success: true,
    command: "read_setting",
    timestamp: "2025-10-26T18:00:00.000Z",
    data: {
        setting_id: "grid_export_limit",
        value: 5000,
        unit: "W",
        name: "Grid Export Limit"
    }
}
```

### Writing a Configuration Setting

```javascript
// ⚠️ WARNING: This modifies inverter configuration!
msg.payload = {
    command: "write_setting",
    setting_id: "grid_export_limit",
    value: 4000  // New limit in watts
};
return msg;
```

**Response:**
```javascript
{
    success: true,
    command: "write_setting",
    timestamp: "2025-10-26T18:00:00.000Z",
    data: {
        setting_id: "grid_export_limit",
        value: 4000,
        previous_value: 5000  // Previous value for rollback
    }
}
```

### Setting Grid Export Limit

```javascript
// ⚠️ WARNING: This modifies inverter configuration!
msg.payload = {
    command: "set_grid_export_limit",
    limit: 3000  // New limit in watts
};
return msg;
```

### Setting Operation Mode

```javascript
// ⚠️ WARNING: This modifies inverter configuration!
msg.payload = {
    command: "set_operation_mode",
    mode: "ECO",
    eco_mode_power: 100,  // Optional, defaults to 100
    eco_mode_soc: 90      // Optional, defaults to 100
};
return msg;
```

### Setting Battery DoD

```javascript
// ⚠️ WARNING: This modifies inverter configuration!
msg.payload = {
    command: "set_battery_dod",
    dod: 80  // Percentage (0-89)
};
return msg;
```

## Error Handling

### Example: Invalid Value

```javascript
msg.payload = {
    command: "set_battery_dod",
    dod: 95  // Out of range!
};
```

**Response:**
```javascript
{
    success: false,
    command: "set_battery_dod",
    timestamp: "2025-10-26T18:00:00.000Z",
    error: {
        code: "VALIDATION_ERROR",
        message: "Battery Depth of Discharge out of range: 95. Valid range: 0-89%",
        details: "..."
    }
}
```

### Example: Missing Parameter

```javascript
msg.payload = {
    command: "write_setting",
    setting_id: "grid_export_limit"
    // Missing value!
};
```

**Response:**
```javascript
{
    success: false,
    command: "write_setting",
    timestamp: "2025-10-26T18:00:00.000Z",
    error: {
        code: "MISSING_PARAMETER",
        message: "Missing required parameter: value",
        details: "..."
    }
}
```

## ⚠️ Critical Safety Warnings

### 1. Professional Consultation Required
Configuration parameters are **installer-level settings**. Incorrect values can:
- Damage your inverter or battery
- Create unsafe electrical conditions
- Violate grid connection agreements
- Void your warranty
- Violate local electrical codes

### 2. Before Making Changes
Always:
- Read and save current settings first
- Understand what the parameter controls
- Verify the new value is appropriate for your installation
- Check local regulations and grid connection requirements
- Consult your installer or the manufacturer
- Document all changes

### 3. Warranty Implications
Unauthorized modifications to inverter settings may:
- Void manufacturer warranty
- Void installer warranty
- Affect insurance coverage
- Make you liable for equipment damage

### 4. Testing and Monitoring
After any configuration change:
- Monitor inverter operation closely
- Check for error codes or warnings
- Verify battery and grid behavior is normal
- Be prepared to restore previous settings if issues arise

## Current Implementation Notes

### Mock Implementation
The current implementation uses **mock data** for testing and development. This means:
- ✅ All validation logic is fully implemented
- ✅ All command handling is complete
- ✅ Error handling and safety checks are active
- ⚠️ Actual inverter communication is not yet implemented

### Future Enhancements
When actual inverter communication is implemented, the following will be added:
- Real-time reading of current settings from connected inverter
- Actual writing of settings to inverter hardware
- Verification of successful writes
- Proper error handling for communication failures
- Support for different inverter families and firmware versions

## Limitations

### 1. Protocol Support
Configuration read/write is supported by the GoodWe protocol, but:
- Some older inverters may not support all settings
- Different inverter families may have different available settings
- Firmware version affects which parameters are available

### 2. Network Requirements
Configuration operations require:
- Direct network access to the inverter
- Inverter must be reachable via UDP (port 8899) or Modbus TCP (port 502)
- Some inverters require specific dongles for network access

### 3. Setting Availability
Not all settings are available on all inverters:
- Battery-related settings only apply to hybrid inverters
- Grid export settings depend on inverter capabilities
- Operation modes vary by inverter model and firmware

## Testing

The implementation includes comprehensive tests:
- ✅ 18 configuration operation tests
- ✅ Read operations (all settings and specific settings)
- ✅ Write operations with validation
- ✅ Specialized APIs (grid export, operation mode, battery DoD)
- ✅ Error handling and validation
- ✅ Status reporting
- ✅ All tests passing

## References

- [marcelblijleven/goodwe Python Library](https://github.com/marcelblijleven/goodwe)
- [GoodWe Protocol Documentation](https://github.com/marcelblijleven/goodwe/tree/master/goodwe/protocols)
- [Feature Analysis Document](./FEATURE_ANALYSIS.md)
- [Node Design Specification](./NODE_DESIGN.md)

## Support and Contributions

For questions, issues, or contributions related to configuration features:
- [GitHub Issues](https://github.com/pkot/node-red-contrib-goodwe/issues)
- [Pull Requests](https://github.com/pkot/node-red-contrib-goodwe/pulls)
- [Discussions](https://github.com/pkot/node-red-contrib-goodwe/discussions)

---

**Last Updated**: 2025-10-26  
**Status**: ✅ Implemented (mock mode)  
**Version**: 0.1.0
