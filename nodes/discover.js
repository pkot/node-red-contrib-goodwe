/**
 * Node-RED node for GoodWe inverter discovery
 * 
 * This node provides dedicated discovery functionality for finding
 * GoodWe inverters on the local network using UDP broadcast.
 */

const { discoverInverters } = require("../lib/protocol.js");

// Constants
const DEFAULT_PORT = 8899;

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Discover Node
     * @param {Object} config - Node configuration
     */
    function GoodWeDiscoverNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Node properties
        node.timeout = parseInt(config.timeout) || 5000;
        node.broadcastAddress = config.broadcastAddress || "255.255.255.255";

        // Initialize status
        node.status({ fill: "grey", shape: "ring", text: "ready" });

        /**
         * Perform discovery operation
         * @param {Object} msg - Input message
         * @param {Function} send - Send function
         * @param {Function} done - Done function
         */
        async function performDiscovery(msg, send, done) {
            try {
                // Update status to discovering
                node.status({ fill: "blue", shape: "dot", text: "discovering..." });

                // Perform discovery
                const inverters = await discoverInverters({
                    timeout: node.timeout,
                    broadcastAddress: node.broadcastAddress
                });

                // Format discovered inverters according to specification
                const devices = inverters.map(inv => ({
                    host: inv.ip,
                    port: inv.port || DEFAULT_PORT,
                    model: inv.modelName || "GoodWe Inverter",
                    serial: inv.serialNumber || "UNKNOWN",
                    family: inv.family || "ET",
                    protocol: "udp"
                }));

                // Preserve original message properties (except payload)
                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = {
                    devices: devices,
                    count: devices.length
                };

                // Set topic
                outputMsg.topic = "goodwe/discover";

                // Add metadata
                outputMsg._timestamp = new Date().toISOString();

                // Update status based on results
                const statusText = devices.length > 0 ? `found ${devices.length}` : "no devices";
                node.status({ fill: "green", shape: "dot", text: statusText });

                // Reset status after 2 seconds
                setTimeout(() => {
                    node.status({ fill: "grey", shape: "ring", text: "ready" });
                }, 2000);

                send(outputMsg);
                if (done) done();
            } catch (err) {
                node.status({ fill: "red", shape: "ring", text: "discovery failed" });
                
                // Reset status after 2 seconds
                setTimeout(() => {
                    node.status({ fill: "grey", shape: "ring", text: "ready" });
                }, 2000);

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

            performDiscovery(msg, send, done);
        });

        /**
         * Cleanup on node close
         */
        node.on("close", function(done) {
            node.status({});
            done();
        });
    }

    // Register the node
    RED.nodes.registerType("goodwe-discover", GoodWeDiscoverNode);
};
