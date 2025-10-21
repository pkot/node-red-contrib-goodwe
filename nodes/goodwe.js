/**
 * Node-RED node for GoodWe inverter connectivity
 * 
 * This node provides connectivity to GoodWe inverters over local network
 * and retrieves runtime sensor values and configuration parameters.
 * 
 * Based on the marcelblijleven/goodwe Python library
 */

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Node Configuration
     * @param {Object} config - Node configuration
     */
    function GoodWeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Store configuration
        node.host = config.host;
        node.port = config.port || 8899;
        node.protocol = config.protocol || "udp";
        node.family = config.family || "ET";

        // Initialize status
        node.status({ fill: "grey", shape: "ring", text: "disconnected" });

        /**
         * Handle incoming messages
         */
        node.on("input", function(msg, send, done) {
            // Fallback for Node-RED pre-1.0
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            try {
                // Parse command from payload
                let command = "read"; // Default command
                if (typeof msg.payload === "string") {
                    command = msg.payload;
                } else if (typeof msg.payload === "object" && msg.payload.command) {
                    command = msg.payload.command;
                }

                // Update status
                node.status({ fill: "yellow", shape: "ring", text: "connecting..." });

                // TODO: Implement actual inverter communication
                // For now, return structured response as per design spec
                const response = {
                    success: true,
                    command: command,
                    timestamp: new Date().toISOString(),
                    data: {
                        status: "not_implemented",
                        message: "GoodWe node is under development"
                    }
                };

                // Preserve original message properties (except payload)
                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = response;
                
                // Set topic if not already present
                if (!outputMsg.topic) {
                    outputMsg.topic = `goodwe/${command}`;
                }

                // Temporary success status
                node.status({ fill: "green", shape: "dot", text: "ok" });
                setTimeout(() => {
                    node.status({ fill: "grey", shape: "ring", text: "disconnected" });
                }, 2000);

                send(outputMsg);
                done();
            } catch (err) {
                node.status({ fill: "red", shape: "ring", text: "error" });
                done(err);
            }
        });

        /**
         * Cleanup on node close
         */
        node.on("close", function(done) {
            // TODO: Close any open connections
            node.status({});
            done();
        });
    }

    // Register the node
    RED.nodes.registerType("goodwe", GoodWeNode);
};
