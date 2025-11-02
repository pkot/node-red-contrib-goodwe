/**
 * GoodWe Read Node
 * 
 * Node for reading runtime sensor data from GoodWe inverters.
 */

const helper = require("../lib/goodwe-helper.js");

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Read Node
     * @param {Object} config - Node configuration
     */
    function GoodWeReadNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get config node
        node.configNode = RED.nodes.getNode(config.config);
        if (!node.configNode) {
            node.error("Missing configuration");
            return;
        }

        // Store configuration
        node.outputFormat = config.outputFormat || "flat";
        node.pollingInterval = parseInt(config.pollingInterval) || 0;
        
        // Polling timer
        node.pollingTimer = null;

        // Initialize status
        helper.updateNodeStatus(node, "disconnected");

        /**
         * Handle incoming messages
         */
        node.on("input", async function(msg, send, done) {
            // Fallback for Node-RED pre-1.0
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            try {
                helper.updateNodeStatus(node, "reading");

                // Parse input options
                const options = {};
                if (typeof msg.payload === "object" && msg.payload !== null) {
                    if (msg.payload.sensor_id) {
                        options.sensor_id = msg.payload.sensor_id;
                    } else if (msg.payload.sensors) {
                        options.sensors = msg.payload.sensors;
                    }
                }

                // Read runtime data
                const data = await helper.readRuntimeData(node.configNode, options);
                
                // Format output
                const formattedData = helper.formatOutput(data, node.outputFormat);

                // Build response
                const response = {
                    payload: formattedData,
                    topic: msg.topic || "goodwe/runtime_data",
                    _timestamp: new Date().toISOString(),
                    _inverter: {
                        family: node.configNode.family,
                        host: node.configNode.host
                    }
                };

                // Preserve original message properties (except payload)
                const outputMsg = Object.assign({}, msg, response);

                helper.updateNodeStatus(node, "success");
                setTimeout(() => {
                    helper.updateNodeStatus(node, "connected");
                }, 2000);

                send(outputMsg);
                done();
            } catch (err) {
                const errorResponse = helper.createErrorResponse(err, "read");
                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = errorResponse;
                outputMsg.topic = msg.topic || "goodwe/error";

                helper.updateNodeStatus(node, "error", { message: err.message });
                send(outputMsg);
                done();
            }
        });

        /**
         * Start auto-polling if configured
         */
        if (node.pollingInterval > 0) {
            node.pollingTimer = setInterval(() => {
                node.receive({});
            }, node.pollingInterval * 1000);
        }

        /**
         * Cleanup on node close
         */
        node.on("close", function(done) {
            if (node.pollingTimer) {
                clearInterval(node.pollingTimer);
                node.pollingTimer = null;
            }
            helper.updateNodeStatus(node, "disconnected");
            done();
        });
    }

    // Register the node
    RED.nodes.registerType("goodwe-read", GoodWeReadNode);
};
