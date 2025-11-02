/**
 * Test Utilities for node-red-contrib-goodwe
 * 
 * Common helper functions and utilities for testing Node-RED nodes.
 * These utilities simplify test setup and reduce code duplication.
 */

const helper = require("node-red-node-test-helper");

/**
 * Creates a standard test flow with a GoodWe node and helper node
 * 
 * @param {Object} config - GoodWe node configuration
 * @param {string} config.id - Node ID (default: "n1")
 * @param {string} config.name - Node name
 * @param {string} config.host - Inverter host address
 * @param {number} config.port - Communication port
 * @param {string} config.protocol - Protocol (udp/modbus)
 * @param {string} config.family - Inverter family
 * @returns {Array} Node-RED flow array
 */
function createBasicFlow(config = {}) {
    const nodeId = config.id || "n1";
    const helperId = config.helperId || "n2";

    return [
        {
            id: nodeId,
            type: "goodwe-legacy",
            name: config.name || "test goodwe",
            host: config.host || "192.168.1.100",
            port: config.port || 8899,
            protocol: config.protocol || "udp",
            family: config.family || "ET",
            wires: [[helperId]]
        },
        { id: helperId, type: "helper" }
    ];
}

/**
 * Creates a flow with multiple GoodWe nodes
 * 
 * @param {Array} configs - Array of node configurations
 * @returns {Array} Node-RED flow array
 */
function createMultiNodeFlow(configs) {
    const flow = [];
    
    configs.forEach((config, index) => {
        const nodeId = config.id || `n${index + 1}`;
        const helperId = config.helperId || `h${index + 1}`;
        
        flow.push({
            id: nodeId,
            type: "goodwe-legacy",
            name: config.name || `test goodwe ${index + 1}`,
            host: config.host || `192.168.1.${100 + index}`,
            port: config.port || 8899,
            protocol: config.protocol || "udp",
            family: config.family || "ET",
            wires: [[helperId]]
        });
        
        flow.push({ id: helperId, type: "helper" });
    });
    
    return flow;
}

/**
 * Waits for a helper node to receive a message
 * 
 * @param {Object} helperNode - The helper node instance
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} Promise that resolves with the received message
 */
function waitForMessage(helperNode, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout waiting for message after ${timeout}ms`));
        }, timeout);

        helperNode.on("input", (msg) => {
            clearTimeout(timeoutId);
            resolve(msg);
        });
    });
}

/**
 * Waits for multiple messages from a helper node
 * 
 * @param {Object} helperNode - The helper node instance
 * @param {number} count - Number of messages to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Array>} Promise that resolves with array of received messages
 */
function waitForMessages(helperNode, count, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const messages = [];
        
        const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout: only received ${messages.length}/${count} messages`));
        }, timeout);

        helperNode.on("input", (msg) => {
            messages.push(msg);
            
            if (messages.length >= count) {
                clearTimeout(timeoutId);
                resolve(messages);
            }
        });
    });
}

/**
 * Sends a message to a node and waits for the response
 * 
 * @param {Object} sourceNode - Node to send message to
 * @param {Object} helperNode - Helper node to receive response
 * @param {Object} message - Message to send
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} Promise that resolves with the response message
 */
async function sendAndWait(sourceNode, helperNode, message, timeout = 5000) {
    const responsePromise = waitForMessage(helperNode, timeout);
    sourceNode.receive(message);
    return responsePromise;
}

/**
 * Creates a mock inverter response function
 * 
 * @param {Object} mockData - The mock data to return
 * @param {number} delay - Delay in milliseconds before responding (default: 0)
 * @returns {Function} Mock function that returns the data after delay
 */
function createMockResponse(mockData, delay = 0) {
    return jest.fn().mockImplementation(() => {
        return new Promise((resolve) => {
            setTimeout(() => resolve(mockData), delay);
        });
    });
}

/**
 * Creates a mock inverter error function
 * 
 * @param {Error|string} error - Error to throw
 * @param {number} delay - Delay in milliseconds before throwing (default: 0)
 * @returns {Function} Mock function that throws the error after delay
 */
function createMockError(error, delay = 0) {
    return jest.fn().mockImplementation(() => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (typeof error === "string") {
                    reject(new Error(error));
                } else {
                    reject(error);
                }
            }, delay);
        });
    });
}

/**
 * Captures node status calls for testing
 * 
 * @param {Object} node - The node to monitor
 * @returns {Array} Array that will be populated with status calls
 */
function captureStatusCalls(node) {
    const statusCalls = [];
    const originalStatus = node.status;
    
    node.status = function(status) {
        statusCalls.push({
            ...status,
            timestamp: Date.now()
        });
        originalStatus.call(node, status);
    };
    
    return statusCalls;
}

/**
 * Waits for a specific node status
 * 
 * @param {Object} node - The node to monitor
 * @param {Object} expectedStatus - Expected status (partial match)
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Object>} Promise that resolves with the matching status
 */
function waitForStatus(node, expectedStatus, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const statusCalls = [];
        const originalStatus = node.status;
        
        const timeoutId = setTimeout(() => {
            node.status = originalStatus;
            reject(new Error(`Timeout waiting for status: ${JSON.stringify(expectedStatus)}`));
        }, timeout);

        node.status = function(status) {
            statusCalls.push(status);
            originalStatus.call(node, status);
            
            // Check if status matches expected (partial match)
            let matches = true;
            for (const key in expectedStatus) {
                if (status[key] !== expectedStatus[key]) {
                    matches = false;
                    break;
                }
            }
            
            if (matches) {
                clearTimeout(timeoutId);
                node.status = originalStatus;
                resolve(status);
            }
        };
    });
}

/**
 * Asserts that a message has the expected structure
 * 
 * @param {Object} msg - Message to validate
 * @param {Object} expectations - Expected properties and values
 */
function assertMessageStructure(msg, expectations) {
    expect(msg).toBeDefined();
    expect(msg.payload).toBeDefined();
    
    if (expectations.success !== undefined) {
        expect(msg.payload.success).toBe(expectations.success);
    }
    
    if (expectations.command) {
        expect(msg.payload.command).toBe(expectations.command);
    }
    
    if (expectations.timestamp) {
        expect(msg.payload.timestamp).toBeDefined();
        expect(typeof msg.payload.timestamp).toBe("string");
    }
    
    if (expectations.data) {
        expect(msg.payload.data).toBeDefined();
    }
    
    if (expectations.error) {
        expect(msg.payload.error).toBeDefined();
    }
}

/**
 * Asserts that an error response has the correct structure
 * 
 * @param {Object} msg - Message to validate
 * @param {string} expectedCode - Expected error code
 */
function assertErrorResponse(msg, expectedCode) {
    expect(msg).toBeDefined();
    expect(msg.payload).toBeDefined();
    expect(msg.payload.success).toBe(false);
    expect(msg.payload.error).toBeDefined();
    expect(msg.payload.error.code).toBeDefined();
    
    if (expectedCode) {
        expect(msg.payload.error.code).toBe(expectedCode);
    }
}

/**
 * Creates a delay promise
 * 
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Loads a flow and returns node references
 * 
 * @param {Object} goodweNode - GoodWe node module
 * @param {Array} flow - Flow configuration
 * @returns {Promise<Object>} Promise that resolves with node references
 */
function loadFlowWithNodes(goodweNode, flow) {
    return new Promise((resolve, reject) => {
        helper.load(goodweNode, flow, (err) => {
            if (err) {
                reject(err);
                return;
            }
            
            const nodes = {};
            flow.forEach(nodeConfig => {
                nodes[nodeConfig.id] = helper.getNode(nodeConfig.id);
            });
            
            resolve(nodes);
        });
    });
}

/**
 * Test lifecycle helper - sets up and tears down helper server
 * Use this in describe blocks for automatic setup/teardown
 */
const testLifecycle = {
    beforeEach: function(done) {
        helper.startServer(done);
    },
    
    afterEach: function(done) {
        helper.unload();
        helper.stopServer(done);
    }
};

/**
 * Creates sample input messages for testing
 */
const sampleMessages = {
    /**
     * Simple read command
     */
    read: {
        payload: "read"
    },
    
    /**
     * Read command as object
     */
    readObject: {
        payload: { command: "read" }
    },
    
    /**
     * Discover command
     */
    discover: {
        payload: "discover"
    },
    
    /**
     * Info command
     */
    info: {
        payload: "info"
    },
    
    /**
     * Read specific sensor
     */
    readSensor: (sensorId) => ({
        payload: {
            command: "read_sensor",
            sensor_id: sensorId
        }
    }),
    
    /**
     * Write setting
     */
    writeSetting: (setting, value) => ({
        payload: {
            command: "write_setting",
            setting: setting,
            value: value
        }
    }),
    
    /**
     * Message with custom properties
     */
    withProperties: (payload, properties) => ({
        payload: payload,
        ...properties
    })
};

/**
 * Common test assertions
 */
const assertions = {
    /**
     * Assert successful response
     */
    isSuccess: (msg) => {
        expect(msg.payload).toBeDefined();
        expect(msg.payload.success).toBe(true);
        expect(msg.payload.timestamp).toBeDefined();
    },
    
    /**
     * Assert error response
     */
    isError: (msg, errorCode) => {
        expect(msg.payload).toBeDefined();
        expect(msg.payload.success).toBe(false);
        expect(msg.payload.error).toBeDefined();
        if (errorCode) {
            expect(msg.payload.error.code).toBe(errorCode);
        }
    },
    
    /**
     * Assert payload has required fields
     */
    hasFields: (msg, fields) => {
        expect(msg.payload).toBeDefined();
        fields.forEach(field => {
            expect(msg.payload).toHaveProperty(field);
        });
    }
};

module.exports = {
    // Flow creation
    createBasicFlow,
    createMultiNodeFlow,
    
    // Message handling
    waitForMessage,
    waitForMessages,
    sendAndWait,
    
    // Mocking
    createMockResponse,
    createMockError,
    
    // Status monitoring
    captureStatusCalls,
    waitForStatus,
    
    // Assertions
    assertMessageStructure,
    assertErrorResponse,
    assertions,
    
    // Utilities
    delay,
    loadFlowWithNodes,
    testLifecycle,
    
    // Sample data
    sampleMessages
};
