/**
 * Tests for runtime sensor data retrieval and output
 * 
 * These tests validate:
 * - Successful retrieval of runtime data from inverter
 * - Proper mapping of sensor data to Node-RED message format
 * - Error handling for connection issues
 * - Message output structure
 */

const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe-legacy.js");
const mockData = require("./fixtures/mock-inverter-data.js");
const testUtils = require("./test-utils.js");

helper.init(require.resolve("node-red"));

describe("Runtime Data Retrieval", function () {
    
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    describe("Data Retrieval", function () {
        
        it("should retrieve runtime data on 'read' command", function (done) {
            const flow = testUtils.createBasicFlow({
                id: "n1",
                host: "192.168.1.100",
                port: 8899,
                protocol: "udp",
                family: "ET"
            });

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("read");
                        expect(msg.payload.timestamp).toBeDefined();
                        expect(msg.payload.data).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should retrieve runtime data on empty input (default read)", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload.command).toBe("read");
                        expect(msg.payload.data).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "" });
            });
        });

        it("should include all required sensor fields in runtime data", function (done) {
            const flow = testUtils.createBasicFlow({ family: "ET" });

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        const data = msg.payload.data;
                        
                        // PV sensors
                        expect(data.vpv1).toBeDefined();
                        expect(data.ipv1).toBeDefined();
                        
                        // AC sensors
                        expect(data.vac1).toBeDefined();
                        expect(data.iac1).toBeDefined();
                        expect(data.fac1).toBeDefined();
                        expect(data.pac).toBeDefined();
                        
                        // System status
                        expect(data.work_mode).toBeDefined();
                        expect(data.temperature).toBeDefined();
                        
                        // Energy statistics
                        expect(data.e_day).toBeDefined();
                        expect(data.e_total).toBeDefined();
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should handle runtime data for three-phase inverters (DT family)", function (done) {
            const flow = testUtils.createBasicFlow({
                family: "DT",
                host: "192.168.1.101"
            });

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        const data = msg.payload.data;
                        
                        // Three-phase should have vac1, vac2, vac3
                        expect(data.vac1).toBeDefined();
                        expect(data.vac2).toBeDefined();
                        expect(data.vac3).toBeDefined();
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });
    });

    describe("Output Message Structure", function () {
        
        it("should output message with correct structure", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        // Check top-level structure
                        expect(msg.payload).toHaveProperty("success");
                        expect(msg.payload).toHaveProperty("command");
                        expect(msg.payload).toHaveProperty("timestamp");
                        expect(msg.payload).toHaveProperty("data");
                        
                        // Verify types
                        expect(typeof msg.payload.success).toBe("boolean");
                        expect(typeof msg.payload.command).toBe("string");
                        expect(typeof msg.payload.timestamp).toBe("string");
                        expect(typeof msg.payload.data).toBe("object");
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should preserve original message properties", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.customProperty).toBe("test-value");
                        expect(msg._msgid).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: "read",
                    customProperty: "test-value"
                });
            });
        });

        it("should set topic if not provided", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.topic).toBe("goodwe/read");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should preserve existing topic", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.topic).toBe("custom/topic");
                        done();
                    } catch (err) {
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

    describe("Sensor Data Mapping", function () {
        
        it("should map voltage sensors correctly", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        const data = msg.payload.data;
                        
                        // Voltage values should be numbers
                        expect(typeof data.vpv1).toBe("number");
                        expect(typeof data.vac1).toBe("number");
                        
                        // Reasonable voltage ranges for PV (0-600V) and AC (0-400V)
                        expect(data.vpv1).toBeGreaterThanOrEqual(0);
                        expect(data.vpv1).toBeLessThanOrEqual(600);
                        expect(data.vac1).toBeGreaterThanOrEqual(0);
                        expect(data.vac1).toBeLessThanOrEqual(400);
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should map current sensors correctly", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        const data = msg.payload.data;
                        
                        // Current values should be numbers
                        expect(typeof data.ipv1).toBe("number");
                        expect(typeof data.iac1).toBe("number");
                        
                        // Reasonable current ranges (0-50A typical)
                        expect(data.ipv1).toBeGreaterThanOrEqual(0);
                        expect(data.ipv1).toBeLessThanOrEqual(50);
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should map power sensors correctly", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        const data = msg.payload.data;
                        
                        // Power values should be numbers
                        expect(typeof data.pac).toBe("number");
                        
                        // Reasonable power range (0-50kW typical)
                        expect(data.pac).toBeGreaterThanOrEqual(0);
                        expect(data.pac).toBeLessThanOrEqual(50000);
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should map energy statistics correctly", function (done) {
            const flow = testUtils.createBasicFlow();

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        const data = msg.payload.data;
                        
                        // Energy values should be numbers
                        expect(typeof data.e_day).toBe("number");
                        expect(typeof data.e_total).toBe("number");
                        
                        // Daily energy should be less than total
                        expect(data.e_day).toBeLessThanOrEqual(data.e_total);
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });
    });

    describe("Error Handling", function () {
        
        it("should handle missing host configuration", function (done) {
            const flow = [
                {
                    id: "n1",
                    type: "goodwe-legacy",
                    name: "test goodwe",
                    host: "invalid", // Invalid host to trigger error
                    port: 8899,
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.code).toBeDefined();
                        expect(msg.payload.error.message).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should include error details in response", function (done) {
            const flow = [
                {
                    id: "n1",
                    type: "goodwe-legacy",
                    name: "test goodwe",
                    host: "", // Empty host to trigger error
                    port: 8899,
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.code).toBe("RUNTIME_ERROR");
                        expect(msg.payload.error.message).toContain("Invalid host");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: "read" });
            });
        });

        it("should update node status to error on failure", function (done) {
            const flow = [
                {
                    id: "n1",
                    type: "goodwe-legacy",
                    name: "test goodwe",
                    host: "",
                    port: 8899,
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, function () {
                const n1 = helper.getNode("n1");
                const statusCalls = testUtils.captureStatusCalls(n1);

                n1.receive({ payload: "read" });

                // Wait a bit for status updates
                setTimeout(() => {
                    try {
                        // Should have error status at some point
                        const errorStatus = statusCalls.find(s => s.fill === "red");
                        expect(errorStatus).toBeDefined();
                        expect(errorStatus.text).toBe("error");
                        done();
                    } catch (err) {
                        done(err);
                    }
                }, 100);
            });
        });
    });
});
