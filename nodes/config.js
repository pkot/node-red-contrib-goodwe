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
         * Cleanup on node close.
         *
         * Sequence (#71):
         * 1. Emit `goodwe:shutdown` to every registered worker so they can
         *    cancel polling intervals before we tear down the handler. Doing
         *    this first prevents a ghost tick from racing with disconnect()
         *    and re-creating a handler post-close.
         * 2. Disconnect the ProtocolHandler with a 2000ms safety timeout.
         *    Node 24+'s dgram.close() can throw "Not running" on unbound
         *    sockets (already handled in lib/protocol.js for discovery); for
         *    a wedged TCP socket the underlying socket.end() callback may
         *    never fire, which previously hung Node-RED's deploy.
         */
        this.on("close", async function(done) {
            // Signal users first so polling stops before we destroy the handler.
            for (const node of self.users) {
                try { node.emit("goodwe:shutdown"); } catch (_e) { /* ignore */ }
            }

            if (self.protocolHandler) {
                const DISCONNECT_TIMEOUT_MS = 2000;
                try {
                    await Promise.race([
                        self.protocolHandler.disconnect(),
                        new Promise(resolve => setTimeout(resolve, DISCONNECT_TIMEOUT_MS))
                    ]);
                } catch (_e) {
                    // Swallow — close path must always call done() so the
                    // Node-RED deploy completes.
                }
                self.protocolHandler = null;
            }
            self.users = [];
            done();
        });
    }

    // Register the configuration node
    RED.nodes.registerType("goodwe-config", GoodWeConfigNode);
};
