# GoodWe Protocol Library

This directory contains the core protocol implementation for communicating with GoodWe inverters.

## Files

### protocol.js

The main protocol handler module that implements UDP and TCP/Modbus communication protocols.

#### Features

- **UDP Protocol Support**: Communication via UDP on port 8899 (default)
- **TCP/Modbus Support**: Communication via TCP on port 502
- **Connection Management**: Automatic connection lifecycle handling
- **Retry Logic**: Exponential backoff retry mechanism
- **Error Handling**: Comprehensive error detection and reporting
- **Event-Driven**: Uses EventEmitter for status updates
- **Discovery**: Network broadcast discovery of inverters

#### Classes

##### ProtocolHandler

Main class for handling inverter communication.

**Constructor:**
```javascript
const handler = new ProtocolHandler({
    host: "192.168.1.100",  // Required
    port: 8899,             // Default: 8899
    protocol: "udp",        // Default: "udp", options: "udp", "tcp", "modbus"
    timeout: 1000,          // Default: 1000ms
    retries: 3              // Default: 3
});
```

**Methods:**

- `connect()`: Establishes connection to inverter (returns Promise)
- `disconnect()`: Closes connection (returns Promise)
- `sendCommand(buffer, expectedLength)`: Sends command and waits for response
- `sendCommandWithRetry(buffer, expectedLength)`: Sends command with retry logic
- `getStatus()`: Returns current connection status

**Events:**

- `status`: Emitted when connection status changes
  - States: `connecting`, `connected`, `disconnected`, `reading`, `retrying`
- `error`: Emitted when errors occur

**Example:**
```javascript
const { ProtocolHandler } = require("./lib/protocol.js");

const handler = new ProtocolHandler({
    host: "192.168.1.100",
    protocol: "udp"
});

// Listen to status changes
handler.on("status", (status) => {
    console.log("Status:", status.state);
});

// Connect and send command
await handler.connect();
const response = await handler.sendCommandWithRetry(commandBuffer);
await handler.disconnect();
```

#### Functions

##### discoverInverters(options)

Discovers GoodWe inverters on the local network using UDP broadcast.

**Parameters:**
```javascript
{
    timeout: 5000,                      // Discovery timeout in ms (default: 5000)
    broadcastAddress: "255.255.255.255" // Broadcast address (default: 255.255.255.255)
}
```

**Returns:**
```javascript
Promise<Array<{
    ip: string,           // Inverter IP address
    port: number,         // Communication port
    family: string,       // Inverter family (e.g., "ET")
    serialNumber: string, // Serial number
    modelName: string     // Model name
}>>
```

**Example:**
```javascript
const { discoverInverters } = require("./lib/protocol.js");

const inverters = await discoverInverters({ timeout: 5000 });
console.log(`Found ${inverters.length} inverter(s)`);
inverters.forEach(inv => {
    console.log(`- ${inv.modelName} at ${inv.ip}`);
});
```

## Protocol Details

### AA55 Protocol

The AA55 protocol is used for UDP communication on port 8899. It's a binary protocol with the following structure:

```
Header (2 bytes): AA 55
Address (1 byte): Device address (0x7F or 0xF7)
Command (1 byte): Command code
Length (2 bytes): Payload length
Payload (N bytes): Command data
Checksum (2 bytes): CRC checksum
```

**Discovery Command:**
```
AA 55 C0 7F 01 02 00 02
```

**Device Info Command:**
```
AA 55 C0 7F 01 01 00 02
```

### Modbus Protocol

The Modbus protocol is used for TCP communication on port 502. It follows the standard Modbus TCP protocol specification.

## Error Handling

The protocol handler implements comprehensive error handling:

### Error Codes

- `TIMEOUT`: No response received within timeout period
- `ECONNREFUSED`: Connection refused by inverter
- `EPERM`: Operation not permitted (e.g., broadcast in restricted environment)
- `EHOSTUNREACH`: Host unreachable
- `ENETUNREACH`: Network unreachable

### Retry Logic

The `sendCommandWithRetry` method implements exponential backoff:

1. First attempt: immediate
2. Second attempt: 1 second delay
3. Third attempt: 2 seconds delay
4. Additional attempts: up to 5 seconds delay

### Connection Status Tracking

The handler tracks:
- **connected**: Current connection state
- **consecutiveFailures**: Number of consecutive failed attempts
- **lastError**: Most recent error message

## Testing

The protocol library is thoroughly tested with:

- Connection tests (UDP and TCP)
- Timeout handling tests
- Retry logic tests
- Discovery tests
- Error handling tests

Run tests with:
```bash
npm test -- test/connectivity.test.js
npm test -- test/discovery.test.js
```

## Future Enhancements

Planned improvements:

1. **Connection Pooling**: Reuse connections across multiple requests
2. **Enhanced Discovery**: Parse detailed inverter information from responses
3. **Protocol Variants**: Support for different GoodWe protocol versions
4. **Authentication**: Support for password-protected inverters
5. **Keep-Alive**: Maintain persistent connections

## References

- [marcelblijleven/goodwe Python Library](https://github.com/marcelblijleven/goodwe)
- [GoodWe Protocol Documentation](https://github.com/marcelblijleven/goodwe/tree/master/goodwe/protocols)
- [Modbus TCP Specification](https://modbus.org/specs.php)
