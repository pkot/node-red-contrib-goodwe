/**
 * GoodWe Protocol Implementation
 * 
 * Implements UDP and TCP/Modbus protocols for communicating with GoodWe inverters.
 * Based on the marcelblijleven/goodwe Python library protocols.
 */

const dgram = require("dgram");
const net = require("net");
const EventEmitter = require("events");

/**
 * AA55 Protocol Commands
 */
const AA55_COMMANDS = {
    DISCOVERY: Buffer.from([0xAA, 0x55, 0xC0, 0x7F, 0x01, 0x02, 0x00, 0x02]),
    READ_DEVICE_INFO: Buffer.from([0xAA, 0x55, 0xC0, 0x7F, 0x01, 0x01, 0x00, 0x02]),
    READ_RUNNING_DATA: Buffer.from([0xAA, 0x55, 0xC0, 0x7F, 0x01, 0x03, 0x00, 0x02])
};

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
            timeout: config.timeout || 1000,
            retries: config.retries || 3,
            ...config
        };
        
        this.socket = null;
        this.connected = false;
        this.consecutiveFailures = 0;
        this.lastError = null;
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
     * Read runtime data from inverter
     * @returns {Promise<Object>} Runtime sensor data
     */
    async readRuntimeData() {
        if (!this.connected) {
            await this.connect();
        }

        this.emit("status", { state: "reading" });

        try {
            // Send read running data command
            const response = await this.sendCommandWithRetry(AA55_COMMANDS.READ_RUNNING_DATA);
            
            // Parse the response
            const runtimeData = this._parseRuntimeData(response);
            
            return runtimeData;
        } catch (err) {
            const error = new Error(`Failed to read runtime data: ${err.message}`);
            error.code = err.code || "READ_ERROR";
            throw error;
        }
    }

    /**
     * Parse runtime data from inverter response
     * @param {Buffer} response - Raw response from inverter
     * @returns {Object} Parsed runtime data
     * @private
     */
    _parseRuntimeData(response) {
        // Validate response header
        if (response.length < 8 || response[0] !== 0xAA || response[1] !== 0x55) {
            throw new Error("Invalid response header");
        }

        // Extract payload
        const payloadLength = response.readUInt16BE(4);
        if (response.length < payloadLength + 8) {
            throw new Error("Incomplete response");
        }

        const payload = response.slice(6, 6 + payloadLength);

        // Parse sensor values from payload
        // The exact parsing depends on the inverter model/family
        // This is a general implementation for ET series inverters
        const data = {};
        
        try {
            let offset = 0;

            // PV inputs (2 strings)
            data.vpv1 = payload.readUInt16BE(offset) / 10; offset += 2;  // PV1 voltage
            data.ipv1 = payload.readUInt16BE(offset) / 10; offset += 2;  // PV1 current
            data.ppv1 = payload.readUInt16BE(offset); offset += 2;       // PV1 power
            data.vpv2 = payload.readUInt16BE(offset) / 10; offset += 2;  // PV2 voltage
            data.ipv2 = payload.readUInt16BE(offset) / 10; offset += 2;  // PV2 current
            data.ppv2 = payload.readUInt16BE(offset); offset += 2;       // PV2 power

            // AC output
            data.vac1 = payload.readUInt16BE(offset) / 10; offset += 2;  // AC voltage phase 1
            data.iac1 = payload.readUInt16BE(offset) / 10; offset += 2;  // AC current phase 1
            data.fac1 = payload.readUInt16BE(offset) / 100; offset += 2; // AC frequency phase 1
            data.pac = payload.readUInt16BE(offset); offset += 2;        // Active power

            // For three-phase inverters, read additional phases
            if (payload.length > offset + 6) {
                data.vac2 = payload.readUInt16BE(offset) / 10; offset += 2;
                data.iac2 = payload.readUInt16BE(offset) / 10; offset += 2;
                data.vac3 = payload.readUInt16BE(offset) / 10; offset += 2;
                data.iac3 = payload.readUInt16BE(offset) / 10; offset += 2;
            }

            // Battery data (if available)
            if (payload.length > offset + 10) {
                data.vbattery1 = payload.readUInt16BE(offset) / 10; offset += 2;
                data.ibattery1 = payload.readInt16BE(offset) / 10; offset += 2;  // Signed for charge/discharge
                data.pbattery = payload.readInt16BE(offset); offset += 2;        // Signed for charge/discharge
                data.battery_soc = payload.readUInt8(offset); offset += 1;
                data.battery_mode = payload.readUInt8(offset); offset += 1;
            }

            // System status
            if (payload.length > offset + 4) {
                data.temperature = payload.readInt16BE(offset) / 10; offset += 2;
                data.work_mode = payload.readUInt8(offset); offset += 1;
            }

            // Energy statistics
            if (payload.length > offset + 8) {
                data.e_day = payload.readUInt16BE(offset) / 10; offset += 2;
                data.e_total = payload.readUInt32BE(offset) / 10; offset += 4;
                data.h_total = payload.readUInt32BE(offset); offset += 4;
            }

        } catch (err) {
            throw new Error(`Failed to parse runtime data: ${err.message}`);
        }

        return data;
    }
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
                // Format: AA55 + address + command + length + data + checksum
                if (msg.length > 6 && msg[0] === 0xAA && msg[1] === 0x55) {
                    const inverter = parseDiscoveryResponse(msg, rinfo.address);
                    if (inverter) {
                        // Check if we already have this inverter (by IP)
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
                AA55_COMMANDS.DISCOVERY,
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
        // Basic validation
        if (data.length < 8) {
            return null;
        }

        // Extract serial number if present in response
        // The exact format depends on the inverter model
        // For now, return basic info
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
    // This is a simplified version
    // Real implementation would parse the actual model code from the response
    // For now, default to ET series
    return "ET";
}

/**
 * Extract serial number from response
 * @param {Buffer} data - Response data
 * @returns {string} Serial number
 * @private
 */
function extractSerialNumber(data) {
    // This is a placeholder implementation
    // Real implementation would parse the actual serial from the response
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
    // This is a placeholder implementation
    // Real implementation would parse the actual model from the response
    return "GoodWe Inverter";
}

module.exports = {
    ProtocolHandler,
    discoverInverters,
    AA55_COMMANDS
};
