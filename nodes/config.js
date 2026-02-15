/**
 * GoodWe Configuration Node
 *
 * Shared configuration for GoodWe inverter connection settings.
 * This node stores connection details, owns the ProtocolHandler,
 * and manages the connection lifecycle for all dependent nodes.
 */

const { ProtocolHandler } = require("../lib/protocol.js");

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Configuration Node
     * @param {Object} config - Node configuration from editor
     */
    function GoodWeConfigNode(config) {
        RED.nodes.createNode(this, config);
        const self = this;

        // Store configuration
        this.host = config.host;
        this.port = config.port || 8899;
        this.protocol = config.protocol || "udp";
        this.family = config.family || "ET";
        this.timeout = config.timeout || 1000;
        this.retries = config.retries || 3;
        this.commAddr = config.commAddr || "auto";
        this.keepAlive = config.keepAlive === undefined ? true : config.keepAlive;

        // Connection state
        this.protocolHandler = null;
        this.users = [];

        /**
         * Get connection configuration
         * @returns {Object} Connection configuration object
         */
        this.getConfig = function() {
            return {
                host: self.host,
                port: self.port,
                protocol: self.protocol,
                family: self.family,
                timeout: self.timeout,
                retries: self.retries,
                commAddr: self.commAddr,
                keepAlive: self.keepAlive
            };
        };

        /**
         * Get or create the shared ProtocolHandler instance.
         * The handler is created lazily on first call.
         * @returns {Object} ProtocolHandler instance
         */
        this.getProtocolHandler = function() {
            if (!self.protocolHandler) {
                self.protocolHandler = new ProtocolHandler({
                    host: self.host,
                    port: self.port,
                    protocol: self.protocol,
                    family: self.family,
                    timeout: self.timeout || 1000,
                    retries: self.retries || 3,
                    commAddr: self.commAddr
                });

                // Forward events to registered user nodes
                self.protocolHandler.on("status", (status) => {
                    self.users.forEach(node => node.emit("goodwe:status", status));
                });
                self.protocolHandler.on("error", (err) => {
                    self.users.forEach(node => node.emit("goodwe:error", err));
                });
            }
            return self.protocolHandler;
        };

        /**
         * Register a dependent node
         * @param {Object} node - Node-RED node instance
         */
        this.registerUser = function(node) {
            self.users.push(node);
        };

        /**
         * Deregister a dependent node
         * @param {Object} node - Node-RED node instance
         */
        this.deregisterUser = function(node) {
            self.users = self.users.filter(u => u.id !== node.id);
        };

        /**
         * Cleanup on node close
         */
        this.on("close", async function(done) {
            // Disconnect the protocol handler
            if (self.protocolHandler) {
                await self.protocolHandler.disconnect();
                self.protocolHandler = null;
            }
            self.users = [];
            done();
        });
    }

    // Register the configuration node
    RED.nodes.registerType("goodwe-config", GoodWeConfigNode);
};
