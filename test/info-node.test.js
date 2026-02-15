/**
 * Tests for GoodWe Info Node
 *
 * These tests validate:
 * - Info node creation and configuration
 * - Device info retrieval and output format
 * - Message structure and metadata
 * - Error handling
 */

const helper = require("node-red-node-test-helper");
const configNode = require("../nodes/config.js");

helper.init(require.resolve("node-red"));

/**
 * Mock device info response
 */
const MOCK_DEVICE_INFO = {
    model_name: "GW5000-EH",
    serial_number: "95027EST123A0001",
    firmware: "V2.01",
    arm_firmware: "V2.01",
    dsp1_version: "V1.14",
    dsp2_version: "V1.14",
    rated_power: 5000,
    ac_output_type: 0
};

const mockReadDeviceInfo = jest.fn().mockResolvedValue(MOCK_DEVICE_INFO);
const mockReadRuntimeData = jest.fn().mockResolvedValue({});
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock("../lib/protocol.js", () => ({
    ProtocolHandler: jest.fn().mockImplementation(() => ({
        readDeviceInfo: mockReadDeviceInfo,
        readRuntimeData: mockReadRuntimeData,
        disconnect: mockDisconnect,
        on: jest.fn()
    }))
}));

// Must require after jest.mock
const infoNode = require("../nodes/info.js");

describe("GoodWe Info Node", function () {

    beforeEach(function (done) {
        mockReadDeviceInfo.mockClear();
        mockReadDeviceInfo.mockResolvedValue(MOCK_DEVICE_INFO);
        mockDisconnect.mockClear();
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    function createInfoFlow(config = {}) {
        const nodeId = config.id || "n1";
        const configId = config.configId || "c1";
        const helperId = config.helperId || "n2";

        return [
            {
                id: configId,
                type: "goodwe-config",
                name: "test config",
                host: config.host || "192.168.1.100",
                port: config.port || 8899,
                protocol: config.protocol || "udp",
                family: config.family || "ET"
            },
            {
                id: nodeId,
                type: "goodwe-info",
                name: config.name || "test info",
                config: configId,
                wires: [[helperId]]
            },
            { id: helperId, type: "helper" }
        ];
    }

    describe("Node Creation", function () {

        it("should be loaded", function (done) {
            const flow = createInfoFlow();

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1).toBeDefined();
                    expect(n1.name).toBe("test info");
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
                    type: "goodwe-info",
                    name: "test info"
                    // No config node
                }
            ];

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1).toBeDefined();
                    done();
                } catch (err) {
                    done(err);
                }
            });
        });
    });

    describe("Device Info Retrieval", function () {

        it("should return device info on trigger", function (done) {
            const flow = createInfoFlow();

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload).toBeDefined();
                        expect(msg.payload.model_name).toBe("GW5000-EH");
                        expect(msg.payload.serial_number).toBe("95027EST123A0001");
                        expect(msg.payload.firmware).toBe("V2.01");
                        expect(msg.payload.arm_firmware).toBe("V2.01");
                        expect(msg.payload.dsp1_version).toBe("V1.14");
                        expect(msg.payload.dsp2_version).toBe("V1.14");
                        expect(msg.payload.rated_power).toBe(5000);
                        expect(msg.payload.ac_output_type).toBe(0);
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });

        it("should include family from config", function (done) {
            const flow = createInfoFlow({ family: "DT" });

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.payload.family).toBe("DT");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });

        it("should set correct topic", function (done) {
            const flow = createInfoFlow();

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.topic).toBe("goodwe/device_info");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true });
            });
        });

        it("should include metadata", function (done) {
            const flow = createInfoFlow();

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
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
            const flow = createInfoFlow();

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");

                n2.on("input", function (msg) {
                    try {
                        expect(msg.customProp).toBe("test");
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                n1.receive({ payload: true, customProp: "test" });
            });
        });
    });

    describe("Error Handling", function () {

        it("should handle read errors gracefully", function (done) {
            mockReadDeviceInfo.mockRejectedValueOnce(new Error("Connection timeout"));
            const flow = createInfoFlow();

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");

                n1.receive({ payload: true });

                setTimeout(() => {
                    done();
                }, 100);
            });
        });

        it("should handle invalid host gracefully", function (done) {
            const flow = createInfoFlow({ host: "" });

            helper.load([configNode, infoNode], flow, function () {
                const n1 = helper.getNode("n1");

                n1.receive({ payload: true });

                setTimeout(() => {
                    done();
                }, 100);
            });
        });
    });
});
