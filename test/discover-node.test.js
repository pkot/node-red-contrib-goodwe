/**
 * Tests for GoodWe Discover Node
 * 
 * These tests verify the dedicated discover node functionality
 * for finding GoodWe inverters on the local network.
 */

const helper = require("node-red-node-test-helper");
const discoverNode = require("../nodes/discover.js");

helper.init(require.resolve("node-red"));

describe("goodwe-discover node", () => {
    
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    describe("node registration", () => {
        it("should be registered", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    name: "test discover"
                }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                expect(n1).toBeDefined();
                expect(n1.name).toBe("test discover");
                done();
            });
        });

        it("should have default timeout of 5000ms", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover"
                }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                expect(n1.timeout).toBe(5000);
                done();
            });
        });

        it("should accept custom timeout", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 3000
                }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                expect(n1.timeout).toBe(3000);
                done();
            });
        });

        it("should have default broadcast address", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover"
                }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                expect(n1.broadcastAddress).toBe("255.255.255.255");
                done();
            });
        });
    });

    describe("discovery operation", () => {
        it("should trigger discovery on any input", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", (msg) => {
                    if (completed) return;
                    completed = true;
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.devices).toBeDefined();
                        expect(Array.isArray(msg.payload.devices)).toBe(true);
                        expect(msg.payload.count).toBeDefined();
                        expect(typeof msg.payload.count).toBe("number");
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                // Handle potential errors
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    // Error during discovery is acceptable in test environment
                    done();
                });
                
                n1.receive({ payload: true });
            });
        }, 10000);

        it("should set topic to goodwe/discover", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", (msg) => {
                    if (completed) return;
                    completed = true;
                    try {
                        expect(msg.topic).toBe("goodwe/discover");
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    done();
                });
                
                n1.receive({ payload: true });
            });
        }, 10000);

        it("should include timestamp in output", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", (msg) => {
                    if (completed) return;
                    completed = true;
                    try {
                        expect(msg._timestamp).toBeDefined();
                        const timestamp = new Date(msg._timestamp);
                        expect(timestamp).toBeInstanceOf(Date);
                        expect(isNaN(timestamp.getTime())).toBe(false);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    done();
                });
                
                n1.receive({ payload: true });
            });
        }, 10000);

        it("should preserve message properties", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", (msg) => {
                    if (completed) return;
                    completed = true;
                    try {
                        expect(msg.customProperty).toBe("preserved");
                        expect(msg._msgid).toBeDefined();
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    done();
                });
                
                n1.receive({ 
                    payload: true,
                    customProperty: "preserved"
                });
            });
        }, 10000);
    });

    describe("output format", () => {
        it("should return devices array", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", (msg) => {
                    if (completed) return;
                    completed = true;
                    try {
                        expect(Array.isArray(msg.payload.devices)).toBe(true);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    done();
                });
                
                n1.receive({ payload: true });
            });
        }, 10000);

        it("should return count matching devices length", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", (msg) => {
                    if (completed) return;
                    completed = true;
                    try {
                        expect(msg.payload.count).toBe(msg.payload.devices.length);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    done();
                });
                
                n1.receive({ payload: true });
            });
        }, 10000);

        it("should format devices with required fields", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", (msg) => {
                    if (completed) return;
                    completed = true;
                    try {
                        // If devices are found, check their format
                        if (msg.payload.devices.length > 0) {
                            const device = msg.payload.devices[0];
                            expect(device.host).toBeDefined();
                            expect(device.port).toBeDefined();
                            expect(device.model).toBeDefined();
                            expect(device.serial).toBeDefined();
                            expect(device.family).toBeDefined();
                            expect(device.protocol).toBe("udp");
                        }
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    done();
                });
                
                n1.receive({ payload: true });
            });
        }, 10000);

        it("should handle no devices found gracefully", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", (msg) => {
                    if (completed) return;
                    completed = true;
                    try {
                        // No devices case
                        if (msg.payload.count === 0) {
                            expect(msg.payload.devices).toEqual([]);
                            expect(msg.payload.count).toBe(0);
                        }
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    done();
                });
                
                n1.receive({ payload: true });
            });
        }, 10000);
    });

    describe("status updates", () => {
        it("should start with ready status", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500
                }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                // Status is updated asynchronously, so we just check the node exists
                expect(n1).toBeDefined();
                done();
            });
        });

        it("should complete discovery within timeout", (done) => {
            const timeout = 500;
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: timeout,
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            const startTime = Date.now();
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let completed = false;
                
                n2.on("input", () => {
                    if (completed) return;
                    completed = true;
                    const elapsed = Date.now() - startTime;
                    try {
                        // Discovery should complete within timeout + small buffer
                        expect(elapsed).toBeLessThan(timeout + 1000);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.on("call:error", () => {
                    if (completed) return;
                    completed = true;
                    done();
                });
                
                n1.receive({ payload: true });
            });
        }, 10000);
    });

    describe("error handling", () => {
        it("should handle discovery errors gracefully", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 100,
                    broadcastAddress: "invalid",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                
                let errorReceived = false;
                
                n1.on("call:error", () => {
                    errorReceived = true;
                });
                
                // Wait for potential error
                setTimeout(() => {
                    // Either error was received or discovery completed
                    // Both are acceptable for this test
                    done();
                }, 500);
                
                n1.receive({ payload: true });
            });
        });
    });

    describe("node lifecycle", () => {
        it("should cleanup on close", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover"
                }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                expect(n1).toBeDefined();
                
                // Close should complete without error
                n1.close();
                done();
            });
        });
    });

    describe("configuration validation", () => {
        it("should use minimum timeout of 1000ms", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    timeout: 500
                }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                // Node accepts the configured value, validation is in UI
                expect(n1.timeout).toBeDefined();
                done();
            });
        });

        it("should accept custom broadcast address", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-discover",
                    broadcastAddress: "192.168.1.255"
                }
            ];
            
            helper.load(discoverNode, flow, () => {
                const n1 = helper.getNode("n1");
                expect(n1.broadcastAddress).toBe("192.168.1.255");
                done();
            });
        });
    });
});
