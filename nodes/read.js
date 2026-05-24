/**
 * Node-RED node for GoodWe inverter read operations
 *
 * This node provides dedicated read functionality for GoodWe inverters
 * with support for multiple output formats and auto-polling.
 */

const { getSensorMetadata } = require("../lib/node-helpers.js");
const { enhanceError } = require("../lib/errors.js");

module.exports = function(RED) {
    "use strict";

    /**
     * Format runtime data based on output format setting
     * @param {Object} data - Raw runtime data
     * @param {string} format - Output format (flat/categorized/array)
     * @param {Array} sensorFilter - Optional list of sensor IDs to include
     * @returns {Object|Array} Formatted data
     */
    function formatRuntimeData(data, format, sensorFilter, family) {
        // Filter sensors if requested
        let filteredData = data;
        if (sensorFilter && sensorFilter.length > 0) {
            filteredData = {};
            sensorFilter.forEach(sensorId => {
                if (data[sensorId] !== undefined) {
                    filteredData[sensorId] = data[sensorId];
                }
            });
        }

        // Get family-aware metadata
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
     * Format data into categorized groups
     * @param {Object} data - Runtime data
     * @returns {Object} Categorized data
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
                // If no metadata, put in status category
                categorized.status[key] = data[key];
            }
        });

        // Remove empty categories
        Object.keys(categorized).forEach(category => {
            if (Object.keys(categorized[category]).length === 0) {
                delete categorized[category];
            }
        });

        return categorized;
    }

    /**
     * Format data into array with metadata
     * @param {Object} data - Runtime data
     * @returns {Array} Array of sensor objects with metadata
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
                // Default metadata if not defined
                item.name = key;
                item.unit = "";
                item.kind = "UNKNOWN";
            }

            array.push(item);
        });

        return array;
    }

    /**
     * GoodWe Read Node
     * @param {Object} config - Node configuration
     */
    function GoodWeReadNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get configuration from config node (required)
        const configSource = RED.nodes.getNode(config.config);
        if (!configSource) {
            node.error("Configuration node not found");
            node.status({ fill: "red", shape: "ring", text: "config error" });
            return;
        }
        node.configNode = configSource;

        // Expose connection fields as live getters that always reflect the
        // current config-node state. Previously these were copied at
        // construction, so a config-node redeploy left workers with stale
        // host/port/family until they were themselves redeployed (#60).
        Object.defineProperties(node, {
            host:     { get: () => node.configNode.host,     configurable: true },
            port:     { get: () => node.configNode.port,     configurable: true },
            protocol: { get: () => node.configNode.protocol, configurable: true },
            family:   { get: () => node.configNode.family,   configurable: true },
            timeout:  { get: () => node.configNode.timeout,  configurable: true },
            retries:  { get: () => node.configNode.retries,  configurable: true }
        });

        // Register with config node for event forwarding
        node.configNode.registerUser(node);

        // Node properties
        node.outputFormat = config.outputFormat || "flat";
        node.polling = parseInt(config.polling) || 0;

        // Polling interval ID
        node.pollingInterval = null;

        // Flag to prevent concurrent reads during polling
        node.isReading = false;

        // Initialize status
        node.status({ fill: "grey", shape: "ring", text: "ready" });

        // Listen for status events forwarded from config node
        node.on("goodwe:status", function(status) {
            updateNodeStatus(node, status);
        });

        node.on("goodwe:error", function(err) {
            node.warn(`Protocol error: ${err.message}`);
        });

        /**
         * Perform read operation
         * @param {Object} msg - Input message
         * @param {Function} send - Send function
         * @param {Function} done - Done function
         */
        async function performRead(msg, send, done) {
            try {
                // Validate host configuration
                if (!node.host || node.host === "") {
                    const err = new Error("Invalid host address");
                    err.code = "INVALID_HOST";
                    throw enhanceError(err, { host: node.host });
                }

                // Get shared protocol handler from config node
                const protocolHandler = node.configNode.getProtocolHandler();

                // Update status
                node.status({ fill: "blue", shape: "dot", text: "reading..." });

                // Read runtime data from inverter
                const runtimeData = await protocolHandler.readRuntimeData();

                // Parse sensor filter from input message
                let sensorFilter = null;
                if (msg.payload && typeof msg.payload === "object") {
                    if (msg.payload.sensor_id) {
                        // Single sensor
                        sensorFilter = [msg.payload.sensor_id];
                    } else if (msg.payload.sensors && Array.isArray(msg.payload.sensors)) {
                        // Multiple sensors
                        sensorFilter = msg.payload.sensors;
                    }
                }

                // Format the data based on output format
                const formattedData = formatRuntimeData(runtimeData, node.outputFormat, sensorFilter, node.family);

                // Preserve original message properties (except payload)
                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = formattedData;

                // Set topic if not already present
                if (!outputMsg.topic) {
                    outputMsg.topic = "goodwe/runtime_data";
                }

                // Canonical worker-node metadata (#65). Standard Node-RED
                // convention is top-level fields without underscore prefix.
                outputMsg.timestamp = new Date().toISOString();
                outputMsg.inverter = {
                    family: node.family,
                    host: node.host
                };

                // Success status
                if (!node.pollingInterval) {
                    // Only show temporary status if not polling
                    node.status({ fill: "green", shape: "dot", text: "ok" });
                    setTimeout(() => {
                        node.status({ fill: "grey", shape: "ring", text: "ready" });
                    }, 2000);
                }

                send(outputMsg);
                if (done) done();
            } catch (err) {
                node.status({ fill: "red", shape: "ring", text: "error" });

                if (done) {
                    done(err);
                } else {
                    node.error(err, msg);
                }
            }
        }

        /**
         * Handle incoming messages
         */
        node.on("input", function(msg, send, done) {
            // Fallback for Node-RED pre-1.0
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            performRead(msg, send, done);
        });

        /**
         * Start auto-polling if configured
         */
        if (node.polling > 0) {
            const intervalMs = node.polling * 1000;
            node.status({ fill: "blue", shape: "ring", text: `polling ${node.polling}s` });

            node.pollingInterval = setInterval(() => {
                // Guard against concurrent reads
                if (node.isReading) {
                    node.warn("Skipping poll - previous read still in progress");
                    return;
                }

                node.isReading = true;

                // Create a trigger message
                const msg = { payload: true };

                performRead(msg, (outputMsg) => {
                    node.send(outputMsg);
                    node.isReading = false;
                }, (err) => {
                    node.isReading = false;
                    if (err) {
                        node.warn(`Polling error: ${err.message}`);
                        // Don't stop polling on error
                    }
                });
            }, intervalMs);
        }

        /**
         * Cleanup on node close
         */
        node.on("close", function(done) {
            // Stop polling
            if (node.pollingInterval) {
                clearInterval(node.pollingInterval);
                node.pollingInterval = null;
            }

            // Deregister from config node (config node owns the handler)
            if (node.configNode) {
                node.configNode.deregisterUser(node);
            }

            node.status({});
            done();
        });
    }

    /**
     * Update node status based on protocol handler status
     * @param {Object} node - Node instance
     * @param {Object} status - Status object from protocol handler
     */
    function updateNodeStatus(node, status) {
        // Don't update status if polling is active
        if (node.pollingInterval) {
            return;
        }

        switch (status.state) {
        case "connecting":
            node.status({ fill: "yellow", shape: "ring", text: "connecting..." });
            break;
        case "connected":
            node.status({ fill: "green", shape: "dot", text: "connected" });
            break;
        case "disconnected":
            node.status({ fill: "grey", shape: "ring", text: "ready" });
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
    RED.nodes.registerType("goodwe-read", GoodWeReadNode);
};
