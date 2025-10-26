/**
 * Node-RED node for GoodWe inverter connectivity
 * 
 * This node provides connectivity to GoodWe inverters over local network
 * and retrieves runtime sensor values and configuration parameters.
 * 
 * Based on the marcelblijleven/goodwe Python library
 */

const { ProtocolHandler, discoverInverters } = require("../lib/protocol.js");
const mockInverterData = require("../test/fixtures/mock-inverter-data.js");

module.exports = function(RED) {
    "use strict";

    /**
     * Mock runtime data generator for testing and development
     * TODO: Replace with actual inverter communication
     */
    function generateMockRuntimeData(family) {
        const baseData = {
            // PV Input (Solar Panels)
            vpv1: 245.5 + Math.random() * 50,    // PV1 voltage (V)
            vpv2: 242.3 + Math.random() * 50,    // PV2 voltage (V)
            ipv1: 8.2 + Math.random() * 2,       // PV1 current (A)
            ipv2: 7.9 + Math.random() * 2,       // PV2 current (A)
            ppv1: 2013.1 + Math.random() * 500,  // PV1 power (W)
            ppv2: 1914.2 + Math.random() * 500,  // PV2 power (W)
            
            // AC Output (Grid) - single phase default
            vac1: 230.1 + Math.random() * 5,     // AC voltage phase 1 (V)
            iac1: 6.2 + Math.random() * 2,       // AC current phase 1 (A)
            fac1: 50.0 + Math.random() * 0.1,    // AC frequency phase 1 (Hz)
            pac: 2875 + Math.random() * 500,     // Active power output (W)
            
            // System Status
            temperature: 42.5 + Math.random() * 5,  // Inverter temperature (°C)
            work_mode: 1,                           // Work mode (1=normal)
            
            // Energy Statistics
            e_day: 12.5 + Math.random() * 5,     // Today's energy production (kWh)
            e_total: 1234.5 + Math.random() * 100, // Total lifetime energy (kWh)
            h_total: 2468 + Math.random() * 100  // Total working hours (h)
        };

        // Add three-phase data for DT family
        if (family === "DT" || family === "MS" || family === "D-NS") {
            baseData.vac2 = 229.8 + Math.random() * 5;  // AC voltage phase 2 (V)
            baseData.vac3 = 230.5 + Math.random() * 5;  // AC voltage phase 3 (V)
            baseData.iac2 = 6.1 + Math.random() * 2;    // AC current phase 2 (A)
            baseData.iac3 = 6.3 + Math.random() * 2;    // AC current phase 3 (A)
        }

        // Add battery data for hybrid models (ET, ES, EM, BP)
        if (["ET", "EH", "BT", "BH", "ES", "EM", "BP"].includes(family)) {
            baseData.vbattery1 = 51.2 + Math.random() * 2;    // Battery voltage (V)
            baseData.ibattery1 = -5.0 + Math.random() * 10;   // Battery current (A)
            baseData.pbattery = -256 + Math.random() * 500;   // Battery power (W)
            baseData.battery_soc = Math.floor(85 + Math.random() * 10); // Battery SOC (%)
            baseData.battery_mode = Math.floor(Math.random() * 3);      // Battery mode
        }

        return baseData;
    }

    /**
     * Mock configuration state (in-memory)
     * TODO: Replace with actual inverter communication
     */
    const mockConfigState = structuredClone(mockInverterData.configuration.currentState);

    /**
     * Validate setting value
     * @param {string} settingId - Setting identifier
     * @param {any} value - Value to validate
     * @returns {Object} Validation result { valid: boolean, error?: string }
     */
    function validateSetting(settingId, value) {
        const settingDef = mockInverterData.configuration.settings[settingId];
        
        if (!settingDef) {
            return { 
                valid: false, 
                error: `Unknown setting: ${settingId}` 
            };
        }

        if (!settingDef.writable) {
            return { 
                valid: false, 
                error: `Setting ${settingId} is read-only` 
            };
        }

        // Validate based on setting type
        if (settingDef.values) {
            // Enum type - check against allowed values
            if (!settingDef.values.includes(value)) {
                return { 
                    valid: false, 
                    error: `Invalid ${settingDef.name}: ${value}. Must be one of: ${settingDef.values.join(", ")}` 
                };
            }
        } else if (typeof settingDef.min === "number" && typeof settingDef.max === "number") {
            // Numeric type - check range and type
            const numValue = Number(value);
            if (isNaN(numValue)) {
                return { 
                    valid: false, 
                    error: `Invalid ${settingDef.name}: ${value}. Must be a number` 
                };
            }
            if (numValue < settingDef.min || numValue > settingDef.max) {
                return { 
                    valid: false, 
                    error: `${settingDef.name} out of range: ${value}. Valid range: ${settingDef.min}-${settingDef.max}${settingDef.unit}` 
                };
            }
        } else {
            // For other types (boolean, string without enum), just check it's not null/undefined
            if (value === null || value === undefined) {
                return {
                    valid: false,
                    error: `${settingDef.name} cannot be null or undefined`
                };
            }
        }

        return { valid: true };
    }

    /**
     * GoodWe Node Configuration
     * @param {Object} config - Node configuration
     */
    function GoodWeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Store configuration
        node.host = config.host;
        node.port = config.port || 8899;
        node.protocol = config.protocol || "udp";
        node.family = config.family || "ET";

        // Initialize protocol handler
        node.protocolHandler = null;
        
        // Initialize status
        node.status({ fill: "grey", shape: "ring", text: "disconnected" });

        /**
         * Handle incoming messages
         */
        node.on("input", async function(msg, send, done) {
            // Fallback for Node-RED pre-1.0
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            try {
                // Parse command from payload
                let command = "read"; // Default command
                if (typeof msg.payload === "string" && msg.payload !== "") {
                    command = msg.payload;
                } else if (typeof msg.payload === "object" && msg.payload.command) {
                    command = msg.payload.command;
                }

                // Handle discovery command
                if (command === "discover") {
                    await handleDiscovery(node, msg, send, done);
                    return;
                }

                // Handle configuration commands
                if (command.startsWith("read_setting") || 
                    command === "read_settings" ||
                    command.startsWith("write_setting") ||
                    command.startsWith("get_") ||
                    command.startsWith("set_")) {
                    await handleConfigurationCommand(node, msg, send, done);
                    return;
                }

                // For other commands, ensure we have a valid host
                if (!node.host || node.host === "" || node.host === "invalid") {
                    throw new Error("Invalid host address");
                }

                // Initialize protocol handler if not exists
                if (!node.protocolHandler) {
                    node.protocolHandler = new ProtocolHandler({
                        host: node.host,
                        port: node.port,
                        protocol: node.protocol,
                        timeout: 1000,
                        retries: 3
                    });

                    // Setup status event handlers
                    node.protocolHandler.on("status", (status) => {
                        updateNodeStatus(node, status);
                    });

                    node.protocolHandler.on("error", (err) => {
                        node.warn(`Protocol error: ${err.message}`);
                    });
                }

                // Update status
                node.status({ fill: "yellow", shape: "ring", text: "connecting..." });

                // Connect to inverter
                await node.protocolHandler.connect();

                // Execute command
                const runtimeData = generateMockRuntimeData(node.family);
                
                const response = {
                    success: true,
                    command: command,
                    timestamp: new Date().toISOString(),
                    data: runtimeData
                };

                // Preserve original message properties (except payload)
                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = response;
                
                // Set topic if not already present
                if (!outputMsg.topic) {
                    outputMsg.topic = `goodwe/${command}`;
                }

                // Success status
                node.status({ fill: "green", shape: "dot", text: "ok" });
                setTimeout(() => {
                    node.status({ fill: "grey", shape: "ring", text: "disconnected" });
                }, 2000);

                send(outputMsg);
                done();
            } catch (err) {
                // Error response
                const errorResponse = {
                    success: false,
                    command: msg.payload?.command || "read",
                    timestamp: new Date().toISOString(),
                    error: {
                        code: err.code || "RUNTIME_ERROR",
                        message: err.message,
                        details: err.stack
                    }
                };

                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = errorResponse;
                
                if (!outputMsg.topic) {
                    outputMsg.topic = `goodwe/${msg.payload?.command || "read"}`;
                }

                node.status({ fill: "red", shape: "ring", text: "error" });
                send(outputMsg);
                done();
            }
        });

        /**
         * Cleanup on node close
         */
        node.on("close", async function(done) {
            // Close protocol handler connection
            if (node.protocolHandler) {
                await node.protocolHandler.disconnect();
                node.protocolHandler = null;
            }
            node.status({});
            done();
        });
    }

    /**
     * Handle configuration commands
     * @param {Object} node - Node instance
     * @param {Object} msg - Input message
     * @param {Function} send - Send function
     * @param {Function} done - Done function
     */
    async function handleConfigurationCommand(node, msg, send, done) {
        try {
            const command = msg.payload?.command || msg.payload;
            const payload = msg.payload;

            node.status({ fill: "blue", shape: "dot", text: "reading config..." });

            let response = {
                success: true,
                command: command,
                timestamp: new Date().toISOString(),
                data: {}
            };

            // Handle different configuration commands
            switch (command) {
            case "read_settings":
                // Read all settings
                response.data = structuredClone(mockConfigState);
                break;

            case "read_setting": {
                // Read specific setting
                const settingId = payload.setting_id;
                if (!settingId) {
                    const error = new Error("Missing required parameter: setting_id");
                    error.code = "MISSING_PARAMETER";
                    throw error;
                }

                if (!mockInverterData.configuration.settings[settingId]) {
                    const error = new Error(`Unknown setting: ${settingId}`);
                    error.code = "INVALID_SETTING";
                    throw error;
                }

                response.data = {
                    setting_id: settingId,
                    value: mockConfigState[settingId],
                    unit: mockInverterData.configuration.settings[settingId].unit,
                    name: mockInverterData.configuration.settings[settingId].name
                };
                break;
            }

            case "write_setting": {
                // Write specific setting
                const settingId = payload.setting_id;
                const value = payload.value;

                if (!settingId) {
                    const error = new Error("Missing required parameter: setting_id");
                    error.code = "MISSING_PARAMETER";
                    throw error;
                }

                if (value === undefined || value === null) {
                    const error = new Error("Missing required parameter: value");
                    error.code = "MISSING_PARAMETER";
                    throw error;
                }

                // Validate the setting
                const validation = validateSetting(settingId, value);
                if (!validation.valid) {
                    const error = new Error(validation.error);
                    error.code = "VALIDATION_ERROR";
                    throw error;
                }

                // Store previous value for rollback
                const previousValue = mockConfigState[settingId];

                // Update the setting (mock)
                mockConfigState[settingId] = value;

                node.status({ fill: "blue", shape: "dot", text: "writing config..." });

                response.data = {
                    setting_id: settingId,
                    value: value,
                    previous_value: previousValue
                };
                break;
            }

            case "get_grid_export_limit":
                response.data = {
                    limit: mockConfigState.grid_export_limit
                };
                break;

            case "set_grid_export_limit": {
                const limit = payload.limit;

                if (limit === undefined || limit === null) {
                    const error = new Error("Missing required parameter: limit");
                    error.code = "MISSING_PARAMETER";
                    throw error;
                }

                // Validate grid export limit
                const validation = validateSetting("grid_export_limit", limit);
                if (!validation.valid) {
                    const error = new Error(validation.error);
                    error.code = "VALIDATION_ERROR";
                    throw error;
                }

                const previousLimit = mockConfigState.grid_export_limit;
                mockConfigState.grid_export_limit = limit;

                node.status({ fill: "blue", shape: "dot", text: "setting export limit..." });

                response.data = {
                    limit: limit,
                    previous_limit: previousLimit
                };
                break;
            }

            case "get_operation_mode":
                response.data = {
                    mode: mockConfigState.operation_mode,
                    eco_mode_power: mockConfigState.eco_mode_power,
                    eco_mode_soc: mockConfigState.eco_mode_soc
                };
                break;

            case "set_operation_mode": {
                const mode = payload.mode;
                const ecoModePower = payload.eco_mode_power || 100;
                const ecoModeSoc = payload.eco_mode_soc || 100;

                if (!mode) {
                    const error = new Error("Missing required parameter: mode");
                    error.code = "MISSING_PARAMETER";
                    throw error;
                }

                // Validate operation mode
                const validation = validateSetting("operation_mode", mode);
                if (!validation.valid) {
                    const error = new Error(validation.error);
                    error.code = "VALIDATION_ERROR";
                    throw error;
                }

                const previousMode = mockConfigState.operation_mode;
                mockConfigState.operation_mode = mode;
                
                // Only set eco mode parameters if the mode is ECO
                if (mode === "ECO") {
                    mockConfigState.eco_mode_power = ecoModePower;
                    mockConfigState.eco_mode_soc = ecoModeSoc;
                }

                node.status({ fill: "blue", shape: "dot", text: "setting operation mode..." });

                response.data = {
                    mode: mode,
                    previous_mode: previousMode
                };
                
                // Include eco mode parameters in response if mode is ECO
                if (mode === "ECO") {
                    response.data.eco_mode_power = ecoModePower;
                    response.data.eco_mode_soc = ecoModeSoc;
                }
                break;
            }

            case "get_battery_dod":
                response.data = {
                    dod: mockConfigState.battery_dod
                };
                break;

            case "set_battery_dod": {
                const dod = payload.dod;

                if (dod === undefined || dod === null) {
                    const error = new Error("Missing required parameter: dod");
                    error.code = "MISSING_PARAMETER";
                    throw error;
                }

                // Validate battery DoD
                const validation = validateSetting("battery_dod", dod);
                if (!validation.valid) {
                    const error = new Error(validation.error);
                    error.code = "VALIDATION_ERROR";
                    throw error;
                }

                const previousDod = mockConfigState.battery_dod;
                mockConfigState.battery_dod = dod;

                node.status({ fill: "blue", shape: "dot", text: "setting battery DoD..." });

                response.data = {
                    dod: dod,
                    previous_dod: previousDod
                };
                break;
            }

            default: {
                const error = new Error(`Unknown configuration command: ${command}`);
                error.code = "UNKNOWN_COMMAND";
                throw error;
            }
            }

            // Prepare output message
            const outputMsg = Object.assign({}, msg);
            outputMsg.payload = response;
            outputMsg.topic = outputMsg.topic || `goodwe/${command}`;

            node.status({ fill: "green", shape: "dot", text: "ok" });
            setTimeout(() => {
                node.status({ fill: "grey", shape: "ring", text: "disconnected" });
            }, 2000);

            send(outputMsg);
            done();
        } catch (err) {
            const errorResponse = {
                success: false,
                command: msg.payload?.command || msg.payload,
                timestamp: new Date().toISOString(),
                error: {
                    code: err.code || "CONFIG_ERROR",
                    message: err.message,
                    details: err.stack
                }
            };

            const outputMsg = Object.assign({}, msg);
            outputMsg.payload = errorResponse;
            outputMsg.topic = outputMsg.topic || "goodwe/error";

            node.status({ fill: "red", shape: "ring", text: "config error" });
            send(outputMsg);
            done();
        }
    }

    /**
     * Handle discovery command
     * @param {Object} node - Node instance
     * @param {Object} msg - Input message
     * @param {Function} send - Send function
     * @param {Function} done - Done function
     */
    async function handleDiscovery(node, msg, send, done) {
        try {
            node.status({ fill: "blue", shape: "dot", text: "discovering..." });

            const timeout = msg.payload?.timeout || 5000;
            const inverters = await discoverInverters({ timeout });

            const response = {
                success: true,
                command: "discover",
                timestamp: new Date().toISOString(),
                data: {
                    count: inverters.length,
                    inverters: inverters
                }
            };

            const outputMsg = Object.assign({}, msg);
            outputMsg.payload = response;
            outputMsg.topic = outputMsg.topic || "goodwe/discover";

            node.status({ fill: "green", shape: "dot", text: `found ${inverters.length}` });
            setTimeout(() => {
                node.status({ fill: "grey", shape: "ring", text: "disconnected" });
            }, 2000);

            send(outputMsg);
            done();
        } catch (err) {
            const errorResponse = {
                success: false,
                command: "discover",
                timestamp: new Date().toISOString(),
                error: {
                    code: err.code || "DISCOVERY_ERROR",
                    message: err.message,
                    details: err.stack
                }
            };

            const outputMsg = Object.assign({}, msg);
            outputMsg.payload = errorResponse;
            outputMsg.topic = outputMsg.topic || "goodwe/error";

            node.status({ fill: "red", shape: "ring", text: "discovery failed" });
            send(outputMsg);
            done();
        }
    }

    /**
     * Update node status based on protocol handler status
     * @param {Object} node - Node instance
     * @param {Object} status - Status object from protocol handler
     */
    function updateNodeStatus(node, status) {
        switch (status.state) {
        case "connecting":
            node.status({ fill: "yellow", shape: "ring", text: "connecting..." });
            break;
        case "connected":
            node.status({ fill: "green", shape: "dot", text: "connected" });
            break;
        case "disconnected":
            node.status({ fill: "grey", shape: "ring", text: "disconnected" });
            break;
        case "reading":
            node.status({ fill: "blue", shape: "dot", text: "reading..." });
            break;
        case "retrying":
            if (status.attempt && status.maxRetries) {
                node.status({ 
                    fill: "orange", 
                    shape: "dot", 
                    text: `retry ${status.attempt}/${status.maxRetries}` 
                });
            }
            break;
        default:
            node.status({ fill: "grey", shape: "ring", text: status.state });
        }
    }

    // Register the node
    RED.nodes.registerType("goodwe", GoodWeNode);
};
