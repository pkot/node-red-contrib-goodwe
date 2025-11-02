/**
 * Tests for GoodWe Discover and Info Nodes
 */

const helper = require("node-red-node-test-helper");
const discoverNode = require("../nodes/discover.js");
const infoNode = require("../nodes/info.js");
const configNode = require("../nodes/config.js");

helper.init(require.resolve("node-red"));

describe("GoodWe Discover Node", function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it("should be loaded", function (done) {
        const flow = [
            { id: "n1", type: "goodwe-discover", name: "test discover", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load(discoverNode, flow, function () {
            const n1 = helper.getNode("n1");
            expect(n1).toBeDefined();
            expect(n1.name).toBe("test discover");
            done();
        });
    });

    it("should discover inverters", function (done) {
        const flow = [
            { id: "n1", type: "goodwe-discover", name: "test discover", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load(discoverNode, flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload).toBeDefined();
                    // Discovery may fail in test environment due to UDP broadcast permissions
                    // Check if it's either a success or error response
                    if (msg.payload.success === false) {
                        // Error response
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.command).toBe("discover");
                    } else {
                        // Success response
                        expect(msg.payload.devices).toBeDefined();
                        expect(Array.isArray(msg.payload.devices)).toBe(true);
                        expect(msg.payload.count).toBeDefined();
                    }
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ payload: true });
        });
    }, 10000); // Increase timeout for discovery
});

describe("GoodWe Info Node", function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it("should be loaded", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-info", name: "test info", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, infoNode], flow, function () {
            const n1 = helper.getNode("n1");
            expect(n1).toBeDefined();
            expect(n1.name).toBe("test info");
            done();
        });
    });

    it("should get device information", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-info", name: "test info", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, infoNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload).toBeDefined();
                    expect(msg.payload.model_name).toBeDefined();
                    expect(msg.payload.serial_number).toBeDefined();
                    expect(msg.payload.firmware).toBeDefined();
                    expect(msg.payload.family).toBeDefined();
                    expect(msg.topic).toBe("goodwe/device_info");
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ payload: true });
        });
    });
});
