/**
 * GoodWe Write Node
 * 
 * Node for writing configuration settings to GoodWe inverters.
 * WARNING: Writing settings can damage your inverter or void warranty.
 */

const helper = require("../lib/goodwe-helper.js");

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Write Node
     * @param {Object} config - Node configuration
     */
    function GoodWeWriteNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get config node
        node.configNode = RED.nodes.getNode(config.config);
        if (!node.configNode) {
            node.error("Missing configuration");
            return;
        }

        // Store configuration
        node.confirm = config.confirm || false;

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
                // Validate input
                if (!msg.payload || typeof msg.payload !== "object") {
                    throw new Error("Payload must be an object with setting_id and value");
                }

                const settingId = msg.payload.setting_id;
                const value = msg.payload.value;

                if (!settingId) {
                    throw new Error("Missing required parameter: setting_id");
                }

                if (value === undefined || value === null) {
                    throw new Error("Missing required parameter: value");
                }

                // Check confirmation if required
                if (node.confirm && !msg.payload.confirm) {
                    throw new Error("Confirmation required. Set msg.payload.confirm = true");
                }

                helper.updateNodeStatus(node, "writing");

                // Write setting
                const result = await helper.writeSetting(node.configNode, settingId, value);

                // Build response
                const response = {
                    payload: {
                        success: true,
                        ...result
                    },
                    topic: msg.topic || "goodwe/write_confirm",
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
                const errorResponse = helper.createErrorResponse(err, "write");
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
    RED.nodes.registerType("goodwe-write", GoodWeWriteNode);
};
