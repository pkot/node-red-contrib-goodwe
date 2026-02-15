/**
 * Node-RED node for GoodWe inverter device info retrieval
 *
 * This node retrieves device identification and firmware information
 * from a GoodWe inverter.
 */

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Info Node
     * @param {Object} config - Node configuration
     */
    function GoodWeInfoNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Get configuration from config node (required)
        const configSource = RED.nodes.getNode(config.config);
        if (!configSource) {
            node.error("Configuration node not found");
            node.status({ fill: "red", shape: "ring", text: "config error" });
            return;
        }

        // Get config from configuration node
        const cfg = configSource.getConfig();
        node.host = cfg.host;
        node.family = cfg.family;
        node.configNode = configSource;

        // Register with config node for event forwarding
        node.configNode.registerUser(node);

        // Initialize status
        node.status({ fill: "grey", shape: "ring", text: "ready" });

        node.on("goodwe:error", function(err) {
            node.warn(`Protocol error: ${err.message}`);
        });

        /**
         * Perform device info read
         * @param {Object} msg - Input message
         * @param {Function} send - Send function
         * @param {Function} done - Done function
         */
        async function performInfoRead(msg, send, done) {
            try {
                // Validate host configuration
                if (!node.host || node.host === "") {
                    throw new Error("Invalid host address");
                }

                // Get shared protocol handler from config node
                const protocolHandler = node.configNode.getProtocolHandler();

                // Update status
                node.status({ fill: "blue", shape: "dot", text: "reading info..." });

                // Read device info from inverter
                const deviceInfo = await protocolHandler.readDeviceInfo();

                // Add family from config (not always in the response)
                deviceInfo.family = node.family;

                // Preserve original message properties (except payload)
                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = deviceInfo;
                outputMsg.topic = "goodwe/device_info";
                outputMsg._timestamp = new Date().toISOString();
                outputMsg._inverter = {
                    family: node.family,
                    host: node.host
                };

                // Success status
                node.status({ fill: "green", shape: "dot", text: "ok" });
                setTimeout(() => {
                    node.status({ fill: "grey", shape: "ring", text: "ready" });
                }, 2000);

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

            performInfoRead(msg, send, done);
        });

        /**
         * Cleanup on node close
         */
        node.on("close", function(done) {
            // Deregister from config node
            if (node.configNode) {
                node.configNode.deregisterUser(node);
            }

            node.status({});
            done();
        });
    }

    // Register the node
    RED.nodes.registerType("goodwe-info", GoodWeInfoNode);
};
