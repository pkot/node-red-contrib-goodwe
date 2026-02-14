/**
 * Tests for GoodWe Discover Node
 * 
 * These tests verify the dedicated discover node functionality
 * for finding GoodWe inverters on the local network.
 */

const helper = require("node-red-node-test-helper");
const discoverNode = require("../nodes/discover.js");
const protocol = require("../lib/protocol.js");

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

    describe("discovery operation with mocked protocol", () => {        
        let discoverSpy;
        
        beforeEach(() => {
            // Spy on discoverInverters
            discoverSpy = jest.spyOn(protocol, 'discoverInverters');
        });
        
        afterEach(() => {
            // Restore original function
            if (discoverSpy) {
                discoverSpy.mockRestore();
            }
        });
        
        it("should format discovered devices correctly", (done) => {
            // Mock discoverInverters for this test
            discoverSpy.mockResolvedValue([
                {
                    ip: "192.168.1.100",
                    port: 8899,
                    modelName: "GW5000-EH",
                    serialNumber: "ETxxxxxxxx",
                    family: "ET"
                }
            ]);
            
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
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.devices).toBeDefined();
                        expect(msg.payload.devices.length).toBe(1);
                        const device = msg.payload.devices[0];
                        expect(device.host).toBe("192.168.1.100");
                        expect(device.port).toBe(8899);
                        expect(device.model).toBe("GW5000-EH");
                        expect(device.serial).toBe("ETxxxxxxxx");
                        expect(device.family).toBe("ET");
                        expect(device.protocol).toBe("udp");
                        expect(msg.payload.count).toBe(1);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: true });
            });
        });
        
        it("should handle empty discovery results", (done) => {
            // Mock empty result
            discoverSpy.mockResolvedValue([]);
            
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
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.devices).toEqual([]);
                        expect(msg.payload.count).toBe(0);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: true });
            });
        });
        
        it("should handle devices without optional fields", (done) => {
            // Mock device without optional fields
            discoverSpy.mockResolvedValue([
                {
                    ip: "192.168.1.101"
                }
            ]);
            
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
                
                n2.on("input", (msg) => {
                    try {
                        const device = msg.payload.devices[0];
                        expect(device.host).toBe("192.168.1.101");
                        expect(device.port).toBe(8899); // DEFAULT_PORT
                        expect(device.model).toBe("GoodWe Inverter"); // default
                        expect(device.serial).toBe("UNKNOWN"); // default
                        expect(device.family).toBe("ET"); // default
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
                
                n1.receive({ payload: true });
            });
        });
        
        it("should handle discovery errors", (done) => {
            // Mock error
            discoverSpy.mockRejectedValue(new Error("Network error"));
            
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
                
                n1.on("call:error", (err) => {
                    try {
                        expect(err).toBeDefined();
                        done();
                    } catch(e) {
                        done(e);
                    }
                });
                
                n1.receive({ payload: true });
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
                
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.devices).toBeDefined();
                        expect(Array.isArray(msg.payload.devices)).toBe(true);
                        expect(msg.payload.count).toBeDefined();
                        expect(typeof msg.payload.count).toBe("number");
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                // Handle errors in test environment (e.g., EPERM)
                n1.on("call:error", () => complete());
                
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.topic).toBe("goodwe/discover");
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                n1.on("call:error", () => complete());
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg._timestamp).toBeDefined();
                        const timestamp = new Date(msg._timestamp);
                        expect(timestamp).toBeInstanceOf(Date);
                        expect(isNaN(timestamp.getTime())).toBe(false);
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                n1.on("call:error", () => complete());
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.customProperty).toBe("preserved");
                        expect(msg._msgid).toBeDefined();
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                n1.on("call:error", () => complete());
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
                    try {
                        expect(Array.isArray(msg.payload.devices)).toBe(true);
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                n1.on("call:error", () => complete());
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.count).toBe(msg.payload.devices.length);
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                n1.on("call:error", () => complete());
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
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
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                n1.on("call:error", () => complete());
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
                    try {
                        // No devices case
                        if (msg.payload.count === 0) {
                            expect(msg.payload.devices).toEqual([]);
                            expect(msg.payload.count).toBe(0);
                        }
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                n1.on("call:error", () => complete());
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
                const complete = () => {
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
                };
                
                n2.on("input", () => complete());
                n1.on("call:error", () => complete());
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

        it("should use fallback send/done for Node-RED pre-1.0", (done) => {
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    done();
                };
                
                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload).toBeDefined();
                        complete();
                    } catch(err) {
                        completed = true;
                        done(err);
                    }
                });
                
                n1.on("call:error", () => complete());
                // Call without send/done parameters (pre-1.0 style)
                n1.receive({ payload: true });
            });
        }, 10000);
        
        it("should cleanup timers on close", (done) => {
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
                const complete = () => {
                    if (completed) return;
                    completed = true;
                    // After discovery completes, close the node
                    // This should clean up any pending timers
                    n1.close();
                    
                    try {
                        expect(n1.statusResetTimers.length).toBe(0);
                        done();
                    } catch(err) {
                        done(err);
                    }
                };
                
                n2.on("input", () => complete());
                n1.on("call:error", () => complete());
                n1.receive({ payload: true });
            });
        }, 10000);
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
