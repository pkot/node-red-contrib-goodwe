# Node Reference

Detailed configuration, input/output, and behaviour for each Node-RED node shipped by `node-red-contrib-goodwe`. The top-level [README](../README.md) covers installation and the quickest-path usage; this file is the depth.

## goodwe-config

Shared configuration node. `goodwe-read` and `goodwe-info` reference one of these; `goodwe-discover` doesn't need one.

**Basic settings:**
- **Name** — friendly identifier
- **Host** — IP address or hostname of the inverter (required)
- **Protocol** — `udp` or `tcp` (Modbus TCP)
- **Port** — communication port. 8899 for UDP, 502 for Modbus TCP
- **Inverter Family** — ET, EH, BT, BH, ES, EM, BP, DT, MS, D-NS, XS

**Advanced settings:**
- **Timeout** — response timeout in ms (default 1000, minimum 100)
- **Retries** — retry attempts (default 3, minimum 0)
- **Comm Address** — Modbus unit ID: `auto` (family default), `F7`, or `7F`
- **Keep Alive** — keep TCP connection open between requests (default `true`)

Edits to the config node propagate to every worker referencing it; field updates are picked up on the next read without redeploying the workers (#60).

---

## goodwe-read

Reads runtime sensor data. Supports three output formats and optional auto-polling.

**Node settings:**
- **Name** — display name
- **Configuration** — reference to a `goodwe-config` node (required)
- **Output Format**:
  - `flat` (default) — sensor id → value object
  - `categorized` — grouped by `pv` / `battery` / `grid` / `ups` / `status`
  - `array` — `[{ id, value, name, unit, kind }, …]`
- **Polling** — auto-poll interval in seconds (`0` = disabled, max 86400)

**Input messages**

Read all sensors:
```js
msg.payload = true;  // any truthy value
```

Read specific sensor:
```js
msg.payload = { sensor_id: "vpv1" };
```

Read multiple sensors:
```js
msg.payload = { sensors: ["vpv1", "vpv2", "vbattery1"] };
```

**Output examples**

`flat`:
```js
{
    payload: {
        vpv1: 245.5,
        ipv1: 6.2,
        battery_soc: 87
        // ... more sensors
    },
    topic: "goodwe/runtime_data",
    timestamp: "2026-05-25T...",
    inverter: { family: "ET", host: "192.168.1.100" }
}
```

`categorized`:
```js
{
    payload: {
        pv: { vpv1: 245.5, ipv1: 6.2, ppv1: 1522, e_day: 15.2, e_total: 4523.8 },
        battery: { vbattery1: 51.2, ibattery1: -5.0, pbattery1: -256 },
        grid: { vgrid: 230.5, igrid: 12.4, total_inverter_power: 2875 },
        status: { temperature: 42.5, work_mode: 1 }
    },
    topic: "goodwe/runtime_data",
    timestamp: "2026-05-25T...",
    inverter: { family: "ET", host: "192.168.1.100" }
}
```

`array`:
```js
{
    payload: [
        { id: "vpv1", name: "PV1 Voltage", value: 245.5, unit: "V", kind: "PV" },
        { id: "vbattery1", name: "Battery Voltage", value: 51.2, unit: "V", kind: "BAT" }
        // ... all sensors
    ],
    topic: "goodwe/runtime_data",
    timestamp: "2026-05-25T...",
    inverter: { family: "ET", host: "192.168.1.100" }
}
```

**When to use which format**
- **flat** — simple dashboards, direct sensor access from a Function node
- **categorized** — organized displays, grouped gauges
- **array** — dynamic UIs, tables, charts that need per-sensor metadata

A flood of concurrent input messages is dropped with a `node.warn` rather than queued (#77); same for polling ticks that overlap a previous read.

---

## goodwe-info

Retrieves device identification and firmware information. One-shot — no polling.

**Node settings:**
- **Name** — display name
- **Configuration** — reference to a `goodwe-config` node (required)

**Input:** any message triggers an info read.

**Output:**
```js
{
    payload: {
        model_name: "GW5000-EH",
        serial_number: "95027EST123A0001",
        firmware: "V2.01",
        arm_firmware: "V2.01",
        dsp1_version: "V1.14",
        dsp2_version: "V1.14",
        rated_power: 5000,
        ac_output_type: 0,
        family: "ET"
    },
    topic: "goodwe/device_info",
    timestamp: "2026-05-25T...",
    inverter: { family: "ET", host: "192.168.1.100" }
}
```

---

## goodwe-discover

UDP-broadcast discovery of GoodWe inverters on the local network.

> Unlike the other worker nodes, **`goodwe-discover` does not require a `goodwe-config`** — discovery has no inverter to point at yet. Once you have an IP from `payload.devices[]`, paste it into a `goodwe-config` node for subsequent reads.

**Node settings:**
- **Name** — display name
- **Timeout** — discovery window in ms (default 5000, min 100, max 300000)
- **Broadcast Address** — default `255.255.255.255` (limited broadcast — stays on the local segment). Directed broadcasts like `192.168.1.255` are accepted; non-private addresses are rejected for safety (see [SECURITY.md](../SECURITY.md)).

**Input:** any message triggers discovery.

**Output:**
```js
{
    payload: {
        devices: [
            {
                host: "192.168.1.100",
                port: 8899,
                model: "GW5000-EH",
                serial: "ETxxxxxxxx",
                family: "ET",
                protocol: "udp"
            }
        ],
        count: 1
    },
    topic: "goodwe/discover",
    timestamp: "2026-05-25T..."
}
```

The resolved array carries a non-enumerable `diagnostics` property with drop counters (`nonLocalSubnet`, `invalidFrame`, `parseFailures`) for troubleshooting — see SECURITY.md.

**macOS note:** Recent macOS versions (Sonoma / Sequoia onward) prompt for **Local Network** permission the first time a process binds a UDP socket and broadcasts on the LAN. If discovery returns empty results on macOS, check **System Settings → Privacy & Security → Local Network** and grant access to the runtime that runs Node-RED (Terminal, the Node-RED app, or whatever launches the `node` process). Without this permission the OS silently drops the discovery probe — there's no error to surface.

---

## Error handling (all nodes)

Errors surface through Node-RED's standard `done(err)` channel and trigger Catch nodes. Each error carries a code, human message, and actionable suggestions:

```js
{
    message: "Response timeout",
    code: "TIMEOUT",
    details: { host: "192.168.1.100", port: 8899, protocol: "udp", family: "ET" },
    suggestions: [
        "Verify inverter at 192.168.1.100 is powered on",
        "Check network connection to inverter",
        "Ensure inverter is on the same network segment",
        "Try increasing timeout above 1000ms in configuration"
    ]
}
```

Common error codes: `TIMEOUT`, `ECONNREFUSED`, `ECONNRESET`, `EHOSTUNREACH`, `PROTOCOL_ERROR`, `INVALID_HOST`, `INVALID_CONFIG`, `UNSUPPORTED_FAMILY`, `READ_ERROR`. The full set is in [`lib/errors.js`](../lib/errors.js).
