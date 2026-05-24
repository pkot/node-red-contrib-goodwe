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
 * @throws {Error} when `family` is not in FAMILY_CONFIGS — the caller is
 *   responsible for handling this (previously silently fell back to ET,
 *   which masked configuration errors). See #69.
 */
function getSensorMetadata(family) {
    const sensors = getSensors(family);
    return buildSensorMetadata(sensors);
}

/**
 * Default SENSOR_METADATA for backward compatibility (ET family)
 */
const SENSOR_METADATA = getSensorMetadata("ET");

module.exports = {
    getSensorMetadata,
    SENSOR_METADATA
};
