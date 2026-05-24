/**
 * GoodWe Inverter Discovery
 *
 * UDP broadcast discovery for GoodWe inverters on the local network.
 * Split out of lib/protocol.js (#80) so the per-inverter ProtocolHandler
 * stays focused on the connected session, while one-shot network scans
 * and the IP / model-tag helpers live together here.
 */

"use strict";

const dgram = require("dgram");
const os = require("os");
const modbus = require("./modbus");

// ── IPv4 helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a dotted-quad IPv4 string to a 32-bit unsigned integer (big-endian).
 * Returns null for input that isn't a valid IPv4 literal.
 * @param {string} ip
 * @returns {number|null}
 */
function ipv4ToInt(ip) {
    if (typeof ip !== "string") return null;
    const parts = ip.split(".");
    if (parts.length !== 4) return null;
    let n = 0;
    for (const p of parts) {
        const v = Number(p);
        if (!Number.isInteger(v) || v < 0 || v > 255 || /\D/.test(p)) return null;
        n = (n * 256) + v;
    }
    return n >>> 0;
}

/**
 * Return true when `ipAddress` shares a subnet with any non-internal IPv4
 * interface on this host, or is loopback. Used to filter spoofed discovery
 * responses arriving from outside the local L2 segment (#61).
 *
 * Defaults to false on parse errors so callers fail closed.
 * @param {string} ipAddress
 * @returns {boolean}
 */
function isLocalSubnet(ipAddress) {
    const peer = ipv4ToInt(ipAddress);
    if (peer === null) return false;
    if ((peer & 0xFF000000) >>> 0 === 0x7F000000) return true; // loopback /8
    const ifaces = os.networkInterfaces();
    for (const list of Object.values(ifaces)) {
        if (!list) continue;
        for (const iface of list) {
            if (iface.family !== "IPv4" || iface.internal) continue;
            const local = ipv4ToInt(iface.address);
            const mask = ipv4ToInt(iface.netmask);
            if (local === null || mask === null) continue;
            if (((local & mask) >>> 0) === ((peer & mask) >>> 0)) return true;
        }
    }
    return false;
}

/**
 * Return true for IPv4 broadcast/multicast/unicast addresses that are safe
 * to use as a discovery broadcast target without leaking the AA55 probe over
 * routed links to public hosts (#76).
 *
 * Returns false on parse errors so callers fail closed.
 * @param {string} ipAddress
 * @returns {boolean}
 */
function isPrivateBroadcast(ipAddress) {
    const addr = ipv4ToInt(ipAddress);
    if (addr === null) return false;
    if (addr === 0xFFFFFFFF) return true; // 255.255.255.255 limited broadcast
    const top = (addr & 0xFF000000) >>> 24;
    const second = (addr & 0x00FF0000) >>> 16;
    if (top === 10) return true;
    if (top === 172 && second >= 16 && second <= 31) return true;
    if (top === 192 && second === 168) return true;
    if (top === 169 && second === 254) return true;
    if (top === 224 && second === 0) return true;
    return false;
}

// ── Inverter family / model detection ────────────────────────────────────────

/**
 * Inverter family classification by model-name substring (#57). Ported from
 * upstream marcelblijleven/goodwe `goodwe/model.py` model tag tables.
 */
const FAMILY_TAGS = {
    DT: ["DTU", "DTS", "D-NS", "DNS", "KMT", "XSU", "XS-", "MS-", "MSU"],
    ES: ["ESU", "EMU", "BPU"],
    ET: [
        "ETU", "EHU", "BTU", "BHU",
        "ESA", "EHA",
        "ARB", "URB", "EBR",
        "NAH", "HMB", "HBB", "SPN"
    ]
};

/**
 * Detect inverter family by matching the model name against FAMILY_TAGS.
 * Returns null when no tag matches.
 * @param {string} modelName
 * @returns {string|null} "ET" | "DT" | "ES" | null
 */
function detectInverterFamily(modelName) {
    if (!modelName || typeof modelName !== "string") return null;
    const upper = modelName.toUpperCase();
    for (const family of Object.keys(FAMILY_TAGS)) {
        if (FAMILY_TAGS[family].some(tag => upper.includes(tag))) return family;
    }
    return null;
}

/**
 * Extract the serial number from an AA55 device-info response payload.
 * @param {Buffer} data - Full AA55 frame
 * @returns {string} 16-byte serial number trimmed of nulls/whitespace,
 *   or "UNKNOWN" if the frame is too short / invalid.
 */
function extractSerialNumber(data) {
    try {
        const validation = modbus.validateAA55Response(data);
        if (!validation.valid) return "UNKNOWN";
        const payload = modbus.extractAA55Payload(data);
        if (payload.length < 26) return "UNKNOWN";
        return payload.slice(10, 26).toString("ascii").replace(/\0/g, "").trim() || "UNKNOWN";
    } catch (err) {
        return "UNKNOWN";
    }
}

/**
 * Extract the model name from an AA55 device-info response payload.
 * @param {Buffer} data - Full AA55 frame
 * @returns {string} 10-byte model name trimmed of nulls/whitespace,
 *   or empty string if the frame is too short / invalid.
 */
function extractModelName(data) {
    try {
        const validation = modbus.validateAA55Response(data);
        if (!validation.valid) return "";
        const payload = modbus.extractAA55Payload(data);
        if (payload.length < 10) return "";
        return payload.slice(0, 10).toString("ascii").replace(/\0/g, "").trim();
    } catch (err) {
        return "";
    }
}

/**
 * Parse a discovery response (AA55 device-info reply broadcast by inverters).
 * @param {Buffer} data - Full AA55 frame as received
 * @param {string} ipAddress - IP address of the responder
 * @returns {Object|null} Parsed inverter info, or null on invalid frame.
 */
function parseDiscoveryResponse(data, ipAddress) {
    try {
        const validation = modbus.validateAA55Response(data);
        if (!validation.valid) return null;

        const payload = modbus.extractAA55Payload(data);
        if (payload.length < 26) return null;

        const modelName = payload.slice(0, 10).toString("ascii").replace(/\0/g, "").trim();
        const serialNumber = payload.slice(10, 26).toString("ascii").replace(/\0/g, "").trim() || "UNKNOWN";
        const family = detectInverterFamily(modelName);

        return {
            ip: ipAddress,
            port: 8899,
            family,
            serialNumber,
            modelName
        };
    } catch (err) {
        return null;
    }
}

// ── discoverInverters ───────────────────────────────────────────────────────

/**
 * Discover GoodWe inverters on the network.
 *
 * @param {Object} options
 * @param {number}  [options.timeout=5000] - ms before returning collected results
 * @param {string}  [options.broadcastAddress="255.255.255.255"] - broadcast target.
 *   Rejected with INVALID_CONFIG unless it's RFC1918/link-local/limited-
 *   broadcast (#76) or `allowPublicBroadcast` is true.
 * @param {boolean} [options.allowPublicBroadcast=false] - opt-out of the
 *   private-range check (#76).
 * @param {boolean} [options.acceptAnySource=false] - opt-out of the source-IP
 *   subnet filter on responses (#61).
 * @returns {Promise<Array>} array of inverter objects. The array carries a
 *   non-enumerable `diagnostics` property with drop counts (#78).
 */
function discoverInverters(options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 5000;
        const broadcastAddress = options.broadcastAddress || "255.255.255.255";
        const acceptAnySource = options.acceptAnySource === true;
        const allowPublicBroadcast = options.allowPublicBroadcast === true;

        if (!allowPublicBroadcast && !isPrivateBroadcast(broadcastAddress)) {
            const err = new Error(
                "Refusing to broadcast discovery probe to non-private address " +
                `${JSON.stringify(broadcastAddress)}. ` +
                "Use a private (RFC1918), link-local, or limited-broadcast address, " +
                "or set options.allowPublicBroadcast=true to override."
            );
            err.code = "INVALID_CONFIG";
            reject(err);
            return;
        }

        const discoveredInverters = [];
        const diagnostics = {
            nonLocalSubnet: 0,
            invalidFrame: 0,
            parseFailures: 0
        };

        const socket = dgram.createSocket("udp4");

        let cleanedUp = false;
        const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            socket.removeAllListeners();
            try {
                socket.close();
            } catch (_err) {
                // Already closed or never bound — nothing to release.
            }
        };

        const resolveWithDiagnostics = () => {
            Object.defineProperty(discoveredInverters, "diagnostics", {
                value: diagnostics,
                enumerable: false,
                configurable: false,
                writable: false
            });
            resolve(discoveredInverters);
        };

        const timeoutId = setTimeout(() => {
            cleanup();
            resolveWithDiagnostics();
        }, timeout);

        socket.on("error", (err) => {
            clearTimeout(timeoutId);
            cleanup();
            reject(err);
        });

        socket.on("message", (msg, rinfo) => {
            try {
                if (!acceptAnySource && !isLocalSubnet(rinfo.address)) {
                    diagnostics.nonLocalSubnet++;
                    return;
                }
                const validation = modbus.validateAA55Response(msg);
                if (!validation.valid) {
                    diagnostics.invalidFrame++;
                    return;
                }
                const inverter = parseDiscoveryResponse(msg, rinfo.address);
                if (inverter) {
                    const exists = discoveredInverters.some(inv => inv.ip === inverter.ip);
                    if (!exists) {
                        discoveredInverters.push(inverter);
                    }
                }
            } catch (err) {
                diagnostics.parseFailures++;
            }
        });

        socket.once("listening", () => {
            socket.setBroadcast(true);
            socket.send(
                modbus.AA55_COMMANDS.DISCOVERY,
                8899,
                broadcastAddress,
                (err) => {
                    if (err) {
                        clearTimeout(timeoutId);
                        cleanup();
                        reject(err);
                    }
                }
            );
        });
        socket.bind();
    });
}

module.exports = {
    discoverInverters,
    // IPv4 helpers
    ipv4ToInt,
    isLocalSubnet,
    isPrivateBroadcast,
    // Family / model detection
    detectInverterFamily,
    extractModelName,
    extractSerialNumber,
    parseDiscoveryResponse,
    FAMILY_TAGS
};
