/**
 * GoodWe Info Node
 * 
 * Node for getting device information from GoodWe inverters.
 */

const helper = require("../lib/goodwe-helper.js");

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Info Node
     * @param {Object} config - Node configuration
     */
    function GoodWeInfoNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get config node
        node.configNode = RED.nodes.getNode(config.config);
        if (!node.configNode) {
            node.error("Missing configuration");
            return;
        }

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

                // Get device info
                const info = await helper.getDeviceInfo(node.configNode);

                // Build response
                const response = {
                    payload: info,
                    topic: msg.topic || "goodwe/device_info",
                    _timestamp: new Date().toISOString()
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
                const errorResponse = helper.createErrorResponse(err, "info");
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
    RED.nodes.registerType("goodwe-info", GoodWeInfoNode);
};
