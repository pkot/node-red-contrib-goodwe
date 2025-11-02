/**
 * Tests for GoodWe Read Node
 * 
 * These tests validate:
 * - Read node creation and configuration
 * - Flat output format (default)
 * - Categorized output format
 * - Array output format
 * - Sensor filtering (single and multiple)
 * - Auto-polling functionality
 * - Polling lifecycle (start/stop/cleanup)
 * - Message structure and metadata
 */

const helper = require("node-red-node-test-helper");
const readNode = require("../nodes/read.js");
const configNode = require("../nodes/config.js");
const testUtils = require("./test-utils.js");

helper.init(require.resolve("node-red"));

describe("GoodWe Read Node", function () {
    
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    /**
     * Helper function to create a read node flow
     */
    function createReadFlow(config = {}) {
        const nodeId = config.id || "n1";
        const configId = config.configId || "c1";
        const helperId = config.helperId || "n2";

        return [
            {
                id: configId,
                type: "goodwe-config",
                name: config.configName || "test config",
                host: config.host || "192.168.1.100",
                port: config.port || 8899,
                protocol: config.protocol || "udp",
                family: config.family || "ET"
            },
            {
                id: nodeId,
                type: "goodwe-read",
                name: config.name || "test read",
                config: configId,
                outputFormat: config.outputFormat || "flat",
                polling: config.polling || 0,
                wires: [[helperId]]
            },
            { id: helperId, type: "helper" }
        ];
    }

    describe("Node Creation", function () {
        
        it("should be loaded", function (done) {
            const flow = createReadFlow();

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1).toBeDefined();
                    expect(n1.name).toBe("test read");
                    expect(n1.outputFormat).toBe("flat");
                    expect(n1.polling).toBe(0);
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it("should require a config node", function (done) {
            const flow = [
                {
                    id: "n1",
                    type: "goodwe-read",
                    name: "test read"
                    // No config node
                }
            ];

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                try {
                    // Node should exist but show error status
                    expect(n1).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });

        it("should initialize with default output format", function (done) {
            const flow = createReadFlow({ outputFormat: undefined });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.outputFormat).toBe("flat");
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe("Flat Output Format", function () {
        
        it("should output flat format by default", function (done) {
            const flow = createReadFlow({ outputFormat: "flat" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(typeof msg.payload).toBe("object");
                        expect(Array.isArray(msg.payload)).toBe(false);
                        
                        // Should have sensor values directly in payload
                        expect(msg.payload.vpv1).toBeDefined();
                        expect(msg.payload.ipv1).toBeDefined();
                        expect(msg.payload.pac).toBeDefined();
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });

        it("should include metadata in message", function (done) {
            const flow = createReadFlow({ outputFormat: "flat" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.topic).toBe("goodwe/runtime_data");
                        expect(msg._timestamp).toBeDefined();
                        expect(msg._inverter).toBeDefined();
                        expect(msg._inverter.family).toBe("ET");
                        expect(msg._inverter.host).toBe("192.168.1.100");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });

        it("should preserve input message properties", function (done) {
            const flow = createReadFlow({ outputFormat: "flat" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.customProperty).toBe("test value");
                        expect(msg.anotherProperty).toBe(123);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: true,
                    customProperty: "test value",
                    anotherProperty: 123
                });
            });
        });
    });

    describe("Categorized Output Format", function () {
        
        it("should output categorized format", function (done) {
            const flow = createReadFlow({ outputFormat: "categorized" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(typeof msg.payload).toBe("object");
                        
                        // Should have categories
                        expect(msg.payload.pv).toBeDefined();
                        expect(msg.payload.grid).toBeDefined();
                        expect(msg.payload.energy).toBeDefined();
                        
                        // PV category should have PV sensors
                        expect(msg.payload.pv.vpv1).toBeDefined();
                        expect(msg.payload.pv.ipv1).toBeDefined();
                        
                        // Grid category should have grid sensors
                        expect(msg.payload.grid.vac1).toBeDefined();
                        expect(msg.payload.grid.pac).toBeDefined();
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });

        it("should include battery category for ET family", function (done) {
            const flow = createReadFlow({ 
                outputFormat: "categorized",
                family: "ET"
            });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload.battery).toBeDefined();
                        expect(msg.payload.battery.vbattery1).toBeDefined();
                        expect(msg.payload.battery.battery_soc).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });

        it("should not include empty categories", function (done) {
            const flow = createReadFlow({ outputFormat: "categorized" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        // All categories should have at least one sensor
                        Object.keys(msg.payload).forEach(category => {
                            expect(Object.keys(msg.payload[category]).length).toBeGreaterThan(0);
                        });
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });
    });

    describe("Array Output Format", function () {
        
        it("should output array format with metadata", function (done) {
            const flow = createReadFlow({ outputFormat: "array" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(Array.isArray(msg.payload)).toBe(true);
                        expect(msg.payload.length).toBeGreaterThan(0);
                        
                        // Each item should have required fields
                        msg.payload.forEach(item => {
                            expect(item.id).toBeDefined();
                            expect(item.value).toBeDefined();
                            expect(item.name).toBeDefined();
                            expect(item.unit).toBeDefined();
                            expect(item.kind).toBeDefined();
                        });
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });

        it("should include correct metadata for known sensors", function (done) {
            const flow = createReadFlow({ outputFormat: "array" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        // Find vpv1 sensor
                        const vpv1 = msg.payload.find(item => item.id === "vpv1");
                        expect(vpv1).toBeDefined();
                        expect(vpv1.name).toBe("PV1 Voltage");
                        expect(vpv1.unit).toBe("V");
                        expect(vpv1.kind).toBe("PV");
                        
                        // Find battery_soc sensor
                        const batterySoc = msg.payload.find(item => item.id === "battery_soc");
                        if (batterySoc) {
                            expect(batterySoc.name).toBe("Battery SoC");
                            expect(batterySoc.unit).toBe("%");
                            expect(batterySoc.kind).toBe("BAT");
                        }
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });
    });

    describe("Sensor Filtering", function () {
        
        it("should filter single sensor", function (done) {
            const flow = createReadFlow({ outputFormat: "flat" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.vpv1).toBeDefined();
                        
                        // Should only have one sensor
                        expect(Object.keys(msg.payload).length).toBe(1);
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { sensor_id: "vpv1" } });
            });
        });

        it("should filter multiple sensors", function (done) {
            const flow = createReadFlow({ outputFormat: "flat" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.vpv1).toBeDefined();
                        expect(msg.payload.vpv2).toBeDefined();
                        expect(msg.payload.battery_soc).toBeDefined();
                        
                        // Should only have three sensors
                        expect(Object.keys(msg.payload).length).toBe(3);
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { sensors: ["vpv1", "vpv2", "battery_soc"] } });
            });
        });

        it("should work with categorized format and filtering", function (done) {
            const flow = createReadFlow({ outputFormat: "categorized" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.pv).toBeDefined();
                        expect(msg.payload.pv.vpv1).toBeDefined();
                        expect(msg.payload.pv.vpv2).toBeDefined();
                        
                        // Should only have pv category with two sensors
                        expect(Object.keys(msg.payload)).toEqual(["pv"]);
                        expect(Object.keys(msg.payload.pv).length).toBe(2);
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { sensors: ["vpv1", "vpv2"] } });
            });
        });

        it("should work with array format and filtering", function (done) {
            const flow = createReadFlow({ outputFormat: "array" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(Array.isArray(msg.payload)).toBe(true);
                        expect(msg.payload.length).toBe(2);
                        
                        // Should have vpv1 and battery_soc
                        const ids = msg.payload.map(item => item.id);
                        expect(ids).toContain("vpv1");
                        expect(ids).toContain("battery_soc");
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { sensors: ["vpv1", "battery_soc"] } });
            });
        });
    });

    describe("Auto-Polling", function () {
        
        it("should not poll when polling is 0", function (done) {
            const flow = createReadFlow({ polling: 0 });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                let messageCount = 0;
                n2.on("input", function () {
                    messageCount++;
                });

                // Wait 1 second and verify no automatic messages
                setTimeout(() => {
                    try {
                        expect(messageCount).toBe(0);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 1000);
            });
        });

        it("should poll at configured interval", function (done) {
            const flow = createReadFlow({ polling: 1 }); // 1 second

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                let messageCount = 0;
                n2.on("input", function () {
                    messageCount++;
                });

                // Wait 2.5 seconds and verify we got at least 2 messages
                setTimeout(() => {
                    try {
                        expect(messageCount).toBeGreaterThanOrEqual(2);
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 2500);
            });
        });

        it("should stop polling when node is closed", function (done) {
            const flow = createReadFlow({ polling: 1 });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                let messageCount = 0;
                n2.on("input", function () {
                    messageCount++;
                });

                // Wait 1.5 seconds, then close the node
                setTimeout(() => {
                    const countBeforeClose = messageCount;
                    
                    // Close the node
                    n1.close().then(() => {
                        // Wait another 1.5 seconds
                        setTimeout(() => {
                            try {
                                // Message count should not have increased
                                expect(messageCount).toBe(countBeforeClose);
                                done();
                            } catch (err) {
                                done(err);
                            }
                        }, 1500);
                    });
                }, 1500);
            });
        });

        it("should output correct format during polling", function (done) {
            const flow = createReadFlow({ 
                polling: 1,
                outputFormat: "categorized"
            });

            helper.load([configNode, readNode], flow, function () {
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        // Verify categorized format
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.pv).toBeDefined();
                        expect(msg.payload.grid).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });
            });
        });
    });

    describe("Error Handling", function () {
        
        it("should handle invalid host gracefully", function (done) {
            const flow = createReadFlow({ host: "invalid" });

            helper.load([configNode, readNode], flow, function () {
                const n1 = helper.getNode("n1");

                // Should not throw, but will log error
                n1.receive({ payload: true });

                // Give it a moment to process
                setTimeout(() => {
                    done();
                }, 100);
            });
        });
    });
});
