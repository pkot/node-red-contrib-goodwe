/**
 * Tests for GoodWe Read Node
 */

const helper = require("node-red-node-test-helper");
const readNode = require("../nodes/read.js");
const configNode = require("../nodes/config.js");

helper.init(require.resolve("node-red"));

describe("GoodWe Read Node", function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it("should be loaded with default configuration", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-read", name: "test read", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, readNode], flow, function () {
            const n1 = helper.getNode("n1");
            expect(n1).toBeDefined();
            expect(n1.name).toBe("test read");
            expect(n1.outputFormat).toBe("flat");
            expect(n1.pollingInterval).toBe(0);
            done();
        });
    });

    it("should read runtime data when triggered", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-read", name: "test read", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, readNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload).toBeDefined();
                    expect(msg.payload.vpv1).toBeDefined();
                    expect(msg.payload.ipv1).toBeDefined();
                    expect(msg.topic).toBe("goodwe/runtime_data");
                    expect(msg._timestamp).toBeDefined();
                    expect(msg._inverter).toBeDefined();
                    expect(msg._inverter.family).toBe("ET");
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ payload: true });
        });
    });

    it("should output categorized format when configured", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-read", name: "test read", config: "c1", outputFormat: "categorized", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, readNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload).toBeDefined();
                    expect(msg.payload.pv).toBeDefined();
                    expect(msg.payload.battery).toBeDefined();
                    expect(msg.payload.grid).toBeDefined();
                    expect(msg.payload.energy).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ payload: true });
        });
    });

    it("should output array format when configured", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-read", name: "test read", config: "c1", outputFormat: "array", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, readNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(Array.isArray(msg.payload)).toBe(true);
                    expect(msg.payload.length).toBeGreaterThan(0);
                    expect(msg.payload[0].id).toBeDefined();
                    expect(msg.payload[0].value).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ payload: true });
        });
    });

    it("should handle missing config node", function (done) {
        const flow = [
            { id: "n1", type: "goodwe-read", name: "test read", config: "", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load(readNode, flow, function () {
            const n1 = helper.getNode("n1");
            expect(n1).toBeDefined();
            expect(n1.configNode).toBeNull();
            done();
        });
    });

    it("should filter specific sensor", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-read", name: "test read", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, readNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload).toBeDefined();
                    expect(msg.payload.vpv1).toBeDefined();
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
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-read", name: "test read", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, readNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload).toBeDefined();
                    expect(msg.payload.vpv1).toBeDefined();
                    expect(msg.payload.ipv1).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ payload: { sensors: ["vpv1", "ipv1"] } });
        });
    });

    it("should handle close event properly", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-read", name: "test read", config: "c1", pollingInterval: 1, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, readNode], flow, function () {
            const n1 = helper.getNode("n1");
            expect(n1.pollingTimer).toBeDefined();
            helper.unload().then(() => done());
        });
    });
});
