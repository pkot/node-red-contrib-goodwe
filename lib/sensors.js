/**
 * GoodWe Sensor Definitions and Data Type Parsers
 *
 * Ported from the marcelblijleven/goodwe Python library.
 * Defines per-family sensor register maps and reading functions.
 */

"use strict";

// ── Sensor Kind Constants ──────────────────────────────────────────────────────

const Kind = {
    PV: "PV",
    AC: "AC",
    UPS: "UPS",
    BAT: "BAT",
    GRID: "GRID"
};

// ── Data Type Readers ──────────────────────────────────────────────────────────
// All use big-endian byte order. Return null for sentinel values (0xFFFF / 0xFFFFFFFF).

function readBytes2(data, offset) {
    if (offset + 2 > data.length) return null;
    const val = data.readUInt16BE(offset);
    return val === 0xFFFF ? null : val;
}

function readBytes2Signed(data, offset) {
    if (offset + 2 > data.length) return null;
    const raw = data.readUInt16BE(offset);
    if (raw === 0xFFFF) return null;
    return data.readInt16BE(offset);
}

function readBytes4(data, offset) {
    if (offset + 4 > data.length) return null;
    const val = data.readUInt32BE(offset);
    return val === 0xFFFFFFFF ? null : val;
}

function readBytes4Signed(data, offset) {
    if (offset + 4 > data.length) return null;
    const raw = data.readUInt32BE(offset);
    if (raw === 0xFFFFFFFF) return null;
    return data.readInt32BE(offset);
}

function readByte(data, offset) {
    if (offset >= data.length) return null;
    return data.readUInt8(offset);
}

// ── Sensor Type Reader Map ─────────────────────────────────────────────────────
// Each entry: (data, byteOffset) => parsed value

const typeReaders = {
    Voltage:    (data, off) => { const v = readBytes2(data, off); return v !== null ? v / 10 : null; },
    Current:    (data, off) => { const v = readBytes2(data, off); return v !== null ? v / 10 : null; },
    CurrentS:   (data, off) => { const v = readBytes2Signed(data, off); return v !== null ? v / 10 : null; },
    Frequency:  (data, off) => { const v = readBytes2(data, off); return v !== null ? v / 100 : null; },
    Power:      (data, off) => readBytes2(data, off),
    PowerS:     (data, off) => readBytes2Signed(data, off),
    Power4:     (data, off) => readBytes4(data, off),
    Power4S:    (data, off) => readBytes4Signed(data, off),
    Energy:     (data, off) => { const v = readBytes2(data, off); return v !== null ? v / 10 : null; },
    Energy4:    (data, off) => { const v = readBytes4(data, off); return v !== null ? v / 10 : null; },
    Temp:       (data, off) => {
        const v = readBytes2Signed(data, off);
        if (v === null || v === -1 || v === 32767) return null;
        return v / 10;
    },
    Byte:       (data, off) => readByte(data, off),
    ByteH:      (data, off) => { const v = readBytes2(data, off); return v !== null ? (v >> 8) & 0xFF : null; },
    ByteL:      (data, off) => { const v = readBytes2(data, off); return v !== null ? v & 0xFF : null; },
    Integer:    (data, off) => readBytes2(data, off),
    IntegerS:   (data, off) => readBytes2Signed(data, off),
    Long:       (data, off) => readBytes4(data, off),
    LongS:      (data, off) => readBytes4Signed(data, off),
    Decimal:    (data, off, sensor) => {
        const v = readBytes2Signed(data, off);
        const scale = sensor.scale || 1000;
        return v !== null ? v / scale : null;
    },
    Apparent:   (data, off) => readBytes2(data, off),
    Apparent4:  (data, off) => readBytes4(data, off),
    Reactive:   (data, off) => readBytes2Signed(data, off),
    Reactive4:  (data, off) => readBytes4Signed(data, off),
    Timestamp:  (data, off) => {
        if (off + 6 > data.length) return null;
        const year = 2000 + data.readUInt8(off);
        const month = data.readUInt8(off + 1);
        const day = data.readUInt8(off + 2);
        const hour = data.readUInt8(off + 3);
        const minute = data.readUInt8(off + 4);
        const second = data.readUInt8(off + 5);
        try {
            return new Date(year, month - 1, day, hour, minute, second).toISOString();
        } catch (e) {
            return null;
        }
    }
};

// ── ET Series Sensor Definitions ───────────────────────────────────────────────
// Register range: 35100 (0x891C), count: 125 registers (250 bytes)
// Protocol: Modbus RTU (UDP) or Modbus TCP
// Used by: ET, EH, BT, BH, GEH

const ET_REGISTER_START = 35100;
const ET_REGISTER_COUNT = 125;

const ET_SENSORS = [
    { id: "timestamp",           offset: 35100, type: "Timestamp",  size: 6,  kind: null,      unit: "",    name: "Timestamp" },

    // PV1
    { id: "vpv1",                offset: 35103, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV1 Voltage" },
    { id: "ipv1",                offset: 35104, type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV1 Current" },
    { id: "ppv1",                offset: 35105, type: "Power4",     size: 4,  kind: Kind.PV,   unit: "W",   name: "PV1 Power" },

    // PV2
    { id: "vpv2",                offset: 35107, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV2 Voltage" },
    { id: "ipv2",                offset: 35108, type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV2 Current" },
    { id: "ppv2",                offset: 35109, type: "Power4",     size: 4,  kind: Kind.PV,   unit: "W",   name: "PV2 Power" },

    // PV3
    { id: "vpv3",                offset: 35111, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV3 Voltage" },
    { id: "ipv3",                offset: 35112, type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV3 Current" },
    { id: "ppv3",                offset: 35113, type: "Power4",     size: 4,  kind: Kind.PV,   unit: "W",   name: "PV3 Power" },

    // PV4
    { id: "vpv4",                offset: 35115, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV4 Voltage" },
    { id: "ipv4",                offset: 35116, type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV4 Current" },
    { id: "ppv4",                offset: 35117, type: "Power4",     size: 4,  kind: Kind.PV,   unit: "W",   name: "PV4 Power" },

    // On-grid L1
    { id: "vgrid",               offset: 35121, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L1 Voltage" },
    { id: "igrid",               offset: 35122, type: "Current",    size: 2,  kind: Kind.AC,   unit: "A",   name: "On-grid L1 Current" },
    { id: "fgrid",               offset: 35123, type: "Frequency",  size: 2,  kind: Kind.AC,   unit: "Hz",  name: "On-grid L1 Frequency" },
    { id: "pgrid",               offset: 35125, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "On-grid L1 Power" },

    // On-grid L2
    { id: "vgrid2",              offset: 35126, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L2 Voltage" },
    { id: "igrid2",              offset: 35127, type: "Current",    size: 2,  kind: Kind.AC,   unit: "A",   name: "On-grid L2 Current" },
    { id: "fgrid2",              offset: 35128, type: "Frequency",  size: 2,  kind: Kind.AC,   unit: "Hz",  name: "On-grid L2 Frequency" },
    { id: "pgrid2",              offset: 35130, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "On-grid L2 Power" },

    // On-grid L3
    { id: "vgrid3",              offset: 35131, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L3 Voltage" },
    { id: "igrid3",              offset: 35132, type: "Current",    size: 2,  kind: Kind.AC,   unit: "A",   name: "On-grid L3 Current" },
    { id: "fgrid3",              offset: 35133, type: "Frequency",  size: 2,  kind: Kind.AC,   unit: "Hz",  name: "On-grid L3 Frequency" },
    { id: "pgrid3",              offset: 35135, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "On-grid L3 Power" },

    // Grid mode & totals
    { id: "grid_mode",           offset: 35136, type: "Integer",    size: 2,  kind: Kind.PV,   unit: "",    name: "Grid Mode code" },
    { id: "total_inverter_power",offset: 35138, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "Total Power" },
    { id: "active_power",        offset: 35140, type: "PowerS",     size: 2,  kind: Kind.GRID, unit: "W",   name: "Active Power" },
    { id: "reactive_power",      offset: 35142, type: "Reactive",   size: 2,  kind: Kind.GRID, unit: "var", name: "Reactive Power" },
    { id: "apparent_power",      offset: 35144, type: "Apparent",   size: 2,  kind: Kind.GRID, unit: "VA",  name: "Apparent Power" },

    // Back-up L1
    { id: "backup_v1",           offset: 35145, type: "Voltage",    size: 2,  kind: Kind.UPS,  unit: "V",   name: "Back-up L1 Voltage" },
    { id: "backup_i1",           offset: 35146, type: "Current",    size: 2,  kind: Kind.UPS,  unit: "A",   name: "Back-up L1 Current" },
    { id: "backup_f1",           offset: 35147, type: "Frequency",  size: 2,  kind: Kind.UPS,  unit: "Hz",  name: "Back-up L1 Frequency" },
    { id: "backup_p1",           offset: 35150, type: "PowerS",     size: 2,  kind: Kind.UPS,  unit: "W",   name: "Back-up L1 Power" },

    // Back-up L2
    { id: "backup_v2",           offset: 35151, type: "Voltage",    size: 2,  kind: Kind.UPS,  unit: "V",   name: "Back-up L2 Voltage" },
    { id: "backup_i2",           offset: 35152, type: "Current",    size: 2,  kind: Kind.UPS,  unit: "A",   name: "Back-up L2 Current" },
    { id: "backup_f2",           offset: 35153, type: "Frequency",  size: 2,  kind: Kind.UPS,  unit: "Hz",  name: "Back-up L2 Frequency" },
    { id: "backup_p2",           offset: 35156, type: "PowerS",     size: 2,  kind: Kind.UPS,  unit: "W",   name: "Back-up L2 Power" },

    // Back-up L3
    { id: "backup_v3",           offset: 35157, type: "Voltage",    size: 2,  kind: Kind.UPS,  unit: "V",   name: "Back-up L3 Voltage" },
    { id: "backup_i3",           offset: 35158, type: "Current",    size: 2,  kind: Kind.UPS,  unit: "A",   name: "Back-up L3 Current" },
    { id: "backup_f3",           offset: 35159, type: "Frequency",  size: 2,  kind: Kind.UPS,  unit: "Hz",  name: "Back-up L3 Frequency" },
    { id: "backup_p3",           offset: 35162, type: "PowerS",     size: 2,  kind: Kind.UPS,  unit: "W",   name: "Back-up L3 Power" },

    // Load
    { id: "load_p1",             offset: 35164, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "Load L1" },
    { id: "load_p2",             offset: 35166, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "Load L2" },
    { id: "load_p3",             offset: 35168, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "Load L3" },
    { id: "backup_ptotal",       offset: 35170, type: "PowerS",     size: 2,  kind: Kind.UPS,  unit: "W",   name: "Back-up Load" },
    { id: "load_ptotal",         offset: 35172, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "Load" },
    { id: "ups_load",            offset: 35173, type: "Integer",    size: 2,  kind: Kind.UPS,  unit: "%",   name: "Ups Load" },

    // Temperatures
    { id: "temperature_air",     offset: 35174, type: "Temp",       size: 2,  kind: Kind.AC,   unit: "C",   name: "Inverter Temperature (Air)" },
    { id: "temperature_module",  offset: 35175, type: "Temp",       size: 2,  kind: null,      unit: "C",   name: "Inverter Temperature (Module)" },
    { id: "temperature",         offset: 35176, type: "Temp",       size: 2,  kind: Kind.AC,   unit: "C",   name: "Inverter Temperature (Radiator)" },

    // Bus
    { id: "bus_voltage",         offset: 35178, type: "Voltage",    size: 2,  kind: null,      unit: "V",   name: "Bus Voltage" },
    { id: "nbus_voltage",        offset: 35179, type: "Voltage",    size: 2,  kind: null,      unit: "V",   name: "NBus Voltage" },

    // Battery
    { id: "vbattery1",           offset: 35180, type: "Voltage",    size: 2,  kind: Kind.BAT,  unit: "V",   name: "Battery Voltage" },
    { id: "ibattery1",           offset: 35181, type: "CurrentS",   size: 2,  kind: Kind.BAT,  unit: "A",   name: "Battery Current" },
    { id: "pbattery1",           offset: 35182, type: "Power4S",    size: 4,  kind: Kind.BAT,  unit: "W",   name: "Battery Power" },
    { id: "battery_mode",        offset: 35184, type: "Integer",    size: 2,  kind: Kind.BAT,  unit: "",    name: "Battery Mode code" },
    { id: "battery_soc",         offset: null,  type: null,         size: 0,  kind: Kind.BAT,  unit: "%",   name: "Battery State of Charge",
        _note: "Read from battery detail registers (37000+), not in main runtime block" },

    // Warning / Safety / Work mode
    { id: "warning_code",        offset: 35185, type: "Integer",    size: 2,  kind: null,      unit: "",    name: "Warning code" },
    { id: "safety_country",      offset: 35186, type: "Integer",    size: 2,  kind: Kind.AC,   unit: "",    name: "Safety Country code" },
    { id: "work_mode",           offset: 35187, type: "Integer",    size: 2,  kind: null,      unit: "",    name: "Work Mode code" },
    { id: "operation_mode",      offset: 35188, type: "Integer",    size: 2,  kind: null,      unit: "",    name: "Operation Mode code" },

    // Errors
    { id: "error_codes",         offset: 35189, type: "Long",       size: 4,  kind: null,      unit: "",    name: "Error Codes" },

    // Energy totals
    { id: "e_total",             offset: 35191, type: "Energy4",    size: 4,  kind: Kind.PV,   unit: "kWh", name: "Total PV Generation" },
    { id: "e_day",               offset: 35193, type: "Energy4",    size: 4,  kind: Kind.PV,   unit: "kWh", name: "Today's PV Generation" },
    { id: "e_total_exp",         offset: 35195, type: "Energy4",    size: 4,  kind: Kind.AC,   unit: "kWh", name: "Total Energy (export)" },
    { id: "h_total",             offset: 35197, type: "Long",       size: 4,  kind: Kind.PV,   unit: "h",   name: "Hours Total" },
    { id: "e_day_exp",           offset: 35199, type: "Energy",     size: 2,  kind: Kind.AC,   unit: "kWh", name: "Today Energy (export)" },
    { id: "e_total_imp",         offset: 35200, type: "Energy4",    size: 4,  kind: Kind.AC,   unit: "kWh", name: "Total Energy (import)" },
    { id: "e_day_imp",           offset: 35202, type: "Energy",     size: 2,  kind: Kind.AC,   unit: "kWh", name: "Today Energy (import)" },
    { id: "e_load_total",        offset: 35203, type: "Energy4",    size: 4,  kind: Kind.AC,   unit: "kWh", name: "Total Load" },
    { id: "e_load_day",          offset: 35205, type: "Energy",     size: 2,  kind: Kind.AC,   unit: "kWh", name: "Today Load" },
    { id: "e_bat_charge_total",  offset: 35206, type: "Energy4",    size: 4,  kind: Kind.BAT,  unit: "kWh", name: "Total Battery Charge" },
    { id: "e_bat_charge_day",    offset: 35208, type: "Energy",     size: 2,  kind: Kind.BAT,  unit: "kWh", name: "Today Battery Charge" },
    { id: "e_bat_discharge_total",offset:35209, type: "Energy4",    size: 4,  kind: Kind.BAT,  unit: "kWh", name: "Total Battery Discharge" },
    { id: "e_bat_discharge_day", offset: 35211, type: "Energy",     size: 2,  kind: Kind.BAT,  unit: "kWh", name: "Today Battery Discharge" },

    // Diagnostics
    { id: "diagnose_result",     offset: 35220, type: "Long",       size: 4,  kind: null,      unit: "",    name: "Diag Status Code" },
];

// ── DT Series Sensor Definitions ───────────────────────────────────────────────
// Register range: 30100 (0x7594), count: 73 registers (146 bytes)
// Protocol: Modbus RTU (UDP) or Modbus TCP
// Used by: DT, MS, D-NS, XS

const DT_REGISTER_START = 30100;
const DT_REGISTER_COUNT = 73;

const DT_SENSORS = [
    { id: "timestamp",           offset: 30100, type: "Timestamp",  size: 6,  kind: null,      unit: "",    name: "Timestamp" },

    // PV1-3
    { id: "vpv1",                offset: 30103, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV1 Voltage" },
    { id: "ipv1",                offset: 30104, type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV1 Current" },
    { id: "vpv2",                offset: 30105, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV2 Voltage" },
    { id: "ipv2",                offset: 30106, type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV2 Current" },
    { id: "vpv3",                offset: 30107, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV3 Voltage" },
    { id: "ipv3",                offset: 30108, type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV3 Current" },

    // AC line-to-line
    { id: "vline1",              offset: 30115, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L1-L2 Voltage" },
    { id: "vline2",              offset: 30116, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L2-L3 Voltage" },
    { id: "vline3",              offset: 30117, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L3-L1 Voltage" },

    // AC phase voltages
    { id: "vgrid1",              offset: 30118, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L1 Voltage" },
    { id: "vgrid2",              offset: 30119, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L2 Voltage" },
    { id: "vgrid3",              offset: 30120, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid L3 Voltage" },

    // AC phase currents
    { id: "igrid1",              offset: 30121, type: "Current",    size: 2,  kind: Kind.AC,   unit: "A",   name: "On-grid L1 Current" },
    { id: "igrid2",              offset: 30122, type: "Current",    size: 2,  kind: Kind.AC,   unit: "A",   name: "On-grid L2 Current" },
    { id: "igrid3",              offset: 30123, type: "Current",    size: 2,  kind: Kind.AC,   unit: "A",   name: "On-grid L3 Current" },

    // AC frequencies
    { id: "fgrid1",              offset: 30124, type: "Frequency",  size: 2,  kind: Kind.AC,   unit: "Hz",  name: "On-grid L1 Frequency" },
    { id: "fgrid2",              offset: 30125, type: "Frequency",  size: 2,  kind: Kind.AC,   unit: "Hz",  name: "On-grid L2 Frequency" },
    { id: "fgrid3",              offset: 30126, type: "Frequency",  size: 2,  kind: Kind.AC,   unit: "Hz",  name: "On-grid L3 Frequency" },

    // Total power
    { id: "total_inverter_power",offset: 30127, type: "Power4",     size: 4,  kind: Kind.AC,   unit: "W",   name: "Total Power" },
    { id: "work_mode",           offset: 30129, type: "Integer",    size: 2,  kind: null,      unit: "",    name: "Work Mode code" },
    { id: "error_codes",         offset: 30130, type: "Long",       size: 4,  kind: null,      unit: "",    name: "Error Codes" },
    { id: "warning_code",        offset: 30132, type: "Integer",    size: 2,  kind: null,      unit: "",    name: "Warning code" },

    // Power quality
    { id: "apparent_power",      offset: 30133, type: "Apparent4",  size: 4,  kind: Kind.AC,   unit: "VA",  name: "Apparent Power" },
    { id: "reactive_power",      offset: 30135, type: "Reactive4",  size: 4,  kind: Kind.AC,   unit: "var", name: "Reactive Power" },
    { id: "power_factor",        offset: 30139, type: "Decimal",    size: 2,  kind: Kind.GRID, unit: "",    name: "Power Factor", scale: 1000 },

    // Temperatures
    { id: "temperature",         offset: 30141, type: "Temp",       size: 2,  kind: Kind.AC,   unit: "C",   name: "Inverter Temperature" },
    { id: "temperature_heatsink",offset: 30142, type: "Temp",       size: 2,  kind: Kind.AC,   unit: "C",   name: "Heatsink Temperature" },

    // Energy
    { id: "e_day",               offset: 30144, type: "Energy",     size: 2,  kind: Kind.PV,   unit: "kWh", name: "Today's PV Generation" },
    { id: "e_total",             offset: 30145, type: "Energy4",    size: 4,  kind: Kind.PV,   unit: "kWh", name: "Total PV Generation" },
    { id: "h_total",             offset: 30147, type: "Long",       size: 4,  kind: Kind.PV,   unit: "h",   name: "Hours Total" },

    // Safety / diagnostics
    { id: "safety_country",      offset: 30149, type: "Integer",    size: 2,  kind: Kind.AC,   unit: "",    name: "Safety Country code" },
    { id: "bus_voltage",         offset: 30163, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "Bus Voltage" },
    { id: "nbus_voltage",        offset: 30164, type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "NBus Voltage" },
    { id: "rssi",                offset: 30172, type: "Integer",    size: 2,  kind: null,      unit: "",    name: "RSSI" },
];

// ── ES Series Sensor Definitions ───────────────────────────────────────────────
// Protocol: AA55 (byte offsets in response payload)
// Command: AA55 "010600" / response type "0186"
// Used by: ES, EM, BP

const ES_SENSORS = [
    // PV1
    { id: "vpv1",                offset: 0,  type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV1 Voltage" },
    { id: "ipv1",                offset: 2,  type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV1 Current" },
    { id: "pv1_mode",            offset: 4,  type: "Byte",       size: 1,  kind: Kind.PV,   unit: "",    name: "PV1 Mode code" },

    // PV2
    { id: "vpv2",                offset: 5,  type: "Voltage",    size: 2,  kind: Kind.PV,   unit: "V",   name: "PV2 Voltage" },
    { id: "ipv2",                offset: 7,  type: "Current",    size: 2,  kind: Kind.PV,   unit: "A",   name: "PV2 Current" },
    { id: "pv2_mode",            offset: 9,  type: "Byte",       size: 1,  kind: Kind.PV,   unit: "",    name: "PV2 Mode code" },

    // Battery
    { id: "vbattery1",           offset: 10, type: "Voltage",    size: 2,  kind: Kind.BAT,  unit: "V",   name: "Battery Voltage" },
    { id: "battery_status",      offset: 14, type: "Integer",    size: 2,  kind: Kind.BAT,  unit: "",    name: "Battery Status" },
    { id: "battery_temperature", offset: 16, type: "Temp",       size: 2,  kind: Kind.BAT,  unit: "C",   name: "Battery Temperature" },
    { id: "battery_charge_limit",offset: 20, type: "Integer",    size: 2,  kind: Kind.BAT,  unit: "A",   name: "Battery Charge Limit" },
    { id: "battery_discharge_limit",offset:22,type: "Integer",   size: 2,  kind: Kind.BAT,  unit: "A",   name: "Battery Discharge Limit" },
    { id: "battery_error",       offset: 24, type: "Integer",    size: 2,  kind: Kind.BAT,  unit: "",    name: "Battery Error Code" },
    { id: "battery_soc",         offset: 26, type: "Byte",       size: 1,  kind: Kind.BAT,  unit: "%",   name: "Battery State of Charge" },
    { id: "battery_soh",         offset: 29, type: "Byte",       size: 1,  kind: Kind.BAT,  unit: "%",   name: "Battery State of Health" },
    { id: "battery_mode",        offset: 30, type: "Byte",       size: 1,  kind: Kind.BAT,  unit: "",    name: "Battery Mode code" },
    { id: "battery_warning",     offset: 31, type: "Integer",    size: 2,  kind: Kind.BAT,  unit: "",    name: "Battery Warning" },

    // Grid / AC
    { id: "meter_status",        offset: 33, type: "Byte",       size: 1,  kind: Kind.AC,   unit: "",    name: "Meter Status code" },
    { id: "vgrid",               offset: 34, type: "Voltage",    size: 2,  kind: Kind.AC,   unit: "V",   name: "On-grid Voltage" },
    { id: "igrid",               offset: 36, type: "Current",    size: 2,  kind: Kind.AC,   unit: "A",   name: "On-grid Current" },
    { id: "fgrid",               offset: 40, type: "Frequency",  size: 2,  kind: Kind.AC,   unit: "Hz",  name: "On-grid Frequency" },
    { id: "grid_mode",           offset: 42, type: "Byte",       size: 1,  kind: Kind.GRID, unit: "",    name: "Work Mode code" },

    // Back-up / UPS
    { id: "vload",               offset: 43, type: "Voltage",    size: 2,  kind: Kind.UPS,  unit: "V",   name: "Back-up Voltage" },
    { id: "iload",               offset: 45, type: "Current",    size: 2,  kind: Kind.UPS,  unit: "A",   name: "Back-up Current" },
    { id: "pload",               offset: 47, type: "Power",      size: 2,  kind: Kind.AC,   unit: "W",   name: "On-grid Power" },
    { id: "fload",               offset: 49, type: "Frequency",  size: 2,  kind: Kind.UPS,  unit: "Hz",  name: "Back-up Frequency" },
    { id: "load_mode",           offset: 51, type: "Byte",       size: 1,  kind: Kind.AC,   unit: "",    name: "Load Mode code" },
    { id: "work_mode",           offset: 52, type: "Byte",       size: 1,  kind: Kind.AC,   unit: "",    name: "Energy Mode code" },

    // Inverter
    { id: "temperature",         offset: 53, type: "Temp",       size: 2,  kind: null,      unit: "C",   name: "Inverter Temperature" },
    { id: "error_codes",         offset: 55, type: "Long",       size: 4,  kind: null,      unit: "",    name: "Error Codes" },

    // Energy totals
    { id: "e_total",             offset: 59, type: "Energy4",    size: 4,  kind: Kind.PV,   unit: "kWh", name: "Total PV Generation" },
    { id: "h_total",             offset: 63, type: "Long",       size: 4,  kind: Kind.PV,   unit: "h",   name: "Hours Total" },
    { id: "e_day",               offset: 67, type: "Energy",     size: 2,  kind: Kind.PV,   unit: "kWh", name: "Today's PV Generation" },
    { id: "e_load_day",          offset: 69, type: "Energy",     size: 2,  kind: Kind.AC,   unit: "kWh", name: "Today's Load" },
    { id: "e_load_total",        offset: 71, type: "Energy4",    size: 4,  kind: Kind.AC,   unit: "kWh", name: "Total Load" },
    { id: "total_power",         offset: 75, type: "PowerS",     size: 2,  kind: Kind.AC,   unit: "W",   name: "Total Power" },

    // Control / status
    { id: "effective_work_mode", offset: 77, type: "Byte",       size: 1,  kind: null,      unit: "",    name: "Effective Work Mode code" },
    { id: "grid_in_out",         offset: 80, type: "Byte",       size: 1,  kind: Kind.GRID, unit: "",    name: "On-grid Mode code" },
    { id: "pback_up",            offset: 81, type: "Power",      size: 2,  kind: Kind.UPS,  unit: "W",   name: "Back-up Power" },
    { id: "meter_power_factor",  offset: 83, type: "Decimal",    size: 2,  kind: Kind.GRID, unit: "",    name: "Meter Power Factor", scale: 1000 },

    // Diagnostics
    { id: "diagnose_result",     offset: 89, type: "Long",       size: 4,  kind: null,      unit: "",    name: "Diag Status Code" },
];

// ── Family Lookup ──────────────────────────────────────────────────────────────

const FAMILY_CONFIGS = {
    // ET family (hybrid, single/three-phase)
    ET: { sensors: ET_SENSORS, registerStart: ET_REGISTER_START, registerCount: ET_REGISTER_COUNT, protocol: "modbus" },
    EH: { sensors: ET_SENSORS, registerStart: ET_REGISTER_START, registerCount: ET_REGISTER_COUNT, protocol: "modbus" },
    BT: { sensors: ET_SENSORS, registerStart: ET_REGISTER_START, registerCount: ET_REGISTER_COUNT, protocol: "modbus" },
    BH: { sensors: ET_SENSORS, registerStart: ET_REGISTER_START, registerCount: ET_REGISTER_COUNT, protocol: "modbus" },
    GEH:{ sensors: ET_SENSORS, registerStart: ET_REGISTER_START, registerCount: ET_REGISTER_COUNT, protocol: "modbus" },

    // DT family (grid-tie, three-phase)
    DT: { sensors: DT_SENSORS, registerStart: DT_REGISTER_START, registerCount: DT_REGISTER_COUNT, protocol: "modbus" },
    MS: { sensors: DT_SENSORS, registerStart: DT_REGISTER_START, registerCount: DT_REGISTER_COUNT, protocol: "modbus" },
    "D-NS": { sensors: DT_SENSORS, registerStart: DT_REGISTER_START, registerCount: DT_REGISTER_COUNT, protocol: "modbus" },
    XS: { sensors: DT_SENSORS, registerStart: DT_REGISTER_START, registerCount: DT_REGISTER_COUNT, protocol: "modbus" },

    // ES family (hybrid storage, single-phase)
    ES: { sensors: ES_SENSORS, protocol: "aa55" },
    EM: { sensors: ES_SENSORS, protocol: "aa55" },
    BP: { sensors: ES_SENSORS, protocol: "aa55" },
};

/**
 * Get the family configuration for an inverter family
 * @param {string} family - Inverter family code (ET, DT, ES, etc.)
 * @returns {Object|null} Family config with sensors, registerStart, registerCount, protocol
 */
function getFamilyConfig(family) {
    return FAMILY_CONFIGS[family] || null;
}

/**
 * Get the sensor definitions for an inverter family
 * @param {string} family - Inverter family code
 * @returns {Array} Array of sensor definitions
 */
function getSensors(family) {
    const config = FAMILY_CONFIGS[family];
    if (!config) {
        throw new Error(`Unsupported inverter family: ${family}`);
    }
    return config.sensors;
}

/**
 * Parse sensor data from a response buffer using sensor definitions.
 *
 * For Modbus families (ET, DT): byteOffset = (sensor.offset - baseRegister) * 2
 * For AA55 families (ES):       byteOffset = sensor.offset (already byte offsets)
 *
 * @param {Array} sensors - Sensor definition array
 * @param {Buffer} data - Response payload buffer (headers/CRC already stripped)
 * @param {number|null} baseRegister - First register address (for Modbus offset calculation), null for AA55
 * @returns {Object} Parsed sensor data keyed by sensor ID
 */
function parseSensorData(sensors, data, baseRegister) {
    const result = {};

    for (const sensor of sensors) {
        // Skip sensors without a register offset (calculated, notes, etc.)
        if (sensor.offset === null || sensor.offset === undefined) {
            continue;
        }

        // Skip sensors without a type reader
        if (!sensor.type || !typeReaders[sensor.type]) {
            continue;
        }

        // Calculate byte offset in the buffer
        let byteOffset;
        if (baseRegister !== null && baseRegister !== undefined) {
            // Modbus: convert register address to byte offset
            byteOffset = (sensor.offset - baseRegister) * 2;
        } else {
            // AA55: offset is already in bytes
            byteOffset = sensor.offset;
        }

        if (byteOffset < 0 || byteOffset >= data.length) {
            continue;
        }

        try {
            const value = typeReaders[sensor.type](data, byteOffset, sensor);
            if (value !== null) {
                result[sensor.id] = value;
            }
        } catch (e) {
            // Skip sensors that fail to parse
        }
    }

    return result;
}

/**
 * Build sensor metadata map from sensor definitions.
 * Used by node-helpers for output formatting.
 *
 * @param {Array} sensors - Sensor definition array
 * @returns {Object} Metadata map keyed by sensor ID
 */
function buildSensorMetadata(sensors) {
    const kindToCategory = {
        PV:   "pv",
        AC:   "grid",
        UPS:  "ups",
        BAT:  "battery",
        GRID: "grid"
    };

    const metadata = {};
    for (const sensor of sensors) {
        // Skip internal/diagnostic sensors with no kind
        metadata[sensor.id] = {
            name: sensor.name,
            unit: sensor.unit,
            kind: sensor.kind || "STATUS",
            category: (sensor.kind && kindToCategory[sensor.kind]) || "status"
        };
    }
    return metadata;
}

module.exports = {
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
    ET_REGISTER_COUNT,
    DT_REGISTER_START,
    DT_REGISTER_COUNT,
    FAMILY_CONFIGS,
    // Expose low-level readers for testing
    readBytes2,
    readBytes2Signed,
    readBytes4,
    readBytes4Signed,
    readByte
};
