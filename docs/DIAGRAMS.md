# GoodWe Node-RED Node Diagrams

This file contains ASCII diagrams illustrating the GoodWe node design.

## Node Structure Overview

```
┌─────────────────────────────────────────┐
│         GoodWe Node (goodwe)            │
│                                         │
│  Category: function                     │
│  Color: #3FADB5 (teal)                 │
│  Icon: bridge.png                       │
├─────────────────────────────────────────┤
│                                         │
│  [Input] ──▶ Command Processing ──▶ [Output]
│                     │                   │
│                     ▼                   │
│              Protocol Layer             │
│              (UDP/Modbus)              │
│                     │                   │
│                     ▼                   │
│         [GoodWe Inverter Network]      │
└─────────────────────────────────────────┘
```

## Message Flow

```
Input Message                                Output Message
────────────────                             ──────────────
msg.payload = "read"                         msg.payload = {
msg.correlationId                              success: true,
msg.customProps                                command: "read",
     │                                         timestamp: "...",
     ▼                                         data: { ... }
┌─────────────┐                             }
│   Command   │                             msg.topic = "goodwe/..."
│   Router    │                             msg.correlationId (preserved)
└──────┬──────┘                             msg.customProps (preserved)
       │
       ├── "read" ────────────┐
       ├── "discover" ────┐   │
       ├── "info" ────┐   │   │
       └── ...         │   │   │
                       ▼   ▼   ▼
                  ┌─────────────┐
                  │  Protocol   │
                  │   Handler   │
                  └──────┬──────┘
                         │
                    UDP/TCP Request
                         │
                         ▼
                    [Inverter]
                         │
                    UDP/TCP Response
                         │
                         ▼
                  ┌─────────────┐
                  │    Data     │
                  │   Parser    │
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   Output    │
                  │  Formatter  │
                  └──────┬──────┘
                         │
                         ▼
                    Output Message
```

## State Machine

```
     ┌─────────────┐
     │    Init     │
     └──────┬──────┘
            │
            ▼
     ┌─────────────┐
     │Disconnected │◀──────────────────┐
     └──────┬──────┘                   │
            │                          │
            │ connect()                │
            ▼                          │
     ┌─────────────┐    error         │
     │ Connecting  │──────────────────┤
     └──────┬──────┘                   │
            │                          │
            │ success                  │
            ▼                          │
     ┌─────────────┐    close()       │
     │  Connected  │──────────────────┘
     └──────┬──────┘
            │
            │ read()/write()
            ▼
     ┌─────────────┐    success
     │   Reading/  │──────────┐
     │   Writing   │          │
     └──────┬──────┘          │
            │                 │
            │ timeout         │
            ▼                 │
     ┌─────────────┐          │
     │  Retrying   │          │
     │  (N/MAX)    │          │
     └──────┬──────┘          │
            │                 │
            ├─ success ───────┤
            │                 │
            │ max retries     │
            ▼                 │
     ┌─────────────┐          │
     │    Error    │          │
     └──────┬──────┘          │
            │                 │
            └─────────────────┴──▶ [Connected]
```

## Status Indicators

```
┌──────────────┬──────┬───────┬─────────────────┐
│ State        │ Fill │ Shape │ Text            │
├──────────────┼──────┼───────┼─────────────────┤
│ Disconnected │ grey │ ring  │ disconnected    │
│ Connecting   │yellow│ ring  │ connecting...   │
│ Connected    │green │ dot   │ connected       │
│ Reading      │ blue │ dot   │ reading...      │
│ Writing      │ blue │ dot   │ writing...      │
│ Success      │green │ dot   │ ok (2s)         │
│ Warning      │orange│ dot   │ retry 2/3       │
│ Error        │ red  │ ring  │ error: message  │
│ Failures     │ red  │ dot   │ failures: 5     │
└──────────────┴──────┴───────┴─────────────────┘
```

## Configuration UI Layout

```
┌───────────────────────────────────────────────┐
│ Edit goodwe node                          [X] │
├───────────────────────────────────────────────┤
│                                               │
│  Name         [My GoodWe Inverter_______]    │
│                                               │
│  ━━━━━━━━ Connection Settings ━━━━━━━        │
│                                               │
│  Host         [192.168.1.100____________] *  │
│               (IP address or hostname)        │
│                                               │
│  Protocol     [UDP (port 8899)      ▼] *     │
│                                               │
│  Port         [8899_____________________] *  │
│                                               │
│  Family       [ET Series (ET, EH)   ▼] *     │
│                                               │
│  ━━━━━━━━ Advanced Settings ━━━━━━━ [+]      │
│                                               │
│  [Cancel]                            [Done]   │
└───────────────────────────────────────────────┘

When Advanced Settings expanded:

│  ━━━━━━━━ Advanced Settings ━━━━━━━ [-]      │
│                                               │
│  Timeout      [1000____________________] ms   │
│  Retries      [3_______________________]      │
│  Output       [Flat (default)       ▼]       │
│  Polling      [0_______________________] sec  │
│               (0 = manual trigger only)       │
```

## Protocol Stack

```
┌─────────────────────────────────────┐
│        Application Layer            │
│  (Node-RED Message Processing)      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Command/Data Layer             │
│  - Runtime data read/write          │
│  - Configuration read/write         │
│  - Device info query                │
│  - Discovery                        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│       Protocol Layer                │
│  - AA55 (legacy)                    │
│  - ModbusRTU over UDP               │
│  - Modbus TCP                       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      Transport Layer                │
│  - UDP (dgram)                      │
│  - TCP (net)                        │
└──────────────┬──────────────────────┘
               │
               ▼
         [GoodWe Inverter]
```

## Example Flow: Basic Reading

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ Inject   │      │  GoodWe  │      │  Debug   │
│  Node    │      │   Node   │      │   Node   │
│          │      │          │      │          │
│ Every 10s├─────▶│ Read     ├─────▶│ Display  │
│ "read"   │      │ Data     │      │ Data     │
└──────────┘      └────┬─────┘      └──────────┘
                       │
                       │ UDP/TCP
                       │ 192.168.1.100:8899
                       ▼
                  ┌─────────┐
                  │Inverter │
                  │         │
                  └─────────┘
```

## Example Flow: Dashboard Integration

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ Inject   │      │  GoodWe  │      │ Function │
│  Node    │      │   Node   │      │  Node    │
│          │      │          │      │          │
│ Every 5s ├─────▶│ Read All ├─────▶│ Extract  │
└──────────┘      └──────────┘      │ PV Power │
                                     └────┬─────┘
                                          │
                       ┌──────────────────┼──────────────┐
                       ▼                  ▼              ▼
                  ┌─────────┐      ┌─────────┐   ┌─────────┐
                  │  Gauge  │      │  Chart  │   │  Text   │
                  │  Power  │      │  Energy │   │   SoC   │
                  └─────────┘      └─────────┘   └─────────┘
```

## Error Handling Flow

```
Input Message
     │
     ▼
┌─────────┐
│ Command │
│ Process │
└────┬────┘
     │
     ▼
┌─────────┐      Success     ┌──────────┐
│ Execute ├─────────────────▶│ Format   │
│ Command │                  │ Output   │
└────┬────┘                  └──────────┘
     │                             │
     │ Timeout                     ▼
     ▼                       Output Message
┌─────────┐
│  Retry  │──┐
│ (N/MAX) │  │
└────┬────┘  │
     │       │
     │ Max   │ Success
     ▼       ▼
┌─────────┐ Back to Execute
│  Error  │
│ Output  │
└─────────┘
     │
     ▼
Error Message
```

## Data Flow: Runtime Data Read

```
Input: msg.payload = "read"
     │
     ▼
┌─────────────────────────┐
│ Parse Command           │
│ - Determine operation   │
│ - Extract parameters    │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Update Status           │
│ - "connecting..."       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Build Protocol Request  │
│ - Create command bytes  │
│ - Add checksums         │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Send to Inverter        │
│ - UDP/TCP transport     │
│ - Start timeout timer   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Wait for Response       │
│ - Receive data          │
│ - Validate format       │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Parse Response          │
│ - Extract sensor data   │
│ - Apply conversions     │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Format Output           │
│ - Build message struct  │
│ - Add metadata          │
│ - Set topic             │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Update Status           │
│ - "ok" (temporary)      │
└────────┬────────────────┘
         │
         ▼
Output: msg.payload = {
    success: true,
    data: { ... },
    ...
}
```
