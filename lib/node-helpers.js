/**
 * Shared helper utilities for GoodWe nodes
 * 
 * This module contains utility functions shared across multiple GoodWe nodes
 * to avoid code duplication and maintain consistency.
 */

/**
 * Mock runtime data generator for testing and development
 * TODO: Replace with actual inverter communication
 * 
 * @param {string} family - Inverter family (ET, DT, ES, etc.)
 * @returns {Object} Mock runtime data
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
 * Sensor metadata for categorization and array format
 * Maps sensor IDs to their display properties
 */
const SENSOR_METADATA = {
    // PV sensors
    vpv1: { name: "PV1 Voltage", unit: "V", kind: "PV", category: "pv" },
    vpv2: { name: "PV2 Voltage", unit: "V", kind: "PV", category: "pv" },
    ipv1: { name: "PV1 Current", unit: "A", kind: "PV", category: "pv" },
    ipv2: { name: "PV2 Current", unit: "A", kind: "PV", category: "pv" },
    ppv1: { name: "PV1 Power", unit: "W", kind: "PV", category: "pv" },
    ppv2: { name: "PV2 Power", unit: "W", kind: "PV", category: "pv" },
    
    // Battery sensors
    vbattery1: { name: "Battery Voltage", unit: "V", kind: "BAT", category: "battery" },
    ibattery1: { name: "Battery Current", unit: "A", kind: "BAT", category: "battery" },
    pbattery: { name: "Battery Power", unit: "W", kind: "BAT", category: "battery" },
    battery_soc: { name: "Battery SoC", unit: "%", kind: "BAT", category: "battery" },
    battery_mode: { name: "Battery Mode", unit: "", kind: "BAT", category: "battery" },
    
    // Grid/AC sensors
    vac1: { name: "AC Voltage Phase 1", unit: "V", kind: "AC", category: "grid" },
    vac2: { name: "AC Voltage Phase 2", unit: "V", kind: "AC", category: "grid" },
    vac3: { name: "AC Voltage Phase 3", unit: "V", kind: "AC", category: "grid" },
    iac1: { name: "AC Current Phase 1", unit: "A", kind: "AC", category: "grid" },
    iac2: { name: "AC Current Phase 2", unit: "A", kind: "AC", category: "grid" },
    iac3: { name: "AC Current Phase 3", unit: "A", kind: "AC", category: "grid" },
    fac1: { name: "AC Frequency Phase 1", unit: "Hz", kind: "AC", category: "grid" },
    pac: { name: "Active Power", unit: "W", kind: "AC", category: "grid" },
    
    // Energy sensors
    e_day: { name: "Today Energy", unit: "kWh", kind: "ENERGY", category: "energy" },
    e_total: { name: "Total Energy", unit: "kWh", kind: "ENERGY", category: "energy" },
    h_total: { name: "Total Hours", unit: "h", kind: "ENERGY", category: "energy" },
    
    // Status sensors
    temperature: { name: "Inverter Temperature", unit: "°C", kind: "STATUS", category: "status" },
    work_mode: { name: "Work Mode", unit: "", kind: "STATUS", category: "status" }
};

module.exports = {
    generateMockRuntimeData,
    SENSOR_METADATA
};
