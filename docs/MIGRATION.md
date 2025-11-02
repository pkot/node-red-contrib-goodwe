# Migration Guide: Unified Node to Specialized Nodes

This guide helps you migrate from the legacy unified `goodwe` node to the new specialized nodes architecture.

## Overview

The new architecture provides separate nodes for different operations:

- **`goodwe-config`** - Configuration node (stores connection settings)
- **`goodwe-read`** - Read runtime sensor data
- **`goodwe-write`** - Write configuration settings
- **`goodwe-discover`** - Discover inverters on network
- **`goodwe-info`** - Get device information

The legacy `goodwe-legacy` node is still available for backward compatibility.

## Why Change?

The new specialized nodes offer several advantages:

✅ **Clearer purpose** - Each node has a single, well-defined responsibility  
✅ **Simpler interfaces** - No need to learn command structures  
✅ **Better visual flows** - Flow diagrams are more self-documenting  
✅ **Safety** - Write operations isolated in dedicated node  
✅ **Easier testing** - Each node can be tested independently

## Migration Steps

### 1. Reading Runtime Data

**Before (Legacy):**
```
[Inject] → [goodwe (command: "read")] → [Debug]
```

Flow configuration:
```json
{
    "id": "n1",
    "type": "goodwe",
    "name": "My Inverter",
    "host": "192.168.1.100",
    "port": 8899,
    "protocol": "udp",
    "family": "ET"
}
```

Inject payload:
```
"read"
```

**After (New):**
```
[Inject] → [goodwe-read] → [Debug]
         ↓
   [goodwe-config]
```

Flow configuration:
```json
{
    "id": "c1",
    "type": "goodwe-config",
    "name": "My Inverter",
    "host": "192.168.1.100",
    "port": 8899,
    "protocol": "udp",
    "family": "ET"
},
{
    "id": "n1",
    "type": "goodwe-read",
    "name": "Read Data",
    "config": "c1"
}
```

Inject payload:
```
true  // Any payload triggers read
```

### 2. Discovery

**Before (Legacy):**
```json
msg.payload = "discover"
```

**After (New):**
```
[Inject] → [goodwe-discover] → [Debug]
```

Inject payload:
```
true  // Any payload triggers discovery
```

### 3. Writing Settings

**Before (Legacy):**
```json
msg.payload = {
    "command": "write_setting",
    "setting_id": "grid_export_limit",
    "value": 5000
}
```

**After (New):**
```
[Inject] → [goodwe-write] → [Debug]
         ↓
   [goodwe-config]
```

Inject payload:
```json
{
    "setting_id": "grid_export_limit",
    "value": 5000
}
```

### 4. Getting Device Info

**Before (Legacy):**
```
Not directly supported in legacy node
```

**After (New):**
```
[Inject] → [goodwe-info] → [Debug]
         ↓
   [goodwe-config]
```

Inject payload:
```
true  // Any payload triggers info retrieval
```

## Key Differences

### Configuration

| Aspect | Legacy | New |
|--------|--------|-----|
| Configuration | In each node | Shared config node |
| Multiple inverters | Duplicate settings | One config per inverter |
| Connection management | Per node | Shared via config |

### Commands

| Legacy Command | New Node | Notes |
|---------------|----------|-------|
| `"read"` | `goodwe-read` | Simplified - any payload triggers |
| `"discover"` | `goodwe-discover` | Standalone - no config needed |
| `"write_setting"` | `goodwe-write` | Clearer payload structure |
| `"device_info"` | `goodwe-info` | New dedicated node |
| `"read_settings"` | `goodwe-write` | Future enhancement |

### Message Format

**Legacy Output:**
```json
{
    "payload": {
        "success": true,
        "command": "read",
        "timestamp": "...",
        "data": { /* sensor data */ }
    }
}
```

**New Output:**
```json
{
    "payload": { /* sensor data directly */ },
    "topic": "goodwe/runtime_data",
    "_timestamp": "...",
    "_inverter": { /* inverter info */ }
}
```

## Advanced Migration

### Auto-Polling

**Before (Legacy):**
```
[Inject (repeat: 10s)] → [goodwe] → [Debug]
```

**After (New):**
```
[goodwe-read (polling: 10)] → [Debug]
         ↓
   [goodwe-config]
```

Configure polling directly in the read node:
```json
{
    "type": "goodwe-read",
    "pollingInterval": 10  // Seconds
}
```

### Output Formatting

The new `goodwe-read` node supports multiple output formats:

- **Flat** (default) - Simple key-value pairs
- **Categorized** - Grouped by type (pv, battery, grid, energy)
- **Array** - Array of sensor objects with metadata

Configure in the node properties.

### Multiple Inverters

**Before (Legacy):**
Each node had its own host/port configuration.

**After (New):**
Create one config node per inverter, then reference it from operational nodes.

```
[Inject] → [goodwe-read (config: inverter1)] → [Debug 1]
[Inject] → [goodwe-read (config: inverter2)] → [Debug 2]
         ↓                                  ↓
   [config: inverter1]              [config: inverter2]
```

## Backward Compatibility

The `goodwe-legacy` node remains available for existing flows. However, we recommend migrating to the new nodes for:

- Better maintainability
- Clearer flow diagrams
- Access to new features
- Future-proofing your flows

## Example Flows

### Complete Migration Example

**Legacy Flow:**
```json
[
    {
        "id": "inject1",
        "type": "inject",
        "repeat": "10",
        "payload": "read",
        "wires": [["goodwe1"]]
    },
    {
        "id": "goodwe1",
        "type": "goodwe",
        "host": "192.168.1.100",
        "port": 8899,
        "protocol": "udp",
        "family": "ET",
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug"
    }
]
```

**New Flow:**
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
        "wires": [["debug1"]]
    },
    {
        "id": "debug1",
        "type": "debug"
    }
]
```

## Getting Help

If you encounter issues during migration:

1. Check the node help text (click the info icon in Node-RED)
2. Review the examples in the `examples/` directory
3. Open an issue on GitHub with details of your flow
4. Use `goodwe-legacy` as a temporary workaround

## Timeline

- **Current** - Both legacy and new nodes available
- **Future** - Legacy node deprecated but still functional
- **Long-term** - Legacy node may be removed in major version update

We recommend migrating at your convenience to benefit from new features and improvements.
