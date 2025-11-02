/**
 * GoodWe Configuration Node
 * 
 * Shared configuration node for GoodWe inverter connection settings.
 * Used by all operational nodes (read, write, discover, info).
 */

module.exports = function(RED) {
    "use strict";

    /**
     * GoodWe Config Node
     * @param {Object} config - Node configuration
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
        this.keepAlive = config.keepAlive !== false; // Default true
        
        // Connection state
        this.protocolHandler = null;
    }

    // Register the config node
    RED.nodes.registerType("goodwe-config", GoodWeConfigNode);
};
