/**
 * Tests for GoodWe Write Node
 */

const helper = require("node-red-node-test-helper");
const writeNode = require("../nodes/write.js");
const configNode = require("../nodes/config.js");

helper.init(require.resolve("node-red"));

describe("GoodWe Write Node", function () {

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
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            const n1 = helper.getNode("n1");
            expect(n1).toBeDefined();
            expect(n1.name).toBe("test write");
            done();
        });
    });

    it("should write a setting successfully", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload).toBeDefined();
                    expect(msg.payload.success).toBe(true);
                    expect(msg.payload.setting_id).toBe("grid_export_limit");
                    expect(msg.payload.value).toBe(5000);
                    expect(msg.payload.previous_value).toBeDefined();
                    expect(msg.topic).toBe("goodwe/write_confirm");
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                payload: { 
                    setting_id: "grid_export_limit",
                    value: 5000
                }
            });
        });
    });

    it("should fail with invalid setting", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload.success).toBe(false);
                    expect(msg.payload.error).toBeDefined();
                    expect(msg.topic).toBe("goodwe/error");
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                payload: { 
                    setting_id: "invalid_setting",
                    value: 100
                }
            });
        });
    });

    it("should fail with out of range value", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload.success).toBe(false);
                    expect(msg.payload.error).toBeDefined();
                    expect(msg.payload.error.code).toBe("VALIDATION_ERROR");
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                payload: { 
                    setting_id: "grid_export_limit",
                    value: 99999 // Out of range
                }
            });
        });
    });

    it("should handle missing config node", function (done) {
        const flow = [
            { id: "n1", type: "goodwe-write", name: "test write", config: "", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load(writeNode, flow, function () {
            const n1 = helper.getNode("n1");
            expect(n1).toBeDefined();
            expect(n1.configNode).toBeNull();
            done();
        });
    });

    it("should fail with missing setting_id", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload.success).toBe(false);
                    expect(msg.payload.error).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                payload: { 
                    value: 5000
                }
            });
        });
    });

    it("should fail with missing value", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload.success).toBe(false);
                    expect(msg.payload.error).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                payload: { 
                    setting_id: "grid_export_limit"
                }
            });
        });
    });

    it("should fail with invalid payload type", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload.success).toBe(false);
                    expect(msg.payload.error).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ payload: "invalid" });
        });
    });

    it("should handle close event properly", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            helper.unload().then(() => done());
        });
    });

    it("should require confirmation when configured", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" },
            { id: "n1", type: "goodwe-write", name: "test write", config: "c1", confirm: true, wires: [["n2"]] },
            { id: "n2", type: "helper" }
        ];

        helper.load([configNode, writeNode], flow, function () {
            const n1 = helper.getNode("n1");
            const n2 = helper.getNode("n2");

            n2.on("input", function (msg) {
                try {
                    expect(msg.payload.success).toBe(false);
                    expect(msg.payload.error).toBeDefined();
                    expect(msg.payload.error.message).toContain("Confirmation required");
                    done();
                } catch (err) {
                    done(err);
                }
            });

            n1.receive({ 
                payload: { 
                    setting_id: "grid_export_limit",
                    value: 5000
                }
            });
        });
    });
});
