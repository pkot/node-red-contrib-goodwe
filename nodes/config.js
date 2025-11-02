/**
 * GoodWe Configuration Node
 * 
 * Shared configuration for GoodWe inverter connection settings.
 * This node stores connection details and manages connection lifecycle.
 */

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Configuration Node
     * @param {Object} config - Node configuration from editor
     */
    function GoodWeConfigNode(config) {
        RED.nodes.createNode(this, config);
        
        // Store configuration
        this.host = config.host;
        this.port = config.port || 8899;
        this.protocol = config.protocol || "udp";
        this.family = config.family || "ET";
        this.timeout = config.timeout || 1000;
        this.retries = config.retries || 3;
        this.commAddr = config.commAddr || "auto";
        this.keepAlive = config.keepAlive !== false; // Default to true
        
        // Connection state
        this.connection = null;
        this.isConnected = false;
        
        /**
         * Get connection configuration
         * @returns {Object} Connection configuration object
         */
        this.getConfig = function() {
            return {
                host: this.host,
                port: this.port,
                protocol: this.protocol,
                family: this.family,
                timeout: this.timeout,
                retries: this.retries,
                commAddr: this.commAddr,
                keepAlive: this.keepAlive
            };
        };
        
        /**
         * Cleanup on node close
         */
        this.on("close", function(done) {
            // Close any active connections
            if (this.connection) {
                this.connection = null;
            }
            this.isConnected = false;
            done();
        });
    }

    // Register the configuration node
    RED.nodes.registerType("goodwe-config", GoodWeConfigNode);
};
