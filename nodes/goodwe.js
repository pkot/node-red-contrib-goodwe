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
                // TODO: Implement inverter communication
                node.status({ fill: "yellow", shape: "ring", text: "connecting..." });

                // Placeholder for actual implementation
                msg.payload = {
                    status: "not_implemented",
                    message: "GoodWe node is under development"
                };

                send(msg);
                done();
            } catch (err) {
                node.status({ fill: "red", shape: "dot", text: "error" });
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
