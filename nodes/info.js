/**
 * Node-RED node for GoodWe inverter device info retrieval
 *
 * This node retrieves device identification and firmware information
 * from a GoodWe inverter.
 */

const { enhanceError } = require("../lib/errors.js");
const { STATUSES, setTransientStatus } = require("../lib/node-helpers.js");

module.exports = function(RED) {
    "use strict";

    function GoodWeInfoNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        const configSource = RED.nodes.getNode(config.config);
        if (!configSource) {
            node.error("Configuration node not found");
            node.status(STATUSES.configError);
            return;
        }
        node.configNode = configSource;

        // Live getters (#60) — config-node field edits are reflected
        // immediately instead of leaving workers with stale copies.
        Object.defineProperties(node, {
            host:   { get: () => node.configNode.host,   configurable: true },
            family: { get: () => node.configNode.family, configurable: true }
        });

        node.configNode.registerUser(node);
        node.status(STATUSES.ready);

        node.on("goodwe:error", function(err) {
            node.warn(`Protocol error: ${err.message}`);
        });

        async function performInfoRead(msg, send, done) {
            try {
                if (!node.host || node.host === "") {
                    const err = new Error("Invalid host address");
                    err.code = "INVALID_HOST";
                    throw enhanceError(err, { host: node.host });
                }

                const protocolHandler = node.configNode.getProtocolHandler();
                node.status({ fill: "blue", shape: "dot", text: "reading info..." });

                const deviceInfo = await protocolHandler.readDeviceInfo();
                // The AA55 device-info reply doesn't carry family — supply
                // it from config so downstream consumers get a full record.
                deviceInfo.family = node.family;

                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = deviceInfo;
                outputMsg.topic = "goodwe/device_info";
                outputMsg.timestamp = new Date().toISOString();
                outputMsg.inverter = {
                    family: node.family,
                    host: node.host
                };

                setTransientStatus(node);

                send(outputMsg);
                if (done) done();
            } catch (err) {
                node.status(STATUSES.error);

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

            performInfoRead(msg, send, done);
        });

        node.on("close", function(done) {
            if (node.configNode) {
                node.configNode.deregisterUser(node);
            }
            node.status({});
            done();
        });
    }

    RED.nodes.registerType("goodwe-info", GoodWeInfoNode);
};
