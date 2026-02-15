/**
 * Tests for lib/sensors.js
 *
 * Tests sensor data type readers, per-family sensor definitions,
 * and the parseSensorData function.
 */

const {
    Kind,
    typeReaders,
    getSensors,
    getFamilyConfig,
    parseSensorData,
    buildSensorMetadata,
    ET_SENSORS,
    DT_SENSORS,
    ES_SENSORS,
    ET_REGISTER_START,
    DT_REGISTER_START,
    readBytes2,
    readBytes2Signed,
    readBytes4,
    readBytes4Signed,
    readByte
} = require("../lib/sensors");

// ── Low-level reader tests ──────────────────────────────────────────────────

describe("Low-level byte readers", () => {
    test("readBytes2 reads unsigned 16-bit big-endian", () => {
        const buf = Buffer.from([0x09, 0x99]); // 2457
        expect(readBytes2(buf, 0)).toBe(2457);
    });

    test("readBytes2 returns null for 0xFFFF sentinel", () => {
        const buf = Buffer.from([0xFF, 0xFF]);
        expect(readBytes2(buf, 0)).toBeNull();
    });

    test("readBytes2 returns null for out-of-bounds offset", () => {
        const buf = Buffer.from([0x01]);
        expect(readBytes2(buf, 0)).toBeNull();
    });

    test("readBytes2Signed reads signed 16-bit big-endian", () => {
        const buf = Buffer.from([0xFF, 0xCE]); // -50
        expect(readBytes2Signed(buf, 0)).toBe(-50);
    });

    test("readBytes2Signed reads positive signed value", () => {
        const buf = Buffer.from([0x00, 0x32]); // 50
        expect(readBytes2Signed(buf, 0)).toBe(50);
    });

    test("readBytes2Signed returns null for 0xFFFF sentinel", () => {
        const buf = Buffer.from([0xFF, 0xFF]);
        expect(readBytes2Signed(buf, 0)).toBeNull();
    });

    test("readBytes4 reads unsigned 32-bit big-endian", () => {
        const buf = Buffer.from([0x00, 0x03, 0x03, 0x09]); // 197385
        expect(readBytes4(buf, 0)).toBe(197385);
    });

    test("readBytes4 returns null for 0xFFFFFFFF sentinel", () => {
        const buf = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);
        expect(readBytes4(buf, 0)).toBeNull();
    });

    test("readBytes4Signed reads negative 32-bit value", () => {
        const buf = Buffer.alloc(4);
        buf.writeInt32BE(-12345, 0);
        expect(readBytes4Signed(buf, 0)).toBe(-12345);
    });

    test("readByte reads single unsigned byte", () => {
        const buf = Buffer.from([0x55]);
        expect(readByte(buf, 0)).toBe(0x55);
    });

    test("readByte returns null for out-of-bounds", () => {
        const buf = Buffer.from([]);
        expect(readByte(buf, 0)).toBeNull();
    });
});

// ── Type reader tests ───────────────────────────────────────────────────────

describe("Sensor type readers", () => {
    test("Voltage: divides by 10", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(2455, 0); // 245.5V
        expect(typeReaders.Voltage(buf, 0)).toBeCloseTo(245.5);
    });

    test("Current: divides by 10", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(82, 0); // 8.2A
        expect(typeReaders.Current(buf, 0)).toBeCloseTo(8.2);
    });

    test("CurrentS: signed, divides by 10", () => {
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(-50, 0); // -5.0A (charging)
        expect(typeReaders.CurrentS(buf, 0)).toBeCloseTo(-5.0);
    });

    test("Frequency: divides by 100", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(5000, 0); // 50.00Hz
        expect(typeReaders.Frequency(buf, 0)).toBeCloseTo(50.0);
    });

    test("Power: raw unsigned 16-bit", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(2875, 0);
        expect(typeReaders.Power(buf, 0)).toBe(2875);
    });

    test("PowerS: signed 16-bit", () => {
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(-256, 0);
        expect(typeReaders.PowerS(buf, 0)).toBe(-256);
    });

    test("Power4: unsigned 32-bit", () => {
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(50000, 0);
        expect(typeReaders.Power4(buf, 0)).toBe(50000);
    });

    test("Power4S: signed 32-bit", () => {
        const buf = Buffer.alloc(4);
        buf.writeInt32BE(-1500, 0);
        expect(typeReaders.Power4S(buf, 0)).toBe(-1500);
    });

    test("Energy: divides by 10", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(125, 0); // 12.5 kWh
        expect(typeReaders.Energy(buf, 0)).toBeCloseTo(12.5);
    });

    test("Energy4: 32-bit, divides by 10", () => {
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(12345, 0); // 1234.5 kWh
        expect(typeReaders.Energy4(buf, 0)).toBeCloseTo(1234.5);
    });

    test("Temp: signed, divides by 10", () => {
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(425, 0); // 42.5°C
        expect(typeReaders.Temp(buf, 0)).toBeCloseTo(42.5);
    });

    test("Temp: returns null for -1 sentinel", () => {
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(-1, 0);
        expect(typeReaders.Temp(buf, 0)).toBeNull();
    });

    test("Temp: returns null for 32767 sentinel", () => {
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(32767, 0);
        expect(typeReaders.Temp(buf, 0)).toBeNull();
    });

    test("Byte: single unsigned byte", () => {
        const buf = Buffer.from([0x55]);
        expect(typeReaders.Byte(buf, 0)).toBe(0x55);
    });

    test("ByteH: high byte of 16-bit value", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(0x1234, 0);
        expect(typeReaders.ByteH(buf, 0)).toBe(0x12);
    });

    test("ByteL: low byte of 16-bit value", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(0x1234, 0);
        expect(typeReaders.ByteL(buf, 0)).toBe(0x34);
    });

    test("Integer: unsigned 16-bit", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(12345, 0);
        expect(typeReaders.Integer(buf, 0)).toBe(12345);
    });

    test("Long: unsigned 32-bit", () => {
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(2468, 0);
        expect(typeReaders.Long(buf, 0)).toBe(2468);
    });

    test("Decimal: signed / scale", () => {
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(950, 0); // 0.95 with scale 1000
        expect(typeReaders.Decimal(buf, 0, { scale: 1000 })).toBeCloseTo(0.95);
    });

    test("Timestamp: parses 6 bytes to ISO string", () => {
        const buf = Buffer.from([25, 11, 2, 12, 30, 45]); // 2025-11-02 12:30:45
        const result = typeReaders.Timestamp(buf, 0);
        expect(result).toContain("2025");
        expect(typeof result).toBe("string");
    });

    test("Timestamp: returns null for insufficient data", () => {
        const buf = Buffer.from([25, 11]);
        expect(typeReaders.Timestamp(buf, 0)).toBeNull();
    });

    test("Apparent: unsigned 16-bit", () => {
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(3000, 0);
        expect(typeReaders.Apparent(buf, 0)).toBe(3000);
    });

    test("Reactive: signed 16-bit", () => {
        const buf = Buffer.alloc(2);
        buf.writeInt16BE(-150, 0);
        expect(typeReaders.Reactive(buf, 0)).toBe(-150);
    });
});

// ── getSensors tests ────────────────────────────────────────────────────────

describe("getSensors", () => {
    test("returns ET sensors for ET family", () => {
        const sensors = getSensors("ET");
        expect(sensors).toBe(ET_SENSORS);
        expect(sensors.length).toBeGreaterThan(30);
    });

    test("returns ET sensors for EH family (alias)", () => {
        expect(getSensors("EH")).toBe(ET_SENSORS);
    });

    test("returns DT sensors for DT family", () => {
        const sensors = getSensors("DT");
        expect(sensors).toBe(DT_SENSORS);
    });

    test("returns DT sensors for MS family (alias)", () => {
        expect(getSensors("MS")).toBe(DT_SENSORS);
    });

    test("returns ES sensors for ES family", () => {
        const sensors = getSensors("ES");
        expect(sensors).toBe(ES_SENSORS);
    });

    test("returns ES sensors for EM family (alias)", () => {
        expect(getSensors("EM")).toBe(ES_SENSORS);
    });

    test("throws for unknown family", () => {
        expect(() => getSensors("XYZ")).toThrow("Unsupported inverter family");
    });
});

// ── getFamilyConfig tests ───────────────────────────────────────────────────

describe("getFamilyConfig", () => {
    test("returns config with register info for ET", () => {
        const config = getFamilyConfig("ET");
        expect(config.registerStart).toBe(35100);
        expect(config.registerCount).toBe(125);
        expect(config.protocol).toBe("modbus");
        expect(config.sensors).toBe(ET_SENSORS);
    });

    test("returns config with register info for DT", () => {
        const config = getFamilyConfig("DT");
        expect(config.registerStart).toBe(30100);
        expect(config.registerCount).toBe(73);
        expect(config.protocol).toBe("modbus");
    });

    test("returns config for ES with aa55 protocol", () => {
        const config = getFamilyConfig("ES");
        expect(config.protocol).toBe("aa55");
        expect(config.registerStart).toBeUndefined();
    });

    test("returns null for unknown family", () => {
        expect(getFamilyConfig("XYZ")).toBeNull();
    });
});

// ── parseSensorData tests ───────────────────────────────────────────────────

describe("parseSensorData", () => {
    test("parses ET sensor data from register buffer", () => {
        // Create a buffer representing 250 bytes of register data (125 registers)
        const buf = Buffer.alloc(250);

        // vpv1 at register 35103, byte offset = (35103-35100)*2 = 6
        buf.writeUInt16BE(2455, 6); // 245.5V

        // ipv1 at register 35104, byte offset = (35104-35100)*2 = 8
        buf.writeUInt16BE(82, 8); // 8.2A

        // ppv1 at register 35105, byte offset = (35105-35100)*2 = 10 (Power4, 4 bytes)
        buf.writeUInt32BE(2013, 10); // 2013W

        // vgrid at register 35121, byte offset = (35121-35100)*2 = 42
        buf.writeUInt16BE(2301, 42); // 230.1V

        // fgrid at register 35123, byte offset = (35123-35100)*2 = 46
        buf.writeUInt16BE(5000, 46); // 50.00Hz

        // temperature at register 35176, byte offset = (35176-35100)*2 = 152
        buf.writeInt16BE(425, 152); // 42.5°C

        // e_day at register 35193, byte offset = (35193-35100)*2 = 186
        buf.writeUInt32BE(125, 186); // 12.5 kWh (Energy4)

        // e_total at register 35191, byte offset = (35191-35100)*2 = 182
        buf.writeUInt32BE(12345, 182); // 1234.5 kWh (Energy4)

        const result = parseSensorData(ET_SENSORS, buf, ET_REGISTER_START);

        expect(result.vpv1).toBeCloseTo(245.5);
        expect(result.ipv1).toBeCloseTo(8.2);
        expect(result.ppv1).toBe(2013);
        expect(result.vgrid).toBeCloseTo(230.1);
        expect(result.fgrid).toBeCloseTo(50.0);
        expect(result.temperature).toBeCloseTo(42.5);
        expect(result.e_day).toBeCloseTo(12.5);
        expect(result.e_total).toBeCloseTo(1234.5);
    });

    test("parses DT sensor data from register buffer", () => {
        const buf = Buffer.alloc(146);

        // vpv1 at register 30103, byte offset = (30103-30100)*2 = 6
        buf.writeUInt16BE(3802, 6); // 380.2V

        // total_inverter_power at register 30127, byte offset = (30127-30100)*2 = 54
        buf.writeUInt32BE(29000, 54); // 29000W (Power4)

        // temperature at register 30141, byte offset = (30141-30100)*2 = 82
        buf.writeInt16BE(385, 82); // 38.5°C

        // e_day at register 30144, byte offset = (30144-30100)*2 = 88
        buf.writeUInt16BE(152, 88); // 15.2 kWh (Energy)

        const result = parseSensorData(DT_SENSORS, buf, DT_REGISTER_START);

        expect(result.vpv1).toBeCloseTo(380.2);
        expect(result.total_inverter_power).toBe(29000);
        expect(result.temperature).toBeCloseTo(38.5);
        expect(result.e_day).toBeCloseTo(15.2);
    });

    test("parses ES sensor data from byte-offset buffer", () => {
        const buf = Buffer.alloc(93);

        // vpv1 at byte offset 0
        buf.writeUInt16BE(2455, 0); // 245.5V

        // ipv1 at byte offset 2
        buf.writeUInt16BE(82, 2); // 8.2A

        // vbattery1 at byte offset 10
        buf.writeUInt16BE(512, 10); // 51.2V

        // battery_soc at byte offset 26
        buf.writeUInt8(85, 26); // 85%

        // vgrid at byte offset 34
        buf.writeUInt16BE(2301, 34); // 230.1V

        // temperature at byte offset 53
        buf.writeInt16BE(425, 53); // 42.5°C

        // e_day at byte offset 67
        buf.writeUInt16BE(125, 67); // 12.5 kWh

        const result = parseSensorData(ES_SENSORS, buf, null);

        expect(result.vpv1).toBeCloseTo(245.5);
        expect(result.ipv1).toBeCloseTo(8.2);
        expect(result.vbattery1).toBeCloseTo(51.2);
        expect(result.battery_soc).toBe(85);
        expect(result.vgrid).toBeCloseTo(230.1);
        expect(result.temperature).toBeCloseTo(42.5);
        expect(result.e_day).toBeCloseTo(12.5);
    });

    test("skips sensors with null offset", () => {
        const sensors = [
            { id: "real", offset: 0, type: "Voltage", size: 2, kind: Kind.PV, unit: "V", name: "Real" },
            { id: "calculated", offset: null, type: null, size: 0, kind: Kind.PV, unit: "W", name: "Calc" },
        ];
        const buf = Buffer.alloc(2);
        buf.writeUInt16BE(2455, 0);

        const result = parseSensorData(sensors, buf, null);
        expect(result.real).toBeCloseTo(245.5);
        expect(result.calculated).toBeUndefined();
    });

    test("skips sensors with sentinel values", () => {
        const buf = Buffer.alloc(4);
        buf.writeUInt16BE(0xFFFF, 0); // sentinel
        buf.writeUInt16BE(2455, 2);   // valid

        const sensors = [
            { id: "bad", offset: 0, type: "Voltage", size: 2, kind: Kind.PV, unit: "V", name: "Bad" },
            { id: "good", offset: 2, type: "Voltage", size: 2, kind: Kind.PV, unit: "V", name: "Good" },
        ];

        const result = parseSensorData(sensors, buf, null);
        expect(result.bad).toBeUndefined();
        expect(result.good).toBeCloseTo(245.5);
    });

    test("handles empty buffer gracefully", () => {
        const buf = Buffer.alloc(0);
        const result = parseSensorData(ET_SENSORS, buf, ET_REGISTER_START);
        expect(Object.keys(result).length).toBe(0);
    });
});

// ── buildSensorMetadata tests ───────────────────────────────────────────────

describe("buildSensorMetadata", () => {
    test("builds metadata from ET sensors", () => {
        const metadata = buildSensorMetadata(ET_SENSORS);
        expect(metadata.vpv1).toEqual({
            name: "PV1 Voltage",
            unit: "V",
            kind: "PV",
            category: "pv"
        });
    });

    test("maps Kind.AC to grid category", () => {
        const metadata = buildSensorMetadata(ET_SENSORS);
        expect(metadata.vgrid.category).toBe("grid");
    });

    test("maps Kind.BAT to battery category", () => {
        const metadata = buildSensorMetadata(ET_SENSORS);
        expect(metadata.vbattery1.category).toBe("battery");
    });

    test("maps Kind.UPS to ups category", () => {
        const metadata = buildSensorMetadata(ET_SENSORS);
        expect(metadata.backup_v1.category).toBe("ups");
    });

    test("maps null kind to status category", () => {
        const metadata = buildSensorMetadata(ET_SENSORS);
        expect(metadata.work_mode.category).toBe("status");
    });

    test("covers all sensor IDs in ET", () => {
        const metadata = buildSensorMetadata(ET_SENSORS);
        ET_SENSORS.forEach(sensor => {
            expect(metadata[sensor.id]).toBeDefined();
        });
    });
});
