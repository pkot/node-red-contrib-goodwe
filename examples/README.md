# Example Flows

Importable Node-RED flow JSON files demonstrating common usage patterns. In Node-RED: **Menu → Import → select file**, or paste the JSON in the Import dialog.

| File | Demonstrates |
|---|---|
| [`basic-read.json`](./basic-read.json) | Minimal one-shot read via `goodwe-read`, output to a debug node. |
| [`read-node-examples.json`](./read-node-examples.json) | Three reads side-by-side — flat, categorized, and array output formats. |
| [`discovery.json`](./discovery.json) | `goodwe-discover` triggered by an inject node; result piped to debug. |

For per-node configuration details see [`nodes/README.md`](../nodes/README.md).

---

## Inline examples (copy/paste-able)

### Basic read with auto-polling

A single `goodwe-config` shared between an inject trigger and a `goodwe-read` running at 60-second auto-poll:

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

### Categorized output

Same setup, but output grouped by `pv` / `battery` / `grid` / `status`. Polling disabled — read fires on inject only:

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

### Specific sensors only

Filter to a subset via `msg.payload.sensors`. Useful when you only care about a few values and don't want the whole sensor object on every message:

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

### Discovery → config (Function node bridge)

`goodwe-discover` output and `goodwe-config` input share field names, so a Function node can pluck one device and forward it to a config-aware path:

```js
// In a Function node after goodwe-discover:
const dev = msg.payload.devices[0];
if (!dev) return null;
msg.payload = {
    host: dev.host,
    port: dev.port,
    protocol: dev.protocol,
    family: dev.family
};
return msg;
```
