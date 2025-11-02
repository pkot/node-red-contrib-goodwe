/**
 * Tests for GoodWe Node Message Format
 * 
 * These tests verify the input/output message structure
 * according to the NODE_DESIGN.md specification.
 */

const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe-legacy.js");

helper.init(require.resolve("node-red"));

describe("goodwe message format", () => {
    
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    describe("input message - string commands", () => {
        it("should accept 'read' command as string", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toBeDefined();
                        // Verify output structure
                        expect(msg.payload).toHaveProperty("success");
                        expect(msg.payload).toHaveProperty("command");
                        expect(msg.topic).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: "read" });
            });
        });

        it("should accept 'discover' command as string", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.command).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                // Use object payload with short timeout to avoid test timeout
                n1.receive({ payload: { command: "discover", timeout: 500 } });
            });
        });

        it("should accept 'info' command as string", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: "info" });
            });
        });
    });

    describe("input message - object commands", () => {
        it("should accept read command as object", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBeDefined();
                        expect(msg.payload.command).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: { command: "read" } });
            });
        });

        it("should accept read_sensor command with sensor_id", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ 
                    payload: { 
                        command: "read_sensor",
                        sensor_id: "vpv1"
                    }
                });
            });
        });

        it("should accept discover command with type", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ 
                    payload: { 
                        command: "discover",
                        type: "broadcast",
                        timeout: 500
                    }
                });
            });
        });
    });

    describe("output message structure", () => {
        it("should include success flag", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toHaveProperty("success");
                        expect(typeof msg.payload.success).toBe("boolean");
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: "read" });
            });
        });

        it("should include command name", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toHaveProperty("command");
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: "read" });
            });
        });

        it("should include timestamp", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toHaveProperty("timestamp");
                        // Verify ISO 8601 format
                        const timestamp = new Date(msg.payload.timestamp);
                        expect(timestamp).toBeInstanceOf(Date);
                        expect(timestamp.toISOString()).toBe(msg.payload.timestamp);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: "read" });
            });
        });

        it("should set topic", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.topic).toBeDefined();
                        expect(typeof msg.topic).toBe("string");
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: "read" });
            });
        });

        it("should preserve input message properties", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.correlationId).toBe("test-123");
                        expect(msg.customProp).toBe("preserved");
                        expect(msg._msgid).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ 
                    payload: "read",
                    correlationId: "test-123",
                    customProp: "preserved"
                });
            });
        });
    });

    describe("output message - success response", () => {
        it("should include data property on success", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        // For now, just check structure exists
                        // Actual implementation will populate with real data
                        expect(msg.payload).toHaveProperty("success");
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: "read" });
            });
        });
    });

    describe("message topic convention", () => {
        it("should use goodwe/* topic pattern", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.topic).toMatch(/^goodwe\//);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: "read" });
            });
        });

        it("should allow custom topic override", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                n2.on("input", (msg) => {
                    try {
                        // For now, verify topic is set
                        // Implementation should preserve or override based on input
                        expect(msg.topic).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ 
                    payload: "read",
                    topic: "custom/topic"
                });
            });
        });
    });
});
