/**
 * Node-RED node for GoodWe inverter connectivity
 * 
 * This node provides connectivity to GoodWe inverters over local network
 * and retrieves runtime sensor values and configuration parameters.
 * 
 * Based on the marcelblijleven/goodwe Python library
 */

const { ProtocolHandler, discoverInverters } = require("../lib/protocol.js");

module.exports = function(RED) {
    "use strict";

    /**
     * Mock runtime data generator for testing and development
     * TODO: Replace with actual inverter communication
     */
    function generateMockRuntimeData(family) {
        const baseData = {
            // PV Input (Solar Panels)
            vpv1: 245.5 + Math.random() * 50,    // PV1 voltage (V)
            vpv2: 242.3 + Math.random() * 50,    // PV2 voltage (V)
            ipv1: 8.2 + Math.random() * 2,       // PV1 current (A)
            ipv2: 7.9 + Math.random() * 2,       // PV2 current (A)
            ppv1: 2013.1 + Math.random() * 500,  // PV1 power (W)
            ppv2: 1914.2 + Math.random() * 500,  // PV2 power (W)
            
            // AC Output (Grid) - single phase default
            vac1: 230.1 + Math.random() * 5,     // AC voltage phase 1 (V)
            iac1: 6.2 + Math.random() * 2,       // AC current phase 1 (A)
            fac1: 50.0 + Math.random() * 0.1,    // AC frequency phase 1 (Hz)
            pac: 2875 + Math.random() * 500,     // Active power output (W)
            
            // System Status
            temperature: 42.5 + Math.random() * 5,  // Inverter temperature (°C)
            work_mode: 1,                           // Work mode (1=normal)
            
            // Energy Statistics
            e_day: 12.5 + Math.random() * 5,     // Today's energy production (kWh)
            e_total: 1234.5 + Math.random() * 100, // Total lifetime energy (kWh)
            h_total: 2468 + Math.random() * 100  // Total working hours (h)
        };

        // Add three-phase data for DT family
        if (family === "DT" || family === "MS" || family === "D-NS") {
            baseData.vac2 = 229.8 + Math.random() * 5;  // AC voltage phase 2 (V)
            baseData.vac3 = 230.5 + Math.random() * 5;  // AC voltage phase 3 (V)
            baseData.iac2 = 6.1 + Math.random() * 2;    // AC current phase 2 (A)
            baseData.iac3 = 6.3 + Math.random() * 2;    // AC current phase 3 (A)
        }

        // Add battery data for hybrid models (ET, ES, EM, BP)
        if (["ET", "EH", "BT", "BH", "ES", "EM", "BP"].includes(family)) {
            baseData.vbattery1 = 51.2 + Math.random() * 2;    // Battery voltage (V)
            baseData.ibattery1 = -5.0 + Math.random() * 10;   // Battery current (A)
            baseData.pbattery = -256 + Math.random() * 500;   // Battery power (W)
            baseData.battery_soc = Math.floor(85 + Math.random() * 10); // Battery SOC (%)
            baseData.battery_mode = Math.floor(Math.random() * 3);      // Battery mode
        }

        return baseData;
    }

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

        // Initialize protocol handler
        node.protocolHandler = null;
        
        // Initialize status
        node.status({ fill: "grey", shape: "ring", text: "disconnected" });

        /**
         * Handle incoming messages
         */
        node.on("input", async function(msg, send, done) {
            // Fallback for Node-RED pre-1.0
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            try {
                // Parse command from payload
                let command = "read"; // Default command
                if (typeof msg.payload === "string" && msg.payload !== "") {
                    command = msg.payload;
                } else if (typeof msg.payload === "object" && msg.payload.command) {
                    command = msg.payload.command;
                }

                // Handle discovery command
                if (command === "discover") {
                    await handleDiscovery(node, msg, send, done);
                    return;
                }

                // For other commands, ensure we have a valid host
                if (!node.host || node.host === "" || node.host === "invalid") {
                    throw new Error("Invalid host address");
                }

                // Initialize protocol handler if not exists
                if (!node.protocolHandler) {
                    node.protocolHandler = new ProtocolHandler({
                        host: node.host,
                        port: node.port,
                        protocol: node.protocol,
                        timeout: 1000,
                        retries: 3
                    });

                    // Setup status event handlers
                    node.protocolHandler.on("status", (status) => {
                        updateNodeStatus(node, status);
                    });

                    node.protocolHandler.on("error", (err) => {
                        node.warn(`Protocol error: ${err.message}`);
                    });
                }

                // Update status
                node.status({ fill: "yellow", shape: "ring", text: "connecting..." });

                // Connect to inverter
                await node.protocolHandler.connect();

                // Execute command
                const runtimeData = generateMockRuntimeData(node.family);
                
                const response = {
                    success: true,
                    command: command,
                    timestamp: new Date().toISOString(),
                    data: runtimeData
                };

                // Preserve original message properties (except payload)
                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = response;
                
                // Set topic if not already present
                if (!outputMsg.topic) {
                    outputMsg.topic = `goodwe/${command}`;
                }

                // Success status
                node.status({ fill: "green", shape: "dot", text: "ok" });
                setTimeout(() => {
                    node.status({ fill: "grey", shape: "ring", text: "disconnected" });
                }, 2000);

                send(outputMsg);
                done();
            } catch (err) {
                // Error response
                const errorResponse = {
                    success: false,
                    command: msg.payload?.command || "read",
                    timestamp: new Date().toISOString(),
                    error: {
                        code: err.code || "RUNTIME_ERROR",
                        message: err.message,
                        details: err.stack
                    }
                };

                const outputMsg = Object.assign({}, msg);
                outputMsg.payload = errorResponse;
                
                if (!outputMsg.topic) {
                    outputMsg.topic = `goodwe/${msg.payload?.command || "read"}`;
                }

                node.status({ fill: "red", shape: "ring", text: "error" });
                send(outputMsg);
                done();
            }
        });

        /**
         * Cleanup on node close
         */
        node.on("close", async function(done) {
            // Close protocol handler connection
            if (node.protocolHandler) {
                await node.protocolHandler.disconnect();
                node.protocolHandler = null;
            }
            node.status({});
            done();
        });
    }

    /**
     * Handle discovery command
     * @param {Object} node - Node instance
     * @param {Object} msg - Input message
     * @param {Function} send - Send function
     * @param {Function} done - Done function
     */
    async function handleDiscovery(node, msg, send, done) {
        try {
            node.status({ fill: "blue", shape: "dot", text: "discovering..." });

            const timeout = msg.payload?.timeout || 5000;
            const inverters = await discoverInverters({ timeout });

            const response = {
                success: true,
                command: "discover",
                timestamp: new Date().toISOString(),
                data: {
                    count: inverters.length,
                    inverters: inverters
                }
            };

            const outputMsg = Object.assign({}, msg);
            outputMsg.payload = response;
            outputMsg.topic = outputMsg.topic || "goodwe/discover";

            node.status({ fill: "green", shape: "dot", text: `found ${inverters.length}` });
            setTimeout(() => {
                node.status({ fill: "grey", shape: "ring", text: "disconnected" });
            }, 2000);

            send(outputMsg);
            done();
        } catch (err) {
            const errorResponse = {
                success: false,
                command: "discover",
                timestamp: new Date().toISOString(),
                error: {
                    code: err.code || "DISCOVERY_ERROR",
                    message: err.message,
                    details: err.stack
                }
            };

            const outputMsg = Object.assign({}, msg);
            outputMsg.payload = errorResponse;
            outputMsg.topic = outputMsg.topic || "goodwe/error";

            node.status({ fill: "red", shape: "ring", text: "discovery failed" });
            send(outputMsg);
            done();
        }
    }

    /**
     * Update node status based on protocol handler status
     * @param {Object} node - Node instance
     * @param {Object} status - Status object from protocol handler
     */
    function updateNodeStatus(node, status) {
        switch (status.state) {
        case "connecting":
            node.status({ fill: "yellow", shape: "ring", text: "connecting..." });
            break;
        case "connected":
            node.status({ fill: "green", shape: "dot", text: "connected" });
            break;
        case "disconnected":
            node.status({ fill: "grey", shape: "ring", text: "disconnected" });
            break;
        case "reading":
            node.status({ fill: "blue", shape: "dot", text: "reading..." });
            break;
        case "retrying":
            if (status.attempt && status.maxRetries) {
                node.status({ 
                    fill: "orange", 
                    shape: "dot", 
                    text: `retry ${status.attempt}/${status.maxRetries}` 
                });
            }
            break;
        default:
            node.status({ fill: "grey", shape: "ring", text: status.state });
        }
    }

    // Register the node
    RED.nodes.registerType("goodwe", GoodWeNode);
};
