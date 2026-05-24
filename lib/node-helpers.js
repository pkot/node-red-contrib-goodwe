/**
 * Shared helper utilities for GoodWe nodes
 *
 * This module contains utility functions shared across multiple GoodWe nodes
 * to avoid code duplication and maintain consistency.
 */

"use strict";

const { getSensors, buildSensorMetadata } = require("./sensors");

// How long a transient "ok" / "found N" status remains before reverting to
// "ready". Centralised here so all worker nodes use the same UX timing (#66).
const STATUS_RESET_MS = 2000;

/**
 * Canonical Node-RED status objects used by every worker node. Kept as a
 * single source so wording and colour scheme stay consistent (#66).
 */
const STATUSES = Object.freeze({
    ready:        { fill: "grey",   shape: "ring", text: "ready" },
    ok:           { fill: "green",  shape: "dot",  text: "ok" },
    error:        { fill: "red",    shape: "ring", text: "error" },
    configError:  { fill: "red",    shape: "ring", text: "config error" },
    configClose:  { fill: "grey",   shape: "ring", text: "config closing" },
    connecting:   { fill: "yellow", shape: "ring", text: "connecting..." },
    connected:    { fill: "green",  shape: "dot",  text: "connected" },
    disconnected: { fill: "grey",   shape: "ring", text: "ready" },
    reading:      { fill: "blue",   shape: "dot",  text: "reading..." }
});

/**
 * Set a transient success status and schedule a reset back to "ready" after
 * STATUS_RESET_MS. The timer is unref()'d so it never holds the event loop
 * open; if the node tracks an array of pending reset timers, the new one
 * is pushed into it so node.on("close") can clear them. Used by every
 * worker node post-read (#66).
 *
 * @param {Object} node - Node-RED node instance
 * @param {Object} [opts]
 * @param {Object} [opts.status] - Status to apply now (default STATUSES.ok)
 * @param {Object} [opts.resetTo] - Status to reset to (default STATUSES.ready)
 * @param {number} [opts.delay]   - Reset delay (default STATUS_RESET_MS)
 * @param {Array}  [opts.timers]  - Optional pending-timer registry on the node
 */
function setTransientStatus(node, opts = {}) {
    const status = opts.status || STATUSES.ok;
    const resetTo = opts.resetTo || STATUSES.ready;
    const delay = typeof opts.delay === "number" ? opts.delay : STATUS_RESET_MS;
    node.status(status);
    const timer = setTimeout(() => {
        node.status(resetTo);
    }, delay);
    if (typeof timer.unref === "function") timer.unref();
    if (Array.isArray(opts.timers)) opts.timers.push(timer);
    return timer;
}

/**
 * Translate a ProtocolHandler `{ state, ... }` status event into a
 * Node-RED status object. Used by the read node's status forwarding
 * listener and reusable from any worker that wants the same mapping (#66).
 *
 * @param {Object} ev - ProtocolHandler status event
 * @returns {Object} Node-RED status object
 */
function mapProtocolStatus(ev) {
    switch (ev.state) {
    case "connecting":   return STATUSES.connecting;
    case "connected":    return STATUSES.connected;
    case "disconnected": return STATUSES.disconnected;
    case "reading":      return STATUSES.reading;
    case "retrying":
        if (ev.attempt && ev.maxRetries) {
            return { fill: "orange", shape: "dot", text: `retry ${ev.attempt}/${ev.maxRetries}` };
        }
        return { fill: "orange", shape: "dot", text: "retry" };
    default:
        return { fill: "grey", shape: "ring", text: ev.state || "unknown" };
    }
}

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
    SENSOR_METADATA,
    STATUS_RESET_MS,
    STATUSES,
    setTransientStatus,
    mapProtocolStatus
};
