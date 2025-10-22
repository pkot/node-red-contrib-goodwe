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
    READ_DEVICE_INFO: Buffer.from([0xAA, 0x55, 0xC0, 0x7F, 0x01, 0x01, 0x00, 0x02])
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
