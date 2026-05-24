/**
 * Node-RED node for GoodWe inverter read operations
 *
 * This node provides dedicated read functionality for GoodWe inverters
 * with support for multiple output formats and auto-polling.
 */

const {
    getSensorMetadata,
    STATUSES,
    setTransientStatus,
    mapProtocolStatus,
    parseSafeInteger
} = require("../lib/node-helpers.js");
const { enhanceError } = require("../lib/errors.js");

module.exports = function(RED) {
    "use strict";

    /**
     * Format runtime data based on output format setting.
     * @param {Object} data - Raw runtime data (sensor id → value)
     * @param {string} format - Output format ("flat" | "categorized" | "array")
     * @param {Array<string>|null} sensorFilter - Optional sensor IDs to include
     *   (others are dropped). Pass null/empty to include every sensor.
     * @param {string} family - Inverter family code. Drives the sensor
     *   metadata lookup used by the "categorized" and "array" formats; ignored
     *   by "flat". Defaults to "ET" if falsy.
     * @returns {Object|Array} Formatted data
     */
    function formatRuntimeData(data, format, sensorFilter, family) {
        let filteredData = data;
        if (sensorFilter && sensorFilter.length > 0) {
            filteredData = {};
            sensorFilter.forEach(sensorId => {
                if (data[sensorId] !== undefined) {
                    filteredData[sensorId] = data[sensorId];
                }
            });
        }

        const sensorMetadata = getSensorMetadata(family || "ET");

        switch (format) {
        case "categorized":
            return formatCategorized(filteredData, sensorMetadata);
        case "array":
            return formatArray(filteredData, sensorMetadata);
        case "flat":
        default:
            return filteredData;
        }
    }

    /**
     * Format data into categorized groups (pv / battery / grid / ups / status).
     * @param {Object} data - Runtime data (sensor id → value)
     * @param {Object} sensorMetadata - Sensor metadata map from
     *   `lib/node-helpers.getSensorMetadata(family)`, used to derive each
     *   sensor's category.
     * @returns {Object} Categorized data; empty categories are stripped.
     */
    function formatCategorized(data, sensorMetadata) {
        const categorized = {
            pv: {},
            battery: {},
            grid: {},
            ups: {},
            status: {}
        };

        Object.keys(data).forEach(key => {
            const metadata = sensorMetadata[key];
            if (metadata && metadata.category) {
                if (!categorized[metadata.category]) {
                    categorized[metadata.category] = {};
                }
                categorized[metadata.category][key] = data[key];
            } else {
                categorized.status[key] = data[key];
            }
        });

        Object.keys(categorized).forEach(category => {
            if (Object.keys(categorized[category]).length === 0) {
                delete categorized[category];
            }
        });

        return categorized;
    }

    /**
     * Format data into an array with per-sensor metadata.
     * @param {Object} data - Runtime data (sensor id → value)
     * @param {Object} sensorMetadata - Sensor metadata map from
     *   `lib/node-helpers.getSensorMetadata(family)`, used to attach `name`,
     *   `unit`, and `kind` to each entry. Sensors not in the map get defaults
     *   (`name: <id>`, `unit: ""`, `kind: "UNKNOWN"`).
     * @returns {Array<{id, value, name, unit, kind}>}
     */
    function formatArray(data, sensorMetadata) {
        const array = [];

        Object.keys(data).forEach(key => {
            const metadata = sensorMetadata[key];
            const item = {
                id: key,
                value: data[key]
            };

            if (metadata) {
                item.name = metadata.name;
                item.unit = metadata.unit;
                item.kind = metadata.kind;
            } else {
                item.name = key;
                item.unit = "";
                item.kind = "UNKNOWN";
            }

            array.push(item);
        });

        return array;
    }

    function GoodWeReadNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        const configSource = RED.nodes.getNode(config.config);
        if (!configSource) {
            node.error("Configuration node not found");
            node.status(STATUSES.configError);
            return;
        }
        node.configNode = configSource;

        // Live getters (#60) — config-node field edits are reflected
        // immediately instead of leaving workers with stale copies.
        Object.defineProperties(node, {
            host:     { get: () => node.configNode.host,     configurable: true },
            port:     { get: () => node.configNode.port,     configurable: true },
            protocol: { get: () => node.configNode.protocol, configurable: true },
            family:   { get: () => node.configNode.family,   configurable: true },
            timeout:  { get: () => node.configNode.timeout,  configurable: true },
            retries:  { get: () => node.configNode.retries,  configurable: true }
        });

        node.configNode.registerUser(node);

        node.outputFormat = config.outputFormat || "flat";
        // Polling cadence in seconds; 0 = disabled. Cap at 86400s (1 day) — a
        // bigger value almost certainly came from a malformed flow import (#75).
        node.polling = parseSafeInteger(config.polling, { default: 0, min: 0, max: 86400 });

        node.pollingInterval = null;
        node.isReading = false;

        node.status(STATUSES.ready);

        node.on("goodwe:status", function(status) {
            // Polling has its own cadence-based status; suppress otherwise
            // the protocol's reading/connected events fight with it.
            if (!node.pollingInterval) {
                node.status(mapProtocolStatus(status));
            }
        });

        node.on("goodwe:error", function(err) {
            node.warn(`Protocol error: ${err.message}`);
        });

        // Stop polling when config node signals shutdown (#71) — without
        // this, a polling tick races with disconnect() and re-creates a
        // fresh handler against stale state during the deploy window.
        node.on("goodwe:shutdown", function() {
            if (node.pollingInterval) {
                clearInterval(node.pollingInterval);
                node.pollingInterval = null;
            }
            node.status(STATUSES.configClose);
        });

        async function performRead(msg, send, done) {
            try {
                if (!node.host || node.host === "") {
                    const err = new Error("Invalid host address");
                    err.code = "INVALID_HOST";
                    throw enhanceError(err, { host: node.host });
                }

                const protocolHandler = node.configNode.getProtocolHandler();
                node.status(STATUSES.reading);

                const runtimeData = await protocolHandler.readRuntimeData();

                let sensorFilter = null;
                if (msg.payload && typeof msg.payload === "object") {
                    if (msg.payload.sensor_id) {
                        sensorFilter = [msg.payload.sensor_id];
                    } else if (msg.payload.sensors && Array.isArray(msg.payload.sensors)) {
                        sensorFilter = msg.payload.sensors;
                    }
                }

                const formattedData = formatRuntimeData(runtimeData, node.outputFormat, sensorFilter, node.family);

                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = formattedData;
                if (!outputMsg.topic) {
                    outputMsg.topic = "goodwe/runtime_data";
                }
                outputMsg.timestamp = new Date().toISOString();
                outputMsg.inverter = {
                    family: node.family,
                    host: node.host
                };

                // Polling owns the status while active.
                if (!node.pollingInterval) {
                    setTransientStatus(node);
                }

                send(outputMsg);
                if (done) done();
            } catch (err) {
                node.status(STATUSES.error);

                if (done) {
                    done(err);
                } else {
                    node.error(err, msg);
                }
            }
        }

        node.on("input", function(msg, send, done) {
            // Fallback for Node-RED pre-1.0 where send/done were not supplied.
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            // Drop with feedback rather than queue (#77). The protocol queue
            // (#56) already serialises sendCommand, but an inject flood would
            // still queue unbounded — explicit drop is better UX.
            if (node.isReading) {
                node.warn("Skipping read - previous read still in progress");
                done();
                return;
            }
            node.isReading = true;
            performRead(msg, send, function(err) {
                node.isReading = false;
                done(err);
            });
        });

        if (node.polling > 0) {
            const intervalMs = node.polling * 1000;
            node.status({ fill: "blue", shape: "ring", text: `polling ${node.polling}s` });

            node.pollingInterval = setInterval(() => {
                if (node.isReading) {
                    node.warn("Skipping poll - previous read still in progress");
                    return;
                }

                node.isReading = true;

                const msg = { payload: true };

                performRead(msg, (outputMsg) => {
                    node.send(outputMsg);
                    node.isReading = false;
                }, (err) => {
                    node.isReading = false;
                    if (err) {
                        // node.error so Catch nodes fire (#77). Polling
                        // intentionally continues on error — transient
                        // timeouts shouldn't break the schedule. Wire a
                        // Catch + delay if you want backoff.
                        node.error(err, msg);
                    }
                });
            }, intervalMs);
        }

        node.on("close", function(done) {
            if (node.pollingInterval) {
                clearInterval(node.pollingInterval);
                node.pollingInterval = null;
            }
            if (node.configNode) {
                node.configNode.deregisterUser(node);
            }
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("goodwe-read", GoodWeReadNode);
};
