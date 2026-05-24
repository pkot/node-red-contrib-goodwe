/**
 * Node-RED node for GoodWe inverter discovery
 * 
 * This node provides dedicated discovery functionality for finding
 * GoodWe inverters on the local network using UDP broadcast.
 */

const discovery = require("../lib/discovery.js");
const { STATUSES, setTransientStatus, parseSafeInteger } = require("../lib/node-helpers.js");

const DEFAULT_PORT = 8899;

module.exports = function(RED) {
    "use strict";

    function GoodWeDiscoverNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Defensive parse (#75) — guard against scientific notation, negative
        // values, etc. typed via flow import. Floor 100ms (sub-100ms is
        // unrealistic for UDP round-trip), ceiling 5 min.
        node.timeout = parseSafeInteger(config.timeout, { default: 5000, min: 100, max: 300000 });
        node.broadcastAddress = config.broadcastAddress || "255.255.255.255";
        node.statusResetTimers = [];

        node.status(STATUSES.ready);

        async function performDiscovery(msg, send, done) {
            try {
                node.status({ fill: "blue", shape: "dot", text: "discovering..." });

                const inverters = await discovery.discoverInverters({
                    timeout: node.timeout,
                    broadcastAddress: node.broadcastAddress
                });

                const devices = inverters.map(inv => ({
                    host: inv.ip,
                    port: inv.port || DEFAULT_PORT,
                    model: inv.modelName || "GoodWe Inverter",
                    serial: inv.serialNumber || "UNKNOWN",
                    family: inv.family || "ET",
                    protocol: "udp"
                }));

                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = {
                    devices: devices,
                    count: devices.length
                };
                outputMsg.topic = "goodwe/discover";
                // Discover has no single inverter to attach (#65) — payload IS
                // the list — so only `timestamp` is set, not `inverter`.
                outputMsg.timestamp = new Date().toISOString();

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

        node.on("input", function(msg, send, done) {
            // Fallback for Node-RED pre-1.0 where send/done were not supplied.
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            performDiscovery(msg, send, done);
        });

        node.on("close", function(done) {
            node.statusResetTimers.forEach(timer => clearTimeout(timer));
            node.statusResetTimers = [];
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("goodwe-discover", GoodWeDiscoverNode);
};
