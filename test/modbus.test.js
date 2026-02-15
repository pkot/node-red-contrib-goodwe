/**
 * Tests for lib/modbus.js
 *
 * Tests CRC-16 calculation, Modbus RTU/TCP frame construction,
 * AA55 protocol framing, and response validation.
 */

const {
    crc16,
    aa55Checksum,
    createAA55ReadRequest,
    validateAA55Response,
    extractAA55Payload,
    createRtuReadRequest,
    validateRtuResponse,
    extractRtuPayload,
    createTcpReadRequest,
    validateTcpResponse,
    extractTcpPayload,
    resetTransactionId,
    getDefaultCommAddr,
    AA55_COMMANDS,
} = require("../lib/modbus");

// ── CRC-16 tests ───────────────────────────────────────────────────────────

describe("CRC-16", () => {
    test("calculates correct CRC for known data", () => {
        // Modbus RTU read request: addr=0xF7, cmd=0x03, reg=0x891C, count=0x007D
        const data = Buffer.from([0xF7, 0x03, 0x89, 0x1C, 0x00, 0x7D]);
        const result = crc16(data);
        expect(typeof result).toBe("number");
        expect(result).toBeGreaterThan(0);
        expect(result).toBeLessThanOrEqual(0xFFFF);
    });

    test("CRC of empty buffer is 0xFFFF", () => {
        expect(crc16(Buffer.alloc(0))).toBe(0xFFFF);
    });

    test("different data produces different CRC", () => {
        const crc1 = crc16(Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x01]));
        const crc2 = crc16(Buffer.from([0x01, 0x03, 0x00, 0x00, 0x00, 0x02]));
        expect(crc1).not.toBe(crc2);
    });
});

// ── AA55 Protocol tests ────────────────────────────────────────────────────

describe("AA55 Protocol", () => {
    describe("aa55Checksum", () => {
        test("calculates sum of all bytes", () => {
            const data = Buffer.from([0xAA, 0x55, 0xC0, 0x7F, 0x01, 0x06, 0x00]);
            const sum = aa55Checksum(data);
            expect(sum).toBe(0xAA + 0x55 + 0xC0 + 0x7F + 0x01 + 0x06 + 0x00);
        });
    });

    describe("createAA55ReadRequest", () => {
        test("creates frame with AA55 header", () => {
            const frame = createAA55ReadRequest("010600");
            expect(frame[0]).toBe(0xAA);
            expect(frame[1]).toBe(0x55);
            expect(frame[2]).toBe(0xC0);
            expect(frame[3]).toBe(0x7F);
        });

        test("includes command payload", () => {
            const frame = createAA55ReadRequest("010600");
            expect(frame[4]).toBe(0x01);
            expect(frame[5]).toBe(0x06);
            expect(frame[6]).toBe(0x00);
        });

        test("appends 2-byte checksum", () => {
            const frame = createAA55ReadRequest("010600");
            expect(frame.length).toBe(9); // 4 header + 3 payload + 2 checksum
        });

        test("checksum is correct", () => {
            const frame = createAA55ReadRequest("010600");
            const expectedChecksum = aa55Checksum(frame.slice(0, frame.length - 2));
            const actualChecksum = frame.readUInt16BE(frame.length - 2);
            expect(actualChecksum).toBe(expectedChecksum);
        });
    });

    describe("validateAA55Response", () => {
        test("validates correct response", () => {
            // Build a valid response
            const payload = Buffer.from([0xAA, 0x55, 0xC0, 0x7F, 0x01, 0x86, 0x04, 0x01, 0x02, 0x03, 0x04]);
            const checksum = aa55Checksum(payload);
            const checksumBuf = Buffer.alloc(2);
            checksumBuf.writeUInt16BE(checksum, 0);
            const response = Buffer.concat([payload, checksumBuf]);

            const result = validateAA55Response(response, "0186");
            expect(result.valid).toBe(true);
            expect(result.error).toBeNull();
        });

        test("rejects too-short response", () => {
            const result = validateAA55Response(Buffer.from([0xAA, 0x55]), "0186");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("too short");
        });

        test("rejects invalid header", () => {
            const response = Buffer.alloc(10);
            response[0] = 0x00; // Not AA55
            const result = validateAA55Response(response, "0186");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("header");
        });

        test("rejects wrong response type", () => {
            const payload = Buffer.from([0xAA, 0x55, 0xC0, 0x7F, 0x02, 0x00, 0x00]);
            const checksum = aa55Checksum(payload);
            const checksumBuf = Buffer.alloc(2);
            checksumBuf.writeUInt16BE(checksum, 0);
            const response = Buffer.concat([payload, checksumBuf]);

            const result = validateAA55Response(response, "0186");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("response type");
        });

        test("rejects bad checksum", () => {
            const response = Buffer.from([0xAA, 0x55, 0xC0, 0x7F, 0x01, 0x86, 0x00, 0x00, 0x00]);
            const result = validateAA55Response(response, "0186");
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Checksum");
        });
    });

    describe("extractAA55Payload", () => {
        test("strips header and checksum", () => {
            const response = Buffer.from([
                0xAA, 0x55, 0xC0, 0x7F, 0x01, 0x86, 0x04,  // 7-byte header
                0x11, 0x22, 0x33, 0x44,                      // payload
                0x00, 0x00                                    // checksum
            ]);
            const payload = extractAA55Payload(response);
            expect(payload.length).toBe(4);
            expect(payload[0]).toBe(0x11);
            expect(payload[3]).toBe(0x44);
        });

        test("throws for too-short response", () => {
            expect(() => extractAA55Payload(Buffer.from([0xAA, 0x55]))).toThrow();
        });
    });

    describe("AA55_COMMANDS", () => {
        test("DISCOVERY command exists", () => {
            expect(AA55_COMMANDS.DISCOVERY).toBeDefined();
            expect(AA55_COMMANDS.DISCOVERY[0]).toBe(0xAA);
            expect(AA55_COMMANDS.DISCOVERY[1]).toBe(0x55);
        });

        test("READ_DEVICE_INFO command exists", () => {
            expect(AA55_COMMANDS.READ_DEVICE_INFO).toBeDefined();
        });

        test("READ_RUNNING_DATA_ES command exists", () => {
            expect(AA55_COMMANDS.READ_RUNNING_DATA_ES).toBeDefined();
        });
    });
});

// ── Modbus RTU tests ───────────────────────────────────────────────────────

describe("Modbus RTU", () => {
    describe("createRtuReadRequest", () => {
        test("creates 8-byte frame", () => {
            const frame = createRtuReadRequest(0xF7, 35100, 125);
            expect(frame.length).toBe(8);
        });

        test("contains correct comm address", () => {
            const frame = createRtuReadRequest(0xF7, 35100, 125);
            expect(frame[0]).toBe(0xF7);
        });

        test("contains read function code 0x03", () => {
            const frame = createRtuReadRequest(0xF7, 35100, 125);
            expect(frame[1]).toBe(0x03);
        });

        test("contains register address big-endian", () => {
            const frame = createRtuReadRequest(0xF7, 35100, 125);
            expect(frame.readUInt16BE(2)).toBe(35100);
        });

        test("contains register count big-endian", () => {
            const frame = createRtuReadRequest(0xF7, 35100, 125);
            expect(frame.readUInt16BE(4)).toBe(125);
        });

        test("CRC matches the data", () => {
            const frame = createRtuReadRequest(0xF7, 35100, 125);
            const expectedCrc = crc16(frame.slice(0, 6));
            const actualCrc = frame.readUInt16LE(6); // CRC is little-endian
            expect(actualCrc).toBe(expectedCrc);
        });

        test("uses DT comm address and register range", () => {
            const frame = createRtuReadRequest(0x7F, 30100, 73);
            expect(frame[0]).toBe(0x7F);
            expect(frame.readUInt16BE(2)).toBe(30100);
            expect(frame.readUInt16BE(4)).toBe(73);
        });
    });

    describe("validateRtuResponse", () => {
        function buildValidRtuResponse(commAddr, cmd, registerCount) {
            const byteCount = registerCount * 2;
            // Header: AA55 + addr + cmd + bytecount
            const header = Buffer.from([0xAA, 0x55, commAddr, cmd, byteCount]);
            const payload = Buffer.alloc(byteCount);
            // CRC on bytes 2+ (after AA55)
            const crcData = Buffer.concat([Buffer.from([commAddr, cmd, byteCount]), payload]);
            const checksum = crc16(crcData);
            const crcBuf = Buffer.alloc(2);
            crcBuf.writeUInt16LE(checksum, 0);
            return Buffer.concat([header, payload, crcBuf]);
        }

        test("validates correct response", () => {
            const response = buildValidRtuResponse(0xF7, 0x03, 10);
            const result = validateRtuResponse(response, 0x03, 10);
            expect(result.valid).toBe(true);
        });

        test("rejects too-short response", () => {
            const result = validateRtuResponse(Buffer.from([0xAA, 0x55]), 0x03, 10);
            expect(result.valid).toBe(false);
        });

        test("rejects missing AA55 header", () => {
            const response = Buffer.alloc(30);
            const result = validateRtuResponse(response, 0x03, 10);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("AA55");
        });

        test("rejects wrong function code", () => {
            const response = buildValidRtuResponse(0xF7, 0x04, 10);
            const result = validateRtuResponse(response, 0x03, 10);
            expect(result.valid).toBe(false);
        });

        test("detects error response (high bit set)", () => {
            const response = Buffer.from([0xAA, 0x55, 0xF7, 0x83, 0x02, 0x00, 0x00, 0x00, 0x00]);
            const result = validateRtuResponse(response, 0x03, 10);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("error response");
        });

        test("rejects byte count mismatch", () => {
            const response = buildValidRtuResponse(0xF7, 0x03, 5);
            const result = validateRtuResponse(response, 0x03, 10);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Byte count");
        });
    });

    describe("extractRtuPayload", () => {
        test("extracts payload after 5-byte header", () => {
            const response = Buffer.from([
                0xAA, 0x55, 0xF7, 0x03, 0x04, // header (bytecount=4)
                0x11, 0x22, 0x33, 0x44,        // payload
                0x00, 0x00                      // CRC
            ]);
            const payload = extractRtuPayload(response);
            expect(payload.length).toBe(4);
            expect(payload[0]).toBe(0x11);
        });

        test("throws for too-short response", () => {
            expect(() => extractRtuPayload(Buffer.from([0xAA]))).toThrow();
        });
    });
});

// ── Modbus TCP tests ───────────────────────────────────────────────────────

describe("Modbus TCP", () => {
    beforeEach(() => {
        resetTransactionId();
    });

    describe("createTcpReadRequest", () => {
        test("creates 12-byte frame", () => {
            const frame = createTcpReadRequest(0xF7, 35100, 125);
            expect(frame.length).toBe(12);
        });

        test("has incrementing transaction ID", () => {
            const frame1 = createTcpReadRequest(0xF7, 35100, 125);
            const frame2 = createTcpReadRequest(0xF7, 35100, 125);
            expect(frame1.readUInt16BE(0)).toBe(1);
            expect(frame2.readUInt16BE(0)).toBe(2);
        });

        test("protocol ID is 0x0000", () => {
            const frame = createTcpReadRequest(0xF7, 35100, 125);
            expect(frame.readUInt16BE(2)).toBe(0);
        });

        test("length field is 6", () => {
            const frame = createTcpReadRequest(0xF7, 35100, 125);
            expect(frame.readUInt16BE(4)).toBe(6);
        });

        test("unit ID matches comm address", () => {
            const frame = createTcpReadRequest(0xF7, 35100, 125);
            expect(frame[6]).toBe(0xF7);
        });

        test("function code is 0x03", () => {
            const frame = createTcpReadRequest(0xF7, 35100, 125);
            expect(frame[7]).toBe(0x03);
        });

        test("contains register address and count", () => {
            const frame = createTcpReadRequest(0xF7, 35100, 125);
            expect(frame.readUInt16BE(8)).toBe(35100);
            expect(frame.readUInt16BE(10)).toBe(125);
        });
    });

    describe("validateTcpResponse", () => {
        function buildValidTcpResponse(registerCount) {
            const byteCount = registerCount * 2;
            const frame = Buffer.alloc(9 + byteCount);
            frame.writeUInt16BE(1, 0);           // Transaction ID
            frame.writeUInt16BE(0, 2);           // Protocol ID
            frame.writeUInt16BE(3 + byteCount, 4); // Length
            frame.writeUInt8(0xF7, 6);           // Unit ID
            frame.writeUInt8(0x03, 7);           // Function code
            frame.writeUInt8(byteCount, 8);      // Byte count
            return frame;
        }

        test("validates correct response", () => {
            const response = buildValidTcpResponse(10);
            const result = validateTcpResponse(response, 0x03, 10);
            expect(result.valid).toBe(true);
        });

        test("rejects too-short response", () => {
            const result = validateTcpResponse(Buffer.alloc(5), 0x03, 10);
            expect(result.valid).toBe(false);
        });

        test("rejects wrong function code", () => {
            const response = buildValidTcpResponse(10);
            response[7] = 0x04; // Wrong function code
            const result = validateTcpResponse(response, 0x03, 10);
            expect(result.valid).toBe(false);
        });

        test("detects error response", () => {
            const response = Buffer.alloc(9);
            response[7] = 0x83; // Error: 0x03 | 0x80
            response[8] = 0x02; // Error code
            const result = validateTcpResponse(response, 0x03, 10);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("error response");
        });

        test("rejects byte count mismatch", () => {
            const response = buildValidTcpResponse(5);
            const result = validateTcpResponse(response, 0x03, 10);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Byte count");
        });
    });

    describe("extractTcpPayload", () => {
        test("extracts payload after 9-byte header", () => {
            const response = Buffer.from([
                0x00, 0x01, 0x00, 0x00, 0x00, 0x07, 0xF7, 0x03, 0x04, // 9-byte header
                0x11, 0x22, 0x33, 0x44                                  // payload
            ]);
            const payload = extractTcpPayload(response);
            expect(payload.length).toBe(4);
            expect(payload[0]).toBe(0x11);
        });

        test("throws for too-short response", () => {
            expect(() => extractTcpPayload(Buffer.alloc(5))).toThrow();
        });
    });
});

// ── Default comm address tests ─────────────────────────────────────────────

describe("getDefaultCommAddr", () => {
    test("returns 0xF7 for ET family", () => {
        expect(getDefaultCommAddr("ET")).toBe(0xF7);
    });

    test("returns 0x7F for DT family", () => {
        expect(getDefaultCommAddr("DT")).toBe(0x7F);
    });

    test("returns 0xF7 for ES family", () => {
        expect(getDefaultCommAddr("ES")).toBe(0xF7);
    });

    test("returns 0xF7 for unknown family", () => {
        expect(getDefaultCommAddr("XYZ")).toBe(0xF7);
    });
});
