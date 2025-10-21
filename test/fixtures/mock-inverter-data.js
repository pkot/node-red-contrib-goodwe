/**
 * Mock Inverter Response Data for Testing
 * 
 * This file contains realistic mock data structures for GoodWe inverter responses.
 * Use these mocks for offline development and testing without requiring an actual inverter.
 * 
 * Data structures are based on the GoodWe Python library and common inverter responses.
 */

module.exports = {
    /**
     * Runtime sensor data - typical successful response
     * This represents the data returned from read_runtime_data() call
     */
    runtimeData: {
        success: true,
        command: "read",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            // PV Input (Solar Panels)
            vpv1: 245.5,        // PV1 voltage (V)
            vpv2: 242.3,        // PV2 voltage (V)
            ipv1: 8.2,          // PV1 current (A)
            ipv2: 7.9,          // PV2 current (A)
            ppv1: 2013.1,       // PV1 power (W) = vpv1 * ipv1
            ppv2: 1914.2,       // PV2 power (W) = vpv2 * ipv2
            
            // AC Output (Grid)
            vac1: 230.1,        // AC voltage phase 1 (V)
            vac2: 229.8,        // AC voltage phase 2 (V)
            vac3: 230.5,        // AC voltage phase 3 (V)
            iac1: 6.2,          // AC current phase 1 (A)
            iac2: 6.1,          // AC current phase 2 (A)
            iac3: 6.3,          // AC current phase 3 (A)
            fac1: 50.0,         // AC frequency phase 1 (Hz)
            pac: 2875,          // Active power output (W)
            
            // Battery (if applicable)
            vbattery1: 51.2,    // Battery voltage (V)
            ibattery1: -5.0,    // Battery current (A, negative = charging)
            pbattery: -256,     // Battery power (W, negative = charging)
            battery_soc: 85,    // Battery state of charge (%)
            battery_mode: 2,    // Battery mode (0=no bat, 1=discharge, 2=charge)
            
            // System Status
            temperature: 42.5,  // Inverter temperature (°C)
            work_mode: 1,       // Work mode (1=normal, 2=fault, 3=off)
            
            // Energy Statistics
            e_day: 12.5,        // Today's energy production (kWh)
            e_total: 1234.5,    // Total lifetime energy (kWh)
            h_total: 2468,      // Total working hours (h)
            
            // Grid
            e_load_day: 8.3,    // Today's load consumption (kWh)
            e_load_total: 987.2 // Total load consumption (kWh)
        }
    },

    /**
     * Runtime data for ET series inverter (single phase)
     */
    runtimeDataET: {
        success: true,
        command: "read",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            vpv1: 380.2,
            vpv2: 375.8,
            ipv1: 6.5,
            ipv2: 6.3,
            vac1: 230.2,
            iac1: 12.8,
            fac1: 50.02,
            pac: 2945,
            work_mode: 1,
            temperature: 38.5,
            e_day: 15.2,
            e_total: 5678.9,
            h_total: 8234
        }
    },

    /**
     * Device information response
     */
    deviceInfo: {
        success: true,
        command: "info",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            modelName: "GW5000-ET",
            serialNumber: "95027EST123A0001",
            firmwareVersion: "V2.01.08",
            moduleSoftwareVersion: "V2.01.08",
            dspVersion1: "V1.14",
            dspVersion2: "V1.14",
            armVersion: "V2.01.08",
            rated_power: 5000,          // Rated power (W)
            ac_output_type: 1,          // 0=single phase, 1=three phase
            protocol_version: "AA55",
            time: "2025-10-21 12:00:00"
        }
    },

    /**
     * Device information for different inverter family
     */
    deviceInfoDT: {
        success: true,
        command: "info",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            modelName: "GW30K-DT",
            serialNumber: "30045DTN123A0001",
            firmwareVersion: "V1.05.12",
            moduleSoftwareVersion: "V1.05.12",
            rated_power: 30000,
            ac_output_type: 1
        }
    },

    /**
     * Discovery response - multiple inverters found
     */
    discoveryResponse: {
        success: true,
        command: "discover",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            inverters: [
                {
                    ip: "192.168.1.100",
                    port: 8899,
                    family: "ET",
                    serialNumber: "95027EST123A0001",
                    modelName: "GW5000-ET"
                },
                {
                    ip: "192.168.1.101",
                    port: 8899,
                    family: "DT",
                    serialNumber: "30045DTN123A0002",
                    modelName: "GW30K-DT"
                }
            ]
        }
    },

    /**
     * Discovery response - single inverter found
     */
    discoverySingleInverter: {
        success: true,
        command: "discover",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            inverters: [
                {
                    ip: "192.168.1.100",
                    port: 8899,
                    family: "ET",
                    serialNumber: "95027EST123A0001",
                    modelName: "GW5000-ET"
                }
            ]
        }
    },

    /**
     * Discovery response - no inverters found
     */
    discoveryNoInverters: {
        success: true,
        command: "discover",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            inverters: []
        }
    },

    /**
     * Sensor list response
     */
    sensorsListResponse: {
        success: true,
        command: "sensors",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            sensors: [
                { id: "vpv1", name: "PV1 Voltage", unit: "V", category: "PV" },
                { id: "vpv2", name: "PV2 Voltage", unit: "V", category: "PV" },
                { id: "ipv1", name: "PV1 Current", unit: "A", category: "PV" },
                { id: "ipv2", name: "PV2 Current", unit: "A", category: "PV" },
                { id: "ppv1", name: "PV1 Power", unit: "W", category: "PV" },
                { id: "ppv2", name: "PV2 Power", unit: "W", category: "PV" },
                { id: "vac1", name: "AC Voltage R/U/A", unit: "V", category: "AC" },
                { id: "iac1", name: "AC Current R/U/A", unit: "A", category: "AC" },
                { id: "fac1", name: "AC Frequency R/U/A", unit: "Hz", category: "AC" },
                { id: "pac", name: "Active Power", unit: "W", category: "AC" },
                { id: "work_mode", name: "Work Mode", unit: "", category: "UPS" },
                { id: "temperature", name: "Internal Temperature", unit: "C", category: "UPS" },
                { id: "e_day", name: "Today Energy", unit: "kWh", category: "UPS" },
                { id: "e_total", name: "Total Energy", unit: "kWh", category: "UPS" }
            ]
        }
    },

    /**
     * Single sensor read response
     */
    singleSensorResponse: {
        success: true,
        command: "read_sensor",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            sensorId: "vpv1",
            value: 245.5,
            unit: "V",
            name: "PV1 Voltage"
        }
    },

    /**
     * Settings/configuration data response
     */
    settingsDataResponse: {
        success: true,
        command: "settings",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            grid_export_limit: 5000,        // Grid export limit (W)
            operation_mode: 1,              // Operation mode
            battery_discharge_depth: 90,    // Battery DOD (%)
            battery_charge_voltage: 57.6,   // Battery charge voltage (V)
            grid_peak_shaving: true,       // Peak shaving enabled
            backup_mode_enable: false       // Backup mode
        }
    },

    /**
     * Write setting success response
     */
    writeSettingSuccess: {
        success: true,
        command: "write_setting",
        timestamp: "2025-10-21T12:00:00.000Z",
        data: {
            setting: "grid_export_limit",
            value: 5000,
            acknowledged: true
        }
    },

    /**
     * Error responses for various scenarios
     */
    errors: {
        /**
         * Connection timeout
         */
        connectionTimeout: {
            success: false,
            command: "read",
            timestamp: "2025-10-21T12:00:00.000Z",
            error: {
                code: "CONNECTION_TIMEOUT",
                message: "Failed to connect to inverter",
                details: "Connection attempt timed out after 5000ms"
            }
        },

        /**
         * Invalid host
         */
        invalidHost: {
            success: false,
            command: "read",
            timestamp: "2025-10-21T12:00:00.000Z",
            error: {
                code: "INVALID_HOST",
                message: "Invalid host address",
                details: "Host address is not a valid IP or hostname"
            }
        },

        /**
         * Network unreachable
         */
        networkUnreachable: {
            success: false,
            command: "read",
            timestamp: "2025-10-21T12:00:00.000Z",
            error: {
                code: "NETWORK_ERROR",
                message: "Network unreachable",
                details: "EHOSTUNREACH: No route to host"
            }
        },

        /**
         * Invalid response from inverter
         */
        invalidResponse: {
            success: false,
            command: "read",
            timestamp: "2025-10-21T12:00:00.000Z",
            error: {
                code: "INVALID_RESPONSE",
                message: "Invalid response from inverter",
                details: "Response checksum mismatch or malformed packet"
            }
        },

        /**
         * Unsupported inverter family
         */
        unsupportedFamily: {
            success: false,
            command: "read",
            timestamp: "2025-10-21T12:00:00.000Z",
            error: {
                code: "UNSUPPORTED_FAMILY",
                message: "Unsupported inverter family",
                details: "Inverter family 'XYZ' is not supported"
            }
        },

        /**
         * Permission denied (for write operations)
         */
        permissionDenied: {
            success: false,
            command: "write_setting",
            timestamp: "2025-10-21T12:00:00.000Z",
            error: {
                code: "PERMISSION_DENIED",
                message: "Write operation not permitted",
                details: "Inverter rejected write command"
            }
        },

        /**
         * Invalid parameter
         */
        invalidParameter: {
            success: false,
            command: "write_setting",
            timestamp: "2025-10-21T12:00:00.000Z",
            error: {
                code: "INVALID_PARAMETER",
                message: "Invalid parameter value",
                details: "Value 9999 is outside valid range [0-5000]"
            }
        }
    },

    /**
     * Raw protocol responses (for protocol-level testing)
     */
    rawProtocol: {
        /**
         * AA55 protocol response header
         */
        aa55Header: Buffer.from([0xAA, 0x55]),

        /**
         * Sample AA55 runtime data response (simplified)
         */
        aa55RuntimeDataResponse: Buffer.from([
            0xAA, 0x55,                     // Header
            0x01, 0x7F,                     // Command
            0x00, 0x79,                     // Length
            // ... payload data (119 bytes)
            0x12, 0x34                      // Checksum
        ]),

        /**
         * Modbus RTU response example
         */
        modbusRtuResponse: Buffer.from([
            0xF7,                           // Address
            0x03,                           // Function code (read holding registers)
            0x14,                           // Byte count (20 bytes = 10 registers)
            0x09, 0x5A,                     // Register 1
            0x09, 0x4E,                     // Register 2
            // ... more registers
            0x3B, 0xA1                      // CRC
        ])
    },

    /**
     * Status indicators for testing node status
     */
    statusIndicators: {
        disconnected: {
            fill: "grey",
            shape: "ring",
            text: "disconnected"
        },
        connecting: {
            fill: "yellow",
            shape: "ring",
            text: "connecting..."
        },
        connected: {
            fill: "green",
            shape: "dot",
            text: "connected"
        },
        reading: {
            fill: "blue",
            shape: "dot",
            text: "reading..."
        },
        ok: {
            fill: "green",
            shape: "dot",
            text: "ok"
        },
        error: {
            fill: "red",
            shape: "ring",
            text: "error: connection failed"
        }
    },

    /**
     * Inverter work modes
     */
    workModes: {
        WAIT: 0,
        NORMAL: 1,
        FAULT: 2,
        PERMANENT_FAULT: 3,
        CHECK: 4,
        OFF_GRID: 5
    },

    /**
     * Battery modes
     */
    batteryModes: {
        NO_BATTERY: 0,
        DISCHARGE: 1,
        CHARGE: 2,
        STANDBY: 3
    }
};
