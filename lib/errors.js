/**
 * Enhanced error handling with actionable suggestions
 *
 * Provides context-aware error messages to help users troubleshoot
 * common GoodWe inverter connection and protocol issues.
 */

"use strict";

/**
 * Suggestion generators keyed by error code.
 * Each returns an array of actionable strings.
 */
const SUGGESTION_GENERATORS = {
    TIMEOUT: (ctx) => {
        const suggestions = [
            `Verify inverter at ${ctx.host || "configured address"} is powered on`,
            "Check network connection to inverter",
            "Ensure inverter is on the same network segment"
        ];
        if (ctx.timeout) {
            suggestions.push(`Try increasing timeout above ${ctx.timeout}ms in configuration`);
        }
        return suggestions;
    },

    ECONNREFUSED: (ctx) => [
        `Verify inverter IP address ${ctx.host || ""} is correct`,
        `Check that port ${ctx.port || 8899} is accessible on the inverter`,
        "Ensure no firewall is blocking the connection",
        "Try using UDP protocol if TCP is failing"
    ],

    ECONNRESET: (ctx) => [
        `Connection to ${ctx.host || "inverter"} was reset`,
        "The inverter may have dropped the connection",
        "Try reducing polling frequency to avoid overloading the inverter"
    ],

    EHOSTUNREACH: (ctx) => [
        `Host ${ctx.host || ""} is unreachable`,
        "Verify the inverter is on the same network",
        "Check your network routing and gateway settings",
        "Ensure the inverter's WiFi/LAN module is functioning"
    ],

    READ_ERROR: (ctx) => {
        const suggestions = [
            "Check that the inverter is responding to commands"
        ];
        if (ctx.family) {
            suggestions.push(`Verify inverter family is set correctly (currently: ${ctx.family})`);
        }
        suggestions.push("Try power-cycling the inverter's communication module");
        return suggestions;
    },

    PROTOCOL_ERROR: (ctx) => {
        const suggestions = [
            "The inverter response did not match the expected format"
        ];
        if (ctx.family) {
            suggestions.push(`Verify inverter family setting matches your model (currently: ${ctx.family})`);
        }
        if (ctx.protocol) {
            suggestions.push(`Try a different protocol (currently: ${ctx.protocol})`);
        }
        return suggestions;
    },

    UNSUPPORTED_FAMILY: (ctx) => [
        `Inverter family "${ctx.family || "unknown"}" is not supported`,
        "Supported families: ET, EH, BT, BH, ES, EM, BP, DT, MS, D-NS, XS",
        "Check your configuration node settings"
    ]
};

/**
 * Enhance an error with contextual suggestions.
 *
 * @param {Error} err - The original error
 * @param {Object} ctx - Context object with host, port, family, protocol, timeout, etc.
 * @returns {Error} The same error object with `suggestions` and `details` added
 */
function enhanceError(err, ctx) {
    const code = err.code || inferErrorCode(err);

    // Set code if not already set
    if (!err.code) {
        err.code = code;
    }

    // Add connection context as details
    err.details = {
        host: ctx.host,
        port: ctx.port,
        protocol: ctx.protocol,
        family: ctx.family
    };

    // Generate suggestions based on error code
    const generator = SUGGESTION_GENERATORS[code];
    if (generator) {
        err.suggestions = generator(ctx);
    } else {
        err.suggestions = getDefaultSuggestions(ctx);
    }

    return err;
}

/**
 * Infer an error code from the error message when no code is set.
 *
 * @param {Error} err - The error to inspect
 * @returns {string} Inferred error code
 */
function inferErrorCode(err) {
    const msg = (err.message || "").toLowerCase();

    if (msg.includes("timeout")) return "TIMEOUT";
    if (msg.includes("econnrefused") || msg.includes("connection refused")) return "ECONNREFUSED";
    if (msg.includes("econnreset")) return "ECONNRESET";
    if (msg.includes("ehostunreach") || msg.includes("unreachable")) return "EHOSTUNREACH";
    if (msg.includes("unsupported") && msg.includes("family")) return "UNSUPPORTED_FAMILY";
    if (msg.includes("invalid") && (msg.includes("response") || msg.includes("modbus") || msg.includes("aa55"))) return "PROTOCOL_ERROR";

    return "UNKNOWN";
}

/**
 * Default suggestions when no specific generator matches.
 *
 * @param {Object} ctx - Context object
 * @returns {string[]} Default suggestion array
 */
function getDefaultSuggestions(ctx) {
    const suggestions = [
        "Check inverter power and network connectivity"
    ];
    if (ctx.host) {
        suggestions.push(`Verify inverter is reachable at ${ctx.host}`);
    }
    return suggestions;
}

module.exports = {
    enhanceError,
    inferErrorCode,
    SUGGESTION_GENERATORS
};
