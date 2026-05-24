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

    function GoodWeConfigNode(config) {
        RED.nodes.createNode(this, config);
        const self = this;

        this.host = config.host;
        this.port = config.port || 8899;
        this.protocol = config.protocol || "udp";
        this.family = config.family || "ET";
        this.timeout = config.timeout || 1000;
        this.retries = config.retries || 3;
        this.commAddr = config.commAddr || "auto";
        this.keepAlive = config.keepAlive === undefined ? true : config.keepAlive;

        this.protocolHandler = null;
        this.users = [];

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

        // Lazy: handler is created on first call and shared by all registered
        // worker nodes. Status/error events fan out to every user.
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

                self.protocolHandler.on("status", (status) => {
                    self.users.forEach(node => node.emit("goodwe:status", status));
                });
                self.protocolHandler.on("error", (err) => {
                    self.users.forEach(node => node.emit("goodwe:error", err));
                });
            }
            return self.protocolHandler;
        };

        this.registerUser = function(node) {
            self.users.push(node);
        };

        this.deregisterUser = function(node) {
            self.users = self.users.filter(u => u.id !== node.id);
        };

        // Close sequence (#71):
        // 1. Emit `goodwe:shutdown` BEFORE disconnect — workers cancel polling
        //    intervals first, so a ghost tick can't race with disconnect() and
        //    re-create a handler post-close.
        // 2. Disconnect with a 2000ms safety timeout. A wedged TCP socket's
        //    end() callback may never fire, which previously hung Node-RED's
        //    deploy. The race+swallow keeps done() guaranteed.
        this.on("close", async function(done) {
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
                    // done() must always be called so the deploy completes.
                }
                self.protocolHandler = null;
            }
            self.users = [];
            done();
        });
    }

    RED.nodes.registerType("goodwe-config", GoodWeConfigNode);
};
