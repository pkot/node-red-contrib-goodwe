/**
 * Shared helper utilities for GoodWe nodes
 *
 * This module contains utility functions shared across multiple GoodWe nodes
 * to avoid code duplication and maintain consistency.
 */

"use strict";

const { getSensors, buildSensorMetadata } = require("./sensors");

/**
 * Get sensor metadata for a given inverter family.
 * Builds metadata from the sensor definitions in sensors.js.
 *
 * @param {string} family - Inverter family (ET, DT, ES, etc.)
 * @returns {Object} Sensor metadata map keyed by sensor ID
 */
function getSensorMetadata(family) {
    try {
        const sensors = getSensors(family);
        return buildSensorMetadata(sensors);
    } catch (e) {
        // Fall back to ET if family is unknown
        const sensors = getSensors("ET");
        return buildSensorMetadata(sensors);
    }
}

/**
 * Default SENSOR_METADATA for backward compatibility (ET family)
 */
const SENSOR_METADATA = getSensorMetadata("ET");

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
        ppv1: 2013 + Math.round(Math.random() * 500),  // PV1 power (W)
        ppv2: 1914 + Math.round(Math.random() * 500),  // PV2 power (W)

        // AC Output (Grid) - single phase default
        vgrid: 230.1 + Math.random() * 5,    // On-grid L1 voltage (V)
        igrid: 6.2 + Math.random() * 2,      // On-grid L1 current (A)
        fgrid: 50.0 + Math.random() * 0.1,   // On-grid L1 frequency (Hz)
        total_inverter_power: 2875 + Math.round(Math.random() * 500), // Total power (W)

        // System Status
        temperature: 42.5 + Math.random() * 5,  // Inverter temperature (°C)
        work_mode: 1,                           // Work mode (1=normal)

        // Energy Statistics
        e_day: 12.5 + Math.random() * 5,     // Today's energy production (kWh)
        e_total: 1234.5 + Math.random() * 100, // Total lifetime energy (kWh)
        h_total: 2468 + Math.round(Math.random() * 100)  // Total working hours (h)
    };

    // Add three-phase data for DT family
    if (family === "DT" || family === "MS" || family === "D-NS") {
        baseData.vgrid2 = 229.8 + Math.random() * 5;
        baseData.vgrid3 = 230.5 + Math.random() * 5;
        baseData.igrid2 = 6.1 + Math.random() * 2;
        baseData.igrid3 = 6.3 + Math.random() * 2;
        baseData.fgrid2 = 50.0 + Math.random() * 0.1;
        baseData.fgrid3 = 50.0 + Math.random() * 0.1;
    }

    // Add battery data for hybrid models (ET, ES, EM, BP)
    if (["ET", "EH", "BT", "BH", "ES", "EM", "BP"].includes(family)) {
        baseData.vbattery1 = 51.2 + Math.random() * 2;
        baseData.ibattery1 = -5.0 + Math.random() * 10;
        baseData.pbattery1 = -256 + Math.round(Math.random() * 500);
        baseData.battery_mode = Math.floor(Math.random() * 3);
    }

    // Add battery_soc for ES family (available in main runtime block)
    if (["ES", "EM", "BP"].includes(family)) {
        baseData.battery_soc = Math.floor(85 + Math.random() * 10);
    }

    return baseData;
}

module.exports = {
    generateMockRuntimeData,
    getSensorMetadata,
    SENSOR_METADATA
};
