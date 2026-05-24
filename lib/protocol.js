/**
 * GoodWe Protocol Implementation
 *
 * Implements UDP and TCP/Modbus protocols for communicating with GoodWe inverters.
 * Based on the marcelblijleven/goodwe Python library protocols.
 */

const dgram = require("dgram");
const net = require("net");
const os = require("os");
const EventEmitter = require("events");

// When no expectedLength is supplied, TCP `_sendCommandImpl` resolves after
// this many milliseconds of inactivity following the first byte. Short enough
// to be responsive on real inverters, long enough to bridge frame fragmentation.
// The *absolute* deadline (config.timeout) is enforced independently — see #59.
const IDLE_BYTES_TIMEOUT_MS = 100;
const { getFamilyConfig, parseSensorData } = require("./sensors");
const modbus = require("./modbus");
const { enhanceError } = require("./errors");

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
    // Force unsigned 32-bit.
    return n >>> 0;
}

/**
 * Return true when `ipAddress` shares a subnet with any non-internal IPv4
 * interface on this host, or is loopback. Used to filter spoofed discovery
 * responses arriving from outside the local L2 segment.
 *
 * Defaults to false on parse errors so callers fail closed.
 * @param {string} ipAddress
 * @returns {boolean}
 */
function isLocalSubnet(ipAddress) {
    const peer = ipv4ToInt(ipAddress);
    if (peer === null) return false;
    // Loopback /8 — always trust.
    if ((peer & 0xFF000000) >>> 0 === 0x7F000000) return true;
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
 * Resolve a user-supplied `commAddr` config value to a Modbus unit ID byte.
 * See ProtocolHandler constructor for the policy.
 * @param {string|number|null|undefined} value
 * @param {string} family
 * @returns {number} unit ID in [0, 255]
 * @throws {Error} INVALID_CONFIG when `value` is provided but cannot be
 *   parsed as a byte.
 */
function resolveCommAddr(value, family) {
    if (value === undefined || value === null || value === "" || value === "auto") {
        return modbus.getDefaultCommAddr(family);
    }
    const parsed = (typeof value === "number") ? value : parseInt(value, 16);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xFF) {
        const err = new Error(
            `Invalid commAddr ${JSON.stringify(value)}: ` +
            "must be a hex byte 0x00-0xFF or \"auto\""
        );
        err.code = "INVALID_CONFIG";
        throw err;
    }
    return parsed;
}

/**
 * Protocol Handler for GoodWe Inverters
 */
class ProtocolHandler extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            host: config.host || "192.168.1.100",
            port: config.port || 8899,
            protocol: config.protocol || "udp",
            family: config.family || "ET",
            timeout: config.timeout || 1000,
            retries: config.retries || 3,
            commAddr: config.commAddr || "auto",
            ...config
        };

        this.socket = null;
        this.connected = false;
        this.consecutiveFailures = 0;
        this.lastError = null;

        // FIFO queue tail for serializing in-flight sendCommand() calls. UDP
        // responses are matched by arrival order (no transaction ID) and TCP
        // framing assumes one request in flight; concurrent callers against
        // the same handler would race on the shared socket listener.
        this._inflight = null;

        // Default no-op "error" listener so an emit("error", ...) before any
        // user listener attaches does not crash the runtime (EventEmitter
        // throws on unhandled "error" by default). Users adding their own
        // listener still see every event — this is additive.
        this.on("error", () => {});

        // Per-handler Modbus TCP transaction ID counter, initialised to a
        // random offset (#68). A module-level monotonic counter would have
        // made the next TX ID for any inverter session predictable from
        // traffic observed for another session in the same process.
        this._txId = Math.floor(Math.random() * 0xFFFF) + 1;

        // Resolve comm address.
        // Modbus unit IDs live in 1 byte (0-255). A malformed `commAddr` from
        // a flow import (e.g. "0x1FF" → 511) would crash the first write with
        // a RangeError deep inside Buffer.writeUInt8 (#74). Validate up-front:
        //   - "auto", "", null, undefined → family default
        //   - parseable hex byte in [0, 255] → use it
        //   - anything else (out of range, non-numeric) → throw INVALID_CONFIG
        this._commAddr = resolveCommAddr(this.config.commAddr, this.config.family);

        // Get family configuration for sensor definitions
        this._familyConfig = getFamilyConfig(this.config.family);
    }

    /**
     * Connect to the inverter
     * @returns {Promise<void>}
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                resolve();
                return;
            }

            this.emit("status", { state: "connecting" });

            if (this.config.protocol === "udp") {
                this._connectUDP()
                    .then(() => {
                        this.connected = true;
                        this.consecutiveFailures = 0;
                        this.emit("status", { state: "connected" });
                        resolve();
                    })
                    .catch(reject);
            } else if (this.config.protocol === "tcp" || this.config.protocol === "modbus") {
                this._connectTCP()
                    .then(() => {
                        this.connected = true;
                        this.consecutiveFailures = 0;
                        this.emit("status", { state: "connected" });
                        resolve();
                    })
                    .catch(reject);
            } else {
                reject(new Error(`Unsupported protocol: ${this.config.protocol}`));
            }
        });
    }

    /**
     * Connect using UDP protocol
     * @private
     */
    _connectUDP() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = dgram.createSocket("udp4");

                this.socket.on("error", (err) => {
                    this.emit("error", err);
                    this.consecutiveFailures++;
                    this.lastError = err;
                });

                // UDP is connectionless, so we just need to create the socket
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Connect using TCP protocol
     * @private
     */
    _connectTCP() {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (this.socket) {
                    this.socket.destroy();
                }
                const error = new Error("Connection timeout");
                error.code = "TIMEOUT";
                reject(enhanceError(error, this.config));
            }, this.config.timeout);

            try {
                this.socket = new net.Socket();
                const socket = this.socket;

                // Connect-phase error: rejects the connect() promise and
                // attaches a long-lived listener via `once` so it fires at most
                // once. After successful connect we explicitly remove it and
                // attach the post-connect handler — calling reject() on an
                // already-settled promise would be a no-op, and the unhandled
                // emit("error") would crash the runtime.
                const onConnectError = (err) => {
                    clearTimeout(timeout);
                    this.lastError = err;
                    this.consecutiveFailures++;
                    this.emit("error", err);
                    reject(enhanceError(err, this.config));
                };
                socket.once("error", onConnectError);

                socket.once("connect", () => {
                    clearTimeout(timeout);
                    socket.removeListener("error", onConnectError);
                    // Long-lived listener: just record + emit. Never rejects
                    // a settled promise. Request-scoped listeners in
                    // _sendCommandImpl fail in-flight reads.
                    socket.on("error", (err) => {
                        this.lastError = err;
                        this.emit("error", err);
                    });
                    resolve();
                });

                socket.on("close", () => {
                    this.connected = false;
                    this.emit("status", { state: "disconnected" });
                });

                socket.connect(this.config.port, this.config.host);
            } catch (err) {
                clearTimeout(timeout);
                reject(err);
            }
        });
    }

    /**
     * Disconnect from the inverter
     */
    disconnect() {
        return new Promise((resolve) => {
            if (!this.socket) {
                this.connected = false;
                resolve();
                return;
            }

            if (this.config.protocol === "udp") {
                this.socket.close(() => {
                    this.socket = null;
                    this.connected = false;
                    this.emit("status", { state: "disconnected" });
                    resolve();
                });
            } else {
                this.socket.end(() => {
                    this.socket = null;
                    this.connected = false;
                    this.emit("status", { state: "disconnected" });
                    resolve();
                });
            }
        });
    }

    /**
     * Send a command and wait for response.
     *
     * Serialized per-handler: if another sendCommand() is already in flight,
     * this call queues behind it and runs only once the previous one settles.
     * This prevents UDP/TCP response handlers from racing on the shared socket
     * when multiple worker nodes share the same config-node ProtocolHandler.
     *
     * @param {Buffer} command - Command buffer to send
     * @param {number} expectedLength - Expected response length (optional)
     * @returns {Promise<Buffer>}
     */
    sendCommand(command, expectedLength = null) {
        const exec = () => this._sendCommandImpl(command, expectedLength);
        // Chain regardless of whether the prior call resolved or rejected; a
        // failure must not poison subsequent callers.
        const next = (this._inflight || Promise.resolve()).then(exec, exec);
        this._inflight = next.catch(() => {});
        return next;
    }

    /**
     * Underlying socket-level send/receive. Not safe to call concurrently
     * against the same handler — invoke via sendCommand() which serializes.
     * @private
     */
    _sendCommandImpl(command, expectedLength = null) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error("Not connected"));
                return;
            }
            const socket = this.socket;

            let deadlineTimer;
            let idleTimer;
            let settled = false;
            let responseBuffer = Buffer.alloc(0);

            // Request-scoped listeners. They are explicitly added and removed
            // here (not via removeAllListeners) so the long-lived listeners
            // attached by _connectTCP/_connectUDP keep working.
            let onMessage, onData, onError, onClose;

            const cleanup = () => {
                if (deadlineTimer) clearTimeout(deadlineTimer);
                if (idleTimer) clearTimeout(idleTimer);
                if (onMessage) socket.removeListener("message", onMessage);
                if (onData) socket.removeListener("data", onData);
                if (onError) socket.removeListener("error", onError);
                if (onClose) socket.removeListener("close", onClose);
            };

            const settleReject = (err) => {
                if (settled) return;
                settled = true;
                cleanup();
                this.consecutiveFailures++;
                reject(err);
            };

            const settleResolve = (value) => {
                if (settled) return;
                settled = true;
                cleanup();
                this.consecutiveFailures = 0;
                resolve(value);
            };

            // Absolute deadline — never reset, even when data trickles in. A
            // misbehaving peer that dribbles bytes every IDLE_BYTES_TIMEOUT_MS
            // would otherwise keep the promise alive indefinitely (#59).
            deadlineTimer = setTimeout(() => {
                const error = new Error("Response timeout");
                error.code = "TIMEOUT";
                settleReject(enhanceError(error, this.config));
            }, this.config.timeout);

            // Surface socket-level errors during the request so the promise
            // fails fast instead of hanging until timeout.
            onError = (err) => settleReject(enhanceError(err, this.config));
            socket.once("error", onError);

            if (this.config.protocol === "udp") {
                onMessage = (msg) => settleResolve(msg);
                socket.once("message", onMessage);

                socket.send(command, this.config.port, this.config.host, (err) => {
                    if (err) settleReject(err);
                });
            } else {
                onClose = () => {
                    const err = new Error("Socket closed during request");
                    err.code = "ECONNRESET";
                    settleReject(enhanceError(err, this.config));
                };
                socket.once("close", onClose);

                onData = (data) => {
                    responseBuffer = Buffer.concat([responseBuffer, data]);

                    if (expectedLength && responseBuffer.length >= expectedLength) {
                        // We have everything we asked for — settle now.
                        settleResolve(responseBuffer);
                    } else if (!expectedLength) {
                        // Frame length is not known up front (e.g. AA55 device
                        // info). Reset the idle timer on each chunk; settle
                        // when no more bytes arrive for IDLE_BYTES_TIMEOUT_MS.
                        // The absolute deadlineTimer is intentionally NOT
                        // touched here — it remains the upper bound.
                        if (idleTimer) clearTimeout(idleTimer);
                        idleTimer = setTimeout(() => {
                            settleResolve(responseBuffer);
                        }, IDLE_BYTES_TIMEOUT_MS);
                    }
                };
                socket.on("data", onData);

                socket.write(command, (err) => {
                    if (err) settleReject(err);
                });
            }
        });
    }

    /**
     * Send command with retry logic
     * @param {Buffer} command - Command to send
     * @param {number} expectedLength - Expected response length (optional)
     * @returns {Promise<Buffer>}
     */
    async sendCommandWithRetry(command, expectedLength = null) {
        // Always make at least one attempt. A misconfigured retries=0 (or a
        // non-numeric value) previously skipped the loop entirely and
        // returned undefined, which crashed downstream parsers (#62).
        const parsed = parseInt(this.config.retries, 10);
        const maxAttempts = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                this.emit("status", {
                    state: "reading",
                    attempt: attempt,
                    maxRetries: maxAttempts
                });

                const response = await this.sendCommand(command, expectedLength);
                return response;
            } catch (err) {
                lastError = err;

                if (attempt < maxAttempts) {
                    this.emit("status", {
                        state: "retrying",
                        attempt: attempt,
                        maxRetries: maxAttempts
                    });

                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        this.consecutiveFailures++;
        // Defensive: maxAttempts is guaranteed >= 1 above, so lastError must
        // be set. Guard regardless so a future regression cannot silently
        // return undefined.
        if (!lastError) {
            lastError = new Error("sendCommandWithRetry exited without attempting");
            lastError.code = "INTERNAL";
        }
        throw lastError;
    }

    /**
     * Get connection status
     * @returns {Object}
     */
    getStatus() {
        return {
            connected: this.connected,
            consecutiveFailures: this.consecutiveFailures,
            lastError: this.lastError ? this.lastError.message : null,
            protocol: this.config.protocol,
            host: this.config.host,
            port: this.config.port
        };
    }

    /**
     * Return the next Modbus TCP transaction ID for this handler, wrapping
     * inside the 16-bit space. See constructor comment on #68.
     * @private
     */
    _nextTxId() {
        this._txId = (this._txId % 0xFFFF) + 1;
        return this._txId;
    }

    /**
     * Build the appropriate read command for this inverter's family/protocol
     * @returns {Buffer} Command buffer
     * @private
     */
    _buildReadCommand() {
        if (!this._familyConfig) {
            throw new Error(`Unsupported inverter family: ${this.config.family}`);
        }

        if (this._familyConfig.protocol === "aa55") {
            // ES family: use AA55 protocol
            return modbus.AA55_COMMANDS.READ_RUNNING_DATA_ES;
        }

        // Modbus family (ET, DT): build register read request
        if (this.config.protocol === "tcp" || this.config.protocol === "modbus") {
            return modbus.createTcpReadRequest(
                this._commAddr,
                this._familyConfig.registerStart,
                this._familyConfig.registerCount,
                this._nextTxId()
            );
        }

        // Default: Modbus RTU over UDP
        return modbus.createRtuReadRequest(
            this._commAddr,
            this._familyConfig.registerStart,
            this._familyConfig.registerCount
        );
    }

    /**
     * Extract and validate payload from response based on protocol
     * @param {Buffer} response - Raw response from inverter
     * @returns {Buffer} Extracted payload
     * @private
     */
    _extractPayload(response) {
        if (!this._familyConfig) {
            const err = new Error(`Unsupported inverter family: ${this.config.family}`);
            err.code = "UNSUPPORTED_FAMILY";
            throw err;
        }

        if (this._familyConfig.protocol === "aa55") {
            const validation = modbus.validateAA55Response(response, "0186");
            if (!validation.valid) {
                const err = new Error(`Invalid AA55 response: ${validation.error}`);
                err.code = "PROTOCOL_ERROR";
                throw err;
            }
            return modbus.extractAA55Payload(response);
        }

        if (this.config.protocol === "tcp" || this.config.protocol === "modbus") {
            const validation = modbus.validateTcpResponse(response, 0x03, this._familyConfig.registerCount);
            if (!validation.valid) {
                const err = new Error(`Invalid Modbus TCP response: ${validation.error}`);
                err.code = "PROTOCOL_ERROR";
                throw err;
            }
            return modbus.extractTcpPayload(response);
        }

        // Modbus RTU over UDP
        const validation = modbus.validateRtuResponse(response, 0x03, this._familyConfig.registerCount);
        if (!validation.valid) {
            const err = new Error(`Invalid Modbus RTU response: ${validation.error}`);
            err.code = "PROTOCOL_ERROR";
            throw err;
        }
        return modbus.extractRtuPayload(response);
    }

    /**
     * Read runtime data from inverter
     * @returns {Promise<Object>} Runtime sensor data
     */
    async readRuntimeData() {
        if (!this.connected) {
            await this.connect();
        }

        this.emit("status", { state: "reading" });

        try {
            const command = this._buildReadCommand();
            const response = await this.sendCommandWithRetry(command);
            const payload = this._extractPayload(response);

            // Parse using sensor definitions
            const baseRegister = this._familyConfig.protocol === "aa55"
                ? null
                : this._familyConfig.registerStart;

            const runtimeData = parseSensorData(
                this._familyConfig.sensors,
                payload,
                baseRegister
            );

            return runtimeData;
        } catch (err) {
            const error = new Error(`Failed to read runtime data: ${err.message}`);
            error.code = err.code || "READ_ERROR";
            throw enhanceError(error, this.config);
        }
    }

    /**
     * Read device information from inverter
     * Uses the AA55 device info command regardless of family.
     * @returns {Promise<Object>} Device info object
     */
    async readDeviceInfo() {
        if (!this.connected) {
            await this.connect();
        }

        this.emit("status", { state: "reading" });

        try {
            const command = modbus.AA55_COMMANDS.READ_DEVICE_INFO;
            const response = await this.sendCommandWithRetry(command);

            // Validate AA55 response with type "0181" (device info reply)
            const validation = modbus.validateAA55Response(response, "0181");
            if (!validation.valid) {
                const err = new Error(`Invalid device info response: ${validation.error}`);
                err.code = "PROTOCOL_ERROR";
                throw err;
            }

            const payload = modbus.extractAA55Payload(response);
            return parseDeviceInfo(payload);
        } catch (err) {
            const error = new Error(`Failed to read device info: ${err.message}`);
            error.code = err.code || "READ_ERROR";
            throw enhanceError(error, this.config);
        }
    }
}

/**
 * Parse device info from AA55 response payload.
 * Layout based on the GoodWe AA55 device info response format.
 *
 * @param {Buffer} payload - Extracted AA55 payload
 * @returns {Object} Parsed device info
 */
function parseDeviceInfo(payload) {
    const info = {};

    // Model name: bytes 0-9 (10 bytes ASCII)
    if (payload.length >= 10) {
        info.model_name = payload.slice(0, 10).toString("ascii").replace(/\0/g, "").trim();
    }

    // Serial number: bytes 10-25 (16 bytes ASCII)
    if (payload.length >= 26) {
        info.serial_number = payload.slice(10, 26).toString("ascii").replace(/\0/g, "").trim();
    }

    // Firmware version: bytes 26-31 (6 bytes ASCII)
    if (payload.length >= 32) {
        info.firmware = payload.slice(26, 32).toString("ascii").replace(/\0/g, "").trim();
    }

    // ARM firmware version: bytes 32-37 (6 bytes ASCII)
    if (payload.length >= 38) {
        info.arm_firmware = payload.slice(32, 38).toString("ascii").replace(/\0/g, "").trim();
    }

    // DSP1 version: bytes 38-43 (6 bytes ASCII)
    if (payload.length >= 44) {
        info.dsp1_version = payload.slice(38, 44).toString("ascii").replace(/\0/g, "").trim();
    }

    // DSP2 version: bytes 44-49 (6 bytes ASCII)
    if (payload.length >= 50) {
        info.dsp2_version = payload.slice(44, 50).toString("ascii").replace(/\0/g, "").trim();
    }

    // Rated power: bytes 50-51 (uint16 BE, Watts)
    if (payload.length >= 52) {
        info.rated_power = payload.readUInt16BE(50);
    }

    // AC output type: byte 52 (0=single phase, 1=three phase)
    if (payload.length >= 53) {
        info.ac_output_type = payload.readUInt8(52);
    }

    return info;
}

/**
 * Discover GoodWe inverters on the network
 * @param {Object} options - Discovery options
 * @param {number} options.timeout - Discovery timeout in ms (default: 5000)
 * @param {string} options.broadcastAddress - Broadcast address (default: 255.255.255.255)
 * @param {boolean} options.acceptAnySource - When true, skip the local-subnet
 *   source-IP filter and accept discovery responses from any host. Default
 *   false. Only enable for routed setups where the inverter is reachable but
 *   not on the same L2 segment as the Node-RED host (you are then responsible
 *   for the trust boundary).
 * @returns {Promise<Array>} Array of discovered inverters
 */
function discoverInverters(options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 5000;
        const broadcastAddress = options.broadcastAddress || "255.255.255.255";
        const acceptAnySource = options.acceptAnySource === true;
        const discoveredInverters = [];
        const socket = dgram.createSocket("udp4");

        let cleanedUp = false;
        const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            socket.removeAllListeners();
            // Node 24+'s dgram throws "Not running" when close() is called on
            // an unbound socket — which happens if send() errors before bind()
            // completes (e.g. broadcastAddress fails DNS resolution).
            try {
                socket.close();
            } catch (_err) {
                // Already closed or never bound — nothing to release.
            }
        };

        const timeoutId = setTimeout(() => {
            cleanup();
            resolve(discoveredInverters);
        }, timeout);

        socket.on("error", (err) => {
            clearTimeout(timeoutId);
            cleanup();
            reject(err);
        });

        socket.on("message", (msg, rinfo) => {
            try {
                // (1) Trust boundary: reject sources outside our local subnet
                // unless the caller explicitly opted out. AA55 has no auth, so
                // any LAN host that knows the protocol can advertise itself.
                if (!acceptAnySource && !isLocalSubnet(rinfo.address)) {
                    // Drop silently — tracking rejected sources is #78's scope.
                    return;
                }
                // (2) Validate AA55 framing (magic bytes + length + 16-bit
                // checksum) before parsing. validateAA55Response would also
                // check an expected response type, but discovery uses a fixed
                // command so we only need structural validity here.
                const validation = modbus.validateAA55Response(msg);
                if (!validation.valid) {
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
                // Ignore parsing errors and continue listening
            }
        });

        socket.bind(() => {
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
    });
}

/**
 * Inverter family classification by model-name substring (#57). Ported from
 * upstream marcelblijleven/goodwe `goodwe/model.py` model tag tables. Tags
 * are matched as substrings (case-insensitive) anywhere in the model name —
 * GoodWe model strings vary in format ("GW5000-ETU", "GW10K-DT", "GW25KMT")
 * so a strict prefix match would miss variants.
 *
 * Order matters where families share characters; the iteration below tries
 * DT first (because some DT tags like "DTU" overlap with "ET..." substrings
 * if matched loosely), then ES, then ET (which catches the platform-745
 * hybrids).
 */
const FAMILY_TAGS = {
    DT: ["DTU", "DTS", "D-NS", "DNS", "KMT", "XSU", "XS-", "MS-", "MSU"],
    ES: ["ESU", "EMU", "BPU"],
    ET: [
        "ETU", "EHU", "BTU", "BHU",   // hybrid ET/EH/BT/BH
        "ESA", "EHA",                 // ESA/EHA-G20 (platform 745 NAH)
        "ARB", "URB", "EBR",          // platform 745
        "NAH", "HMB", "HBB", "SPN"    // platform 745 hybrids
    ]
};

/**
 * Parse discovery response (AA55 device-info reply broadcast by inverters)
 * @param {Buffer} data - Full AA55 frame as received
 * @param {string} ipAddress - IP address of the responder
 * @returns {Object|null} Parsed inverter info, or null if the frame is not
 *   a recognizable AA55 device-info reply.
 * @private
 */
function parseDiscoveryResponse(data, ipAddress) {
    try {
        // Validate framing again at the parser boundary (the caller in
        // discoverInverters also validates — this is defense in depth so
        // direct callers cannot skip the check).
        const validation = modbus.validateAA55Response(data);
        if (!validation.valid) return null;

        const payload = modbus.extractAA55Payload(data);
        // Need at least model name (10) + serial (16) = 26 bytes.
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

/**
 * Detect inverter family by matching the model name against the FAMILY_TAGS
 * table. Returns null when no tag matches — the discover node falls back to
 * a default ("ET") but null preserves the "unknown" signal in the payload.
 *
 * @param {string} modelName - Model name string (e.g. "GW5000-ETU")
 * @returns {string|null} "ET" | "DT" | "ES" | null
 * @private
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
 * @private
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
 * @private
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

module.exports = {
    ProtocolHandler,
    discoverInverters,
    parseDeviceInfo,
    // Exported for unit tests; not part of the public Node-RED API.
    isLocalSubnet,
    ipv4ToInt,
    detectInverterFamily,
    extractModelName,
    extractSerialNumber,
    parseDiscoveryResponse,
};
