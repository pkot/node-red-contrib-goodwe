/**
 * Modbus Frame Construction and Protocol Utilities
 *
 * Implements Modbus RTU (UDP), Modbus TCP, and AA55 protocol framing
 * for GoodWe inverter communication.
 *
 * Ported from the marcelblijleven/goodwe Python library.
 */

"use strict";

// ── CRC-16 Lookup Table (Modbus) ──────────────────────────────────────────────

const CRC16_TABLE = (function() {
    const table = new Uint16Array(256);
    for (let i = 0; i < 256; i++) {
        let buffer = i << 1;
        let crc = 0;
        for (let j = 8; j > 0; j--) {
            buffer >>= 1;
            if ((buffer ^ crc) & 0x0001) {
                crc = (crc >> 1) ^ 0xA001;
            } else {
                crc >>= 1;
            }
        }
        table[i] = crc;
    }
    return table;
})();

/**
 * Calculate Modbus CRC-16
 * @param {Buffer} data - Data to checksum
 * @returns {number} 16-bit CRC value (low byte first in frame)
 */
function crc16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc = (crc >> 8) ^ CRC16_TABLE[(crc ^ data[i]) & 0xFF];
    }
    return crc;
}

// ── AA55 Protocol (ES series) ─────────────────────────────────────────────────

/**
 * Calculate AA55 checksum (simple sum of all bytes, 16-bit big-endian)
 * @param {Buffer} data - Frame data (excluding checksum bytes)
 * @returns {number} 16-bit checksum
 */
function aa55Checksum(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i];
    }
    return sum & 0xFFFF;
}

/**
 * Create an AA55 protocol read request
 * @param {string} commandPayload - Hex string of command payload (e.g. "010600")
 * @returns {Buffer} Complete AA55 request frame
 */
function createAA55ReadRequest(commandPayload) {
    const payload = Buffer.from(commandPayload, "hex");
    const header = Buffer.from([0xAA, 0x55, 0xC0, 0x7F]);
    const frame = Buffer.concat([header, payload]);
    const checksum = aa55Checksum(frame);
    const checksumBuf = Buffer.alloc(2);
    checksumBuf.writeUInt16BE(checksum, 0);
    return Buffer.concat([frame, checksumBuf]);
}

/**
 * Validate an AA55 protocol response
 * @param {Buffer} data - Response data
 * @param {string} expectedResponseType - Expected response type hex (e.g. "0186")
 * @returns {{valid: boolean, error: string|null}}
 */
function validateAA55Response(data, expectedResponseType) {
    if (!data || data.length < 9) {
        return { valid: false, error: "Response too short" };
    }

    // Check header
    if (data[0] !== 0xAA || data[1] !== 0x55) {
        return { valid: false, error: "Invalid AA55 header" };
    }

    // Check response type at bytes 4-5
    if (expectedResponseType) {
        const expectedBuf = Buffer.from(expectedResponseType, "hex");
        if (data[4] !== expectedBuf[0] || data[5] !== expectedBuf[1]) {
            return { valid: false, error: `Unexpected response type: ${data[4].toString(16)}${data[5].toString(16)}` };
        }
    }

    // Verify checksum (sum of all bytes except last 2)
    const payloadEnd = data.length - 2;
    const expectedChecksum = data.readUInt16BE(payloadEnd);
    const actualChecksum = aa55Checksum(data.slice(0, payloadEnd));
    if (expectedChecksum !== actualChecksum) {
        return { valid: false, error: "Checksum mismatch" };
    }

    return { valid: true, error: null };
}

/**
 * Extract payload from AA55 response (strip 7-byte header + 2-byte checksum)
 * @param {Buffer} data - AA55 response
 * @returns {Buffer} Payload data
 */
function extractAA55Payload(data) {
    if (data.length < 9) {
        throw new Error("AA55 response too short to extract payload");
    }
    return data.slice(7, data.length - 2);
}

// ── Modbus RTU (UDP) ──────────────────────────────────────────────────────────

/**
 * Create a Modbus RTU read request
 * @param {number} commAddr - Comm address (e.g. 0xF7 for ET, 0x7F for DT)
 * @param {number} registerStart - Starting register address
 * @param {number} registerCount - Number of registers to read
 * @returns {Buffer} 8-byte Modbus RTU request frame
 */
function createRtuReadRequest(commAddr, registerStart, registerCount) {
    const frame = Buffer.alloc(6);
    frame.writeUInt8(commAddr, 0);
    frame.writeUInt8(0x03, 1);  // Function code: Read Holding Registers
    frame.writeUInt16BE(registerStart, 2);
    frame.writeUInt16BE(registerCount, 4);

    const checksum = crc16(frame);
    const crcBuf = Buffer.alloc(2);
    crcBuf.writeUInt16LE(checksum, 0);  // CRC is little-endian in Modbus RTU
    return Buffer.concat([frame, crcBuf]);
}

/**
 * Validate a Modbus RTU response from a GoodWe inverter.
 * GoodWe RTU responses are prefixed with AA55 header.
 *
 * @param {Buffer} data - Response data
 * @param {number} expectedCmd - Expected function code (0x03 for read)
 * @param {number} expectedCount - Expected register count
 * @returns {{valid: boolean, error: string|null}}
 */
function validateRtuResponse(data, expectedCmd, expectedCount) {
    if (!data || data.length < 7) {
        return { valid: false, error: "Response too short" };
    }

    // GoodWe RTU responses start with AA55
    if (data[0] !== 0xAA || data[1] !== 0x55) {
        return { valid: false, error: "Missing AA55 header in RTU response" };
    }

    // Check function code at byte 3
    if (data[3] !== expectedCmd) {
        // Error response: function code has high bit set
        if (data[3] === (expectedCmd | 0x80)) {
            const errorCode = data.length > 4 ? data[4] : 0;
            return { valid: false, error: `Modbus error response, code: ${errorCode}` };
        }
        return { valid: false, error: `Unexpected function code: 0x${data[3].toString(16)}` };
    }

    // Check byte count at byte 4
    const byteCount = data[4];
    const expectedBytes = expectedCount * 2;
    if (byteCount !== expectedBytes) {
        return { valid: false, error: `Byte count mismatch: expected ${expectedBytes}, got ${byteCount}` };
    }

    // Expected total length: 5 (AA55 + addr + cmd + bytecount) + payload + 2 (CRC)
    const expectedLength = 5 + byteCount + 2;
    if (data.length < expectedLength) {
        return { valid: false, error: `Response too short: expected ${expectedLength}, got ${data.length}` };
    }

    // Verify CRC on bytes 2..end-2 (skip AA55 header, exclude CRC)
    const crcData = data.slice(2, expectedLength - 2);
    const expectedCrc = data.readUInt16LE(expectedLength - 2);
    const actualCrc = crc16(crcData);
    if (expectedCrc !== actualCrc) {
        return { valid: false, error: "CRC mismatch" };
    }

    return { valid: true, error: null };
}

/**
 * Extract payload from Modbus RTU response (strip 5-byte header + 2-byte CRC)
 * Header: AA(1) 55(1) addr(1) cmd(1) bytecount(1)
 * @param {Buffer} data - RTU response
 * @returns {Buffer} Payload data
 */
function extractRtuPayload(data) {
    if (data.length < 7) {
        throw new Error("RTU response too short to extract payload");
    }
    const byteCount = data[4];
    return data.slice(5, 5 + byteCount);
}

// ── Modbus TCP ────────────────────────────────────────────────────────────────

let _tcpTransactionId = 0;

/**
 * Get next TCP transaction ID (1-65535, wrapping)
 * @returns {number}
 */
function nextTransactionId() {
    _tcpTransactionId = (_tcpTransactionId % 0xFFFF) + 1;
    return _tcpTransactionId;
}

/**
 * Reset TCP transaction ID counter (for testing)
 */
function resetTransactionId() {
    _tcpTransactionId = 0;
}

/**
 * Create a Modbus TCP read request
 * @param {number} commAddr - Comm address
 * @param {number} registerStart - Starting register address
 * @param {number} registerCount - Number of registers to read
 * @returns {Buffer} 12-byte Modbus TCP request frame
 */
function createTcpReadRequest(commAddr, registerStart, registerCount) {
    const txId = nextTransactionId();
    const frame = Buffer.alloc(12);
    frame.writeUInt16BE(txId, 0);         // Transaction ID
    frame.writeUInt16BE(0x0000, 2);       // Protocol ID (Modbus)
    frame.writeUInt16BE(0x0006, 4);       // Length (6 bytes follow)
    frame.writeUInt8(commAddr, 6);        // Unit ID / comm address
    frame.writeUInt8(0x03, 7);            // Function code: Read Holding Registers
    frame.writeUInt16BE(registerStart, 8);
    frame.writeUInt16BE(registerCount, 10);
    return frame;
}

/**
 * Validate a Modbus TCP response
 * @param {Buffer} data - Response data
 * @param {number} expectedCmd - Expected function code (0x03 for read)
 * @param {number} expectedCount - Expected register count
 * @returns {{valid: boolean, error: string|null}}
 */
function validateTcpResponse(data, expectedCmd, expectedCount) {
    if (!data || data.length < 9) {
        return { valid: false, error: "Response too short" };
    }

    // Check function code at byte 7
    if (data[7] !== expectedCmd) {
        if (data[7] === (expectedCmd | 0x80)) {
            const errorCode = data.length > 8 ? data[8] : 0;
            return { valid: false, error: `Modbus error response, code: ${errorCode}` };
        }
        return { valid: false, error: `Unexpected function code: 0x${data[7].toString(16)}` };
    }

    // Check byte count at byte 8
    const byteCount = data[8];
    const expectedBytes = expectedCount * 2;
    if (byteCount !== expectedBytes) {
        return { valid: false, error: `Byte count mismatch: expected ${expectedBytes}, got ${byteCount}` };
    }

    // Expected total length: 9 (MBAP header + unit + cmd + bytecount) + payload
    const expectedLength = 9 + byteCount;
    if (data.length < expectedLength) {
        return { valid: false, error: `Response too short: expected ${expectedLength}, got ${data.length}` };
    }

    return { valid: true, error: null };
}

/**
 * Extract payload from Modbus TCP response (strip 9-byte header)
 * Header: txId(2) + protocolId(2) + length(2) + unitId(1) + cmd(1) + bytecount(1)
 * @param {Buffer} data - TCP response
 * @returns {Buffer} Payload data
 */
function extractTcpPayload(data) {
    if (data.length < 9) {
        throw new Error("TCP response too short to extract payload");
    }
    const byteCount = data[8];
    return data.slice(9, 9 + byteCount);
}

// ── Default Comm Addresses ────────────────────────────────────────────────────

const DEFAULT_COMM_ADDR = {
    ET: 0xF7, EH: 0xF7, BT: 0xF7, BH: 0xF7, GEH: 0xF7,
    ES: 0xF7, EM: 0xF7, BP: 0xF7,
    DT: 0x7F, MS: 0x7F, "D-NS": 0x7F, XS: 0x7F,
};

/**
 * Get the default comm address for an inverter family
 * @param {string} family - Inverter family code
 * @returns {number} Default comm address
 */
function getDefaultCommAddr(family) {
    return DEFAULT_COMM_ADDR[family] || 0xF7;
}

// ── AA55 Commands ─────────────────────────────────────────────────────────────

const AA55_COMMANDS = {
    DISCOVERY: createAA55ReadRequest("010200"),
    READ_DEVICE_INFO: createAA55ReadRequest("010100"),
    READ_RUNNING_DATA_ES: createAA55ReadRequest("010600"),
};

module.exports = {
    // CRC
    crc16,

    // AA55
    aa55Checksum,
    createAA55ReadRequest,
    validateAA55Response,
    extractAA55Payload,
    AA55_COMMANDS,

    // Modbus RTU
    createRtuReadRequest,
    validateRtuResponse,
    extractRtuPayload,

    // Modbus TCP
    createTcpReadRequest,
    validateTcpResponse,
    extractTcpPayload,
    nextTransactionId,
    resetTransactionId,

    // Comm addresses
    DEFAULT_COMM_ADDR,
    getDefaultCommAddr,
};
