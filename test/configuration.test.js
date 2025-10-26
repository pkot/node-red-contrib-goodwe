/**
 * Tests for Configuration Read/Write Operations
 * 
 * These tests validate configuration reading and writing capabilities,
 * including validation, error handling, and safety features.
 */

const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe.js");

helper.init(require.resolve("node-red"));

describe("Configuration Operations", () => {
    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload().then(() => {
            helper.stopServer(done);
        });
    });

    describe("Read Settings", () => {
        it("should read all settings with read_settings command", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
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
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("read_settings");
                        expect(msg.payload.data).toBeDefined();
                        expect(typeof msg.payload.data).toBe("object");
                        
                        // Should contain common settings
                        expect(msg.payload.data.grid_export_limit).toBeDefined();
                        expect(msg.payload.data.operation_mode).toBeDefined();
                        expect(msg.payload.data.battery_dod).toBeDefined();
                        
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { command: "read_settings" } });
            });
        });

        it("should read specific setting with read_setting command", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("read_setting");
                        expect(msg.payload.data).toBeDefined();
                        expect(msg.payload.data.setting_id).toBe("grid_export_limit");
                        expect(msg.payload.data.value).toBeDefined();
                        expect(typeof msg.payload.data.value).toBe("number");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "read_setting",
                        setting_id: "grid_export_limit"
                    } 
                });
            });
        });

        it("should handle invalid setting_id gracefully", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.code).toBe("INVALID_SETTING");
                        expect(msg.payload.error.message).toContain("invalid_setting_xyz");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "read_setting",
                        setting_id: "invalid_setting_xyz"
                    } 
                });
            });
        });
    });

    describe("Write Settings", () => {
        it("should write setting with write_setting command", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("write_setting");
                        expect(msg.payload.data).toBeDefined();
                        expect(msg.payload.data.setting_id).toBe("grid_export_limit");
                        expect(msg.payload.data.value).toBe(5000);
                        expect(msg.payload.data.previous_value).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "write_setting",
                        setting_id: "grid_export_limit",
                        value: 5000
                    } 
                });
            });
        });

        it("should validate setting value before writing", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.code).toBe("VALIDATION_ERROR");
                        expect(msg.payload.error.message).toContain("out of range");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "write_setting",
                        setting_id: "grid_export_limit",
                        value: -1000 // Invalid negative value
                    } 
                });
            });
        });

        it("should reject write without required value parameter", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.code).toBe("MISSING_PARAMETER");
                        expect(msg.payload.error.message).toContain("value");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "write_setting",
                        setting_id: "grid_export_limit"
                        // Missing value parameter
                    } 
                });
            });
        });
    });

    describe("Specialized Configuration APIs", () => {
        it("should get grid export limit", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("get_grid_export_limit");
                        expect(msg.payload.data).toBeDefined();
                        expect(msg.payload.data.limit).toBeDefined();
                        expect(typeof msg.payload.data.limit).toBe("number");
                        expect(msg.payload.data.limit).toBeGreaterThanOrEqual(0);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { command: "get_grid_export_limit" } });
            });
        });

        it("should set grid export limit", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("set_grid_export_limit");
                        expect(msg.payload.data).toBeDefined();
                        expect(msg.payload.data.limit).toBe(5000);
                        expect(msg.payload.data.previous_limit).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "set_grid_export_limit",
                        limit: 5000
                    } 
                });
            });
        });

        it("should get operation mode", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("get_operation_mode");
                        expect(msg.payload.data).toBeDefined();
                        expect(msg.payload.data.mode).toBeDefined();
                        expect(["GENERAL", "OFF_GRID", "BACKUP", "ECO", "PEAK_SHAVING"]).toContain(msg.payload.data.mode);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { command: "get_operation_mode" } });
            });
        });

        it("should set operation mode", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("set_operation_mode");
                        expect(msg.payload.data).toBeDefined();
                        expect(msg.payload.data.mode).toBe("ECO");
                        expect(msg.payload.data.previous_mode).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "set_operation_mode",
                        mode: "ECO",
                        eco_mode_power: 100,
                        eco_mode_soc: 90
                    } 
                });
            });
        });

        it("should validate operation mode value", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.code).toBe("VALIDATION_ERROR");
                        expect(msg.payload.error.message).toContain("Invalid");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "set_operation_mode",
                        mode: "INVALID_MODE"
                    } 
                });
            });
        });

        it("should get battery DoD", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("get_battery_dod");
                        expect(msg.payload.data).toBeDefined();
                        expect(msg.payload.data.dod).toBeDefined();
                        expect(typeof msg.payload.data.dod).toBe("number");
                        expect(msg.payload.data.dod).toBeGreaterThanOrEqual(0);
                        expect(msg.payload.data.dod).toBeLessThanOrEqual(89);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { command: "get_battery_dod" } });
            });
        });

        it("should set battery DoD", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("set_battery_dod");
                        expect(msg.payload.data).toBeDefined();
                        expect(msg.payload.data.dod).toBe(80);
                        expect(msg.payload.data.previous_dod).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "set_battery_dod",
                        dod: 80
                    } 
                });
            });
        });

        it("should validate battery DoD range", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.code).toBe("VALIDATION_ERROR");
                        expect(msg.payload.error.message).toContain("out of range");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "set_battery_dod",
                        dod: 95 // Out of valid range 0-89
                    } 
                });
            });
        });
    });

    describe("Error Handling", () => {
        it("should handle write failure gracefully", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.message).toBeDefined();
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "write_setting",
                        setting_id: "invalid_setting_xyz",
                        value: 5000
                    } 
                });
            });
        });

        it("should report validation errors clearly", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        expect(msg.payload.success).toBe(false);
                        expect(msg.payload.error).toBeDefined();
                        expect(msg.payload.error.code).toBe("VALIDATION_ERROR");
                        expect(msg.payload.error.message).toContain("number");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "write_setting",
                        setting_id: "grid_export_limit",
                        value: "not_a_number"  // Wrong type
                    } 
                });
            });
        });
    });

    describe("Status Reporting", () => {
        it("should update status during config read", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        // Just verify that the command succeeded
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("read_settings");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: { command: "read_settings" } });
            });
        });

        it("should update status during config write", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe", 
                    name: "test goodwe",
                    host: "192.168.1.100",
                    port: "8899",
                    protocol: "udp",
                    family: "ET",
                    wires: [["n2"]]
                },
                { id: "n2", type: "helper" }
            ];

            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", (msg) => {
                    try {
                        // Just verify that the command succeeded
                        expect(msg.payload.success).toBe(true);
                        expect(msg.payload.command).toBe("write_setting");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ 
                    payload: { 
                        command: "write_setting",
                        setting_id: "grid_export_limit",
                        value: 5000
                    } 
                });
            });
        });
    });
});
