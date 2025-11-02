/**
 * GoodWe Discover Node
 * 
 * Node for discovering GoodWe inverters on the local network.
 */

const helper = require("../lib/goodwe-helper.js");

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Discover Node
     * @param {Object} config - Node configuration
     */
    function GoodWeDiscoverNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Store configuration
        node.timeout = parseInt(config.timeout) || 5000;

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
                helper.updateNodeStatus(node, "discovering");

                // Get timeout from payload or config
                const timeout = msg.payload?.timeout || node.timeout;

                // Discover inverters
                const devices = await helper.discover({ timeout });

                // Build response
                const response = {
                    payload: {
                        devices: devices,
                        count: devices.length
                    },
                    topic: msg.topic || "goodwe/discover",
                    _timestamp: new Date().toISOString()
                };

                // Preserve original message properties (except payload)
                const outputMsg = Object.assign({}, msg, response);

                helper.updateNodeStatus(node, "success");
                setTimeout(() => {
                    helper.updateNodeStatus(node, "disconnected");
                }, 2000);

                send(outputMsg);
                done();
            } catch (err) {
                const errorResponse = helper.createErrorResponse(err, "discover");
                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = errorResponse;
                outputMsg.topic = msg.topic || "goodwe/error";

                helper.updateNodeStatus(node, "error", { message: err.message });
                send(outputMsg);
                done();
            }
        });

        /**
         * Cleanup on node close
         */
        node.on("close", function(done) {
            helper.updateNodeStatus(node, "disconnected");
            done();
        });
    }

    // Register the node
    RED.nodes.registerType("goodwe-discover", GoodWeDiscoverNode);
};
