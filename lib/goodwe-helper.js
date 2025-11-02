/**
 * GoodWe Helper Library
 * 
 * Shared functionality for GoodWe nodes including:
 * - Protocol handling
 * - Connection management
 * - Data parsing and formatting
 * - Error handling
 */

const { ProtocolHandler, discoverInverters } = require("./protocol.js");
const mockInverterData = require("../test/fixtures/mock-inverter-data.js");

/**
 * Get or create protocol handler for a config node
 * @param {Object} configNode - Config node instance
 * @returns {ProtocolHandler} Protocol handler instance
 */
function getProtocolHandler(configNode) {
    if (!configNode.protocolHandler) {
        configNode.protocolHandler = new ProtocolHandler({
            host: configNode.host,
            port: configNode.port,
            protocol: configNode.protocol,
            timeout: configNode.timeout,
            retries: configNode.retries
        });
    }
    return configNode.protocolHandler;
}

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
 * Read runtime data from inverter
 * @param {Object} configNode - Config node instance
 * @param {Object} options - Read options (e.g., sensor filter)
 * @returns {Promise<Object>} Runtime data
 */
async function readRuntimeData(configNode, options = {}) {
    const handler = getProtocolHandler(configNode);
    
    // Connect if not already connected
    await handler.connect();
    
    // For now, generate mock data
    // TODO: Replace with actual protocol communication
    const data = generateMockRuntimeData(configNode.family);
    
    // Filter sensors if requested
    if (options.sensor_id) {
        return { [options.sensor_id]: data[options.sensor_id] };
    } else if (options.sensors && Array.isArray(options.sensors)) {
        const filtered = {};
        options.sensors.forEach(id => {
            if (data[id] !== undefined) {
                filtered[id] = data[id];
            }
        });
        return filtered;
    }
    
    return data;
}

/**
 * Get device information
 * @param {Object} configNode - Config node instance
 * @returns {Promise<Object>} Device information
 */
async function getDeviceInfo(configNode) {
    const handler = getProtocolHandler(configNode);
    await handler.connect();
    
    // Mock device info
    // TODO: Replace with actual protocol communication
    return {
        model_name: "GW5000-EH",
        serial_number: "ETxxxxxxxx",
        rated_power: 5000,
        firmware: "V1.2.3",
        arm_firmware: "V2.0.1",
        modbus_version: 2,
        family: configNode.family
    };
}

/**
 * Discover inverters on network
 * @param {Object} options - Discovery options
 * @returns {Promise<Array>} List of discovered inverters
 */
async function discover(options = {}) {
    const timeout = options.timeout || 5000;
    const inverters = await discoverInverters({ timeout });
    return inverters;
}

/**
 * Format output data
 * @param {Object} data - Raw data
 * @param {string} format - Output format (flat, categorized, array)
 * @returns {Object|Array} Formatted data
 */
function formatOutput(data, format = "flat") {
    if (format === "flat") {
        return data;
    } else if (format === "categorized") {
        return categorizeSensorData(data);
    } else if (format === "array") {
        return convertToArray(data);
    }
    return data;
}

/**
 * Categorize sensor data by type
 * @param {Object} data - Flat sensor data
 * @returns {Object} Categorized data
 */
function categorizeSensorData(data) {
    const categorized = {
        pv: {},
        battery: {},
        grid: {},
        energy: {},
        status: {}
    };
    
    Object.keys(data).forEach(key => {
        if (key.startsWith("vpv") || key.startsWith("ipv") || key.startsWith("ppv")) {
            categorized.pv[key] = data[key];
        } else if (key.includes("battery")) {
            categorized.battery[key] = data[key];
        } else if (key.startsWith("vac") || key.startsWith("iac") || key.startsWith("fac") || key === "pac") {
            categorized.grid[key] = data[key];
        } else if (key.startsWith("e_") || key.startsWith("h_")) {
            categorized.energy[key] = data[key];
        } else {
            categorized.status[key] = data[key];
        }
    });
    
    return categorized;
}

/**
 * Convert sensor data to array format with metadata
 * @param {Object} data - Flat sensor data
 * @returns {Array} Array of sensor objects
 */
function convertToArray(data) {
    return Object.keys(data).map(key => ({
        id: key,
        value: data[key],
        // TODO: Add more metadata (name, unit, kind)
    }));
}

/**
 * Update node status
 * @param {Object} node - Node instance
 * @param {string} state - Status state
 * @param {Object} options - Additional options
 */
function updateNodeStatus(node, state, options = {}) {
    switch (state) {
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
    case "writing":
        node.status({ fill: "blue", shape: "dot", text: "writing..." });
        break;
    case "discovering":
        node.status({ fill: "blue", shape: "dot", text: "discovering..." });
        break;
    case "success":
        node.status({ fill: "green", shape: "dot", text: "ok" });
        break;
    case "retrying":
        if (options.attempt && options.maxRetries) {
            node.status({ 
                fill: "orange", 
                shape: "dot", 
                text: `retry ${options.attempt}/${options.maxRetries}` 
            });
        }
        break;
    case "error":
        node.status({ 
            fill: "red", 
            shape: "ring", 
            text: `error${options.message ? ": " + options.message : ""}` 
        });
        break;
    default:
        node.status({ fill: "grey", shape: "ring", text: state });
    }
}

/**
 * Create error response
 * @param {Error} error - Error object
 * @param {string} command - Command that failed
 * @returns {Object} Error response object
 */
function createErrorResponse(error, command) {
    return {
        success: false,
        command: command,
        timestamp: new Date().toISOString(),
        error: {
            code: error.code || "ERROR",
            message: error.message,
            details: error.stack
        }
    };
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
 * Write configuration setting
 * @param {Object} configNode - Config node instance
 * @param {string} settingId - Setting identifier
 * @param {any} value - Value to write
 * @returns {Promise<Object>} Write result
 */
async function writeSetting(configNode, settingId, value) {
    // Validate the setting
    const validation = validateSetting(settingId, value);
    if (!validation.valid) {
        const error = new Error(validation.error);
        error.code = "VALIDATION_ERROR";
        throw error;
    }
    
    // Store previous value for response
    const previousValue = mockConfigState[settingId];
    
    // Update the setting (mock)
    // TODO: Replace with actual protocol communication
    mockConfigState[settingId] = value;
    
    return {
        setting_id: settingId,
        value: value,
        previous_value: previousValue
    };
}

module.exports = {
    getProtocolHandler,
    generateMockRuntimeData,
    readRuntimeData,
    getDeviceInfo,
    discover,
    formatOutput,
    categorizeSensorData,
    convertToArray,
    updateNodeStatus,
    createErrorResponse,
    validateSetting,
    writeSetting,
    mockConfigState
};
