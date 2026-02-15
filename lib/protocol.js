/**
 * GoodWe Protocol Implementation
 *
 * Implements UDP and TCP/Modbus protocols for communicating with GoodWe inverters.
 * Based on the marcelblijleven/goodwe Python library protocols.
 */

const dgram = require("dgram");
const net = require("net");
const EventEmitter = require("events");
const { getFamilyConfig, parseSensorData } = require("./sensors");
const modbus = require("./modbus");

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

        // Resolve comm address
        this._commAddr = this.config.commAddr === "auto"
            ? modbus.getDefaultCommAddr(this.config.family)
            : parseInt(this.config.commAddr, 16) || modbus.getDefaultCommAddr(this.config.family);

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
                reject(new Error("Connection timeout"));
            }, this.config.timeout);

            try {
                this.socket = new net.Socket();

                this.socket.on("connect", () => {
                    clearTimeout(timeout);
                    resolve();
                });

                this.socket.on("error", (err) => {
                    clearTimeout(timeout);
                    this.emit("error", err);
                    this.consecutiveFailures++;
                    this.lastError = err;
                    reject(err);
                });

                this.socket.on("close", () => {
                    this.connected = false;
                    this.emit("status", { state: "disconnected" });
                });

                this.socket.connect(this.config.port, this.config.host);
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
     * Send a command and wait for response
     * @param {Buffer} command - Command buffer to send
     * @param {number} expectedLength - Expected response length (optional)
     * @returns {Promise<Buffer>}
     */
    sendCommand(command, expectedLength = null) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error("Not connected"));
                return;
            }

            let timeoutId;
            let responseBuffer = Buffer.alloc(0);

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                if (this.config.protocol === "udp") {
                    this.socket.removeAllListeners("message");
                } else {
                    this.socket.removeAllListeners("data");
                }
            };

            timeoutId = setTimeout(() => {
                cleanup();
                this.consecutiveFailures++;
                const error = new Error("Response timeout");
                error.code = "TIMEOUT";
                reject(error);
            }, this.config.timeout);

            if (this.config.protocol === "udp") {
                this.socket.once("message", (msg) => {
                    cleanup();
                    this.consecutiveFailures = 0;
                    resolve(msg);
                });

                this.socket.send(command, this.config.port, this.config.host, (err) => {
                    if (err) {
                        cleanup();
                        this.consecutiveFailures++;
                        reject(err);
                    }
                });
            } else {
                const onData = (data) => {
                    responseBuffer = Buffer.concat([responseBuffer, data]);

                    // Check if we have received enough data
                    if (expectedLength && responseBuffer.length >= expectedLength) {
                        cleanup();
                        this.consecutiveFailures = 0;
                        resolve(responseBuffer);
                    } else if (!expectedLength) {
                        // For protocols without fixed length, wait a bit for all data
                        clearTimeout(timeoutId);
                        timeoutId = setTimeout(() => {
                            cleanup();
                            this.consecutiveFailures = 0;
                            resolve(responseBuffer);
                        }, 100);
                    }
                };

                this.socket.on("data", onData);
                this.socket.write(command, (err) => {
                    if (err) {
                        cleanup();
                        this.consecutiveFailures++;
                        reject(err);
                    }
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
        let lastError;

        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                this.emit("status", {
                    state: "reading",
                    attempt: attempt,
                    maxRetries: this.config.retries
                });

                const response = await this.sendCommand(command, expectedLength);
                return response;
            } catch (err) {
                lastError = err;

                if (attempt < this.config.retries) {
                    this.emit("status", {
                        state: "retrying",
                        attempt: attempt,
                        maxRetries: this.config.retries
                    });

                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        this.consecutiveFailures++;
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
                this._familyConfig.registerCount
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
            throw new Error(`Unsupported inverter family: ${this.config.family}`);
        }

        if (this._familyConfig.protocol === "aa55") {
            const validation = modbus.validateAA55Response(response, "0186");
            if (!validation.valid) {
                throw new Error(`Invalid AA55 response: ${validation.error}`);
            }
            return modbus.extractAA55Payload(response);
        }

        if (this.config.protocol === "tcp" || this.config.protocol === "modbus") {
            const validation = modbus.validateTcpResponse(response, 0x03, this._familyConfig.registerCount);
            if (!validation.valid) {
                throw new Error(`Invalid Modbus TCP response: ${validation.error}`);
            }
            return modbus.extractTcpPayload(response);
        }

        // Modbus RTU over UDP
        const validation = modbus.validateRtuResponse(response, 0x03, this._familyConfig.registerCount);
        if (!validation.valid) {
            throw new Error(`Invalid Modbus RTU response: ${validation.error}`);
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
            throw error;
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
                throw new Error(`Invalid device info response: ${validation.error}`);
            }

            const payload = modbus.extractAA55Payload(response);
            return parseDeviceInfo(payload);
        } catch (err) {
            const error = new Error(`Failed to read device info: ${err.message}`);
            error.code = err.code || "READ_ERROR";
            throw error;
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
 * @returns {Promise<Array>} Array of discovered inverters
 */
function discoverInverters(options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 5000;
        const broadcastAddress = options.broadcastAddress || "255.255.255.255";
        const discoveredInverters = [];
        const socket = dgram.createSocket("udp4");

        const cleanup = () => {
            socket.removeAllListeners();
            socket.close();
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
                // Parse AA55 discovery response
                if (msg.length > 6 && msg[0] === 0xAA && msg[1] === 0x55) {
                    const inverter = parseDiscoveryResponse(msg, rinfo.address);
                    if (inverter) {
                        const exists = discoveredInverters.some(inv => inv.ip === inverter.ip);
                        if (!exists) {
                            discoveredInverters.push(inverter);
                        }
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
 * Parse discovery response
 * @param {Buffer} data - Response data
 * @param {string} ipAddress - IP address of the responder
 * @returns {Object|null} Parsed inverter info or null if invalid
 * @private
 */
function parseDiscoveryResponse(data, ipAddress) {
    try {
        if (data.length < 8) {
            return null;
        }

        const inverter = {
            ip: ipAddress,
            port: 8899,
            family: detectInverterFamily(data),
            serialNumber: extractSerialNumber(data),
            modelName: extractModelName(data)
        };

        return inverter;
    } catch (err) {
        return null;
    }
}

/**
 * Detect inverter family from response
 * @param {Buffer} data - Response data
 * @returns {string} Inverter family code
 * @private
 */
function detectInverterFamily(data) {
    return "ET";
}

/**
 * Extract serial number from response
 * @param {Buffer} data - Response data
 * @returns {string} Serial number
 * @private
 */
function extractSerialNumber(data) {
    if (data.length > 12) {
        return data.slice(6, 16).toString("ascii").replace(/[^\x20-\x7E]/g, "");
    }
    return "UNKNOWN";
}

/**
 * Extract model name from response
 * @param {Buffer} data - Response data
 * @returns {string} Model name
 * @private
 */
function extractModelName(data) {
    return "GoodWe Inverter";
}

module.exports = {
    ProtocolHandler,
    discoverInverters,
    parseDeviceInfo,
};
