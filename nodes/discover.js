/**
 * Node-RED node for GoodWe inverter discovery
 * 
 * This node provides dedicated discovery functionality for finding
 * GoodWe inverters on the local network using UDP broadcast.
 */

const protocol = require("../lib/protocol.js");
const { STATUSES, setTransientStatus, parseSafeInteger } = require("../lib/node-helpers.js");

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
        // Defensive parse (#75) — guard against scientific notation, negative
        // values, etc. typed via flow import. Floor 100ms (sub-100ms is
        // unrealistic for UDP round-trip), ceiling 5 min.
        node.timeout = parseSafeInteger(config.timeout, { default: 5000, min: 100, max: 300000 });
        node.broadcastAddress = config.broadcastAddress || "255.255.255.255";
        
        // Track pending timers for cleanup
        node.statusResetTimers = [];

        // Initialize status
        node.status(STATUSES.ready);

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
                const inverters = await protocol.discoverInverters({
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

                // Canonical worker-node metadata (#65). Discover has no
                // single inverter to attach (the payload IS the list), so
                // only `timestamp` is set here.
                outputMsg.timestamp = new Date().toISOString();

                // Result status: bespoke text for found-vs-empty, then the
                // shared transient → ready reset.
                const statusText = devices.length > 0 ? `found ${devices.length}` : "no devices";
                setTransientStatus(node, {
                    status: { fill: "green", shape: "dot", text: statusText },
                    timers: node.statusResetTimers
                });

                send(outputMsg);
                if (done) done();
            } catch (err) {
                setTransientStatus(node, {
                    status: { fill: "red", shape: "ring", text: "discovery failed" },
                    timers: node.statusResetTimers
                });

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
            // Clear any pending status reset timers
            node.statusResetTimers.forEach(timer => clearTimeout(timer));
            node.statusResetTimers = [];
            
            node.status({});
            done();
        });
    }

    // Register the node
    RED.nodes.registerType("goodwe-discover", GoodWeDiscoverNode);
};
