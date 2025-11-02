/**
 * Tests for GoodWe Config Node
 */

const helper = require("node-red-node-test-helper");
const configNode = require("../nodes/config.js");

helper.init(require.resolve("node-red"));

describe("GoodWe Config Node", function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it("should be loaded with default configuration", function (done) {
        const flow = [
            { id: "c1", type: "goodwe-config", name: "test config", host: "192.168.1.100" }
        ];

        helper.load(configNode, flow, function () {
            const c1 = helper.getNode("c1");
            expect(c1).toBeDefined();
            expect(c1.host).toBe("192.168.1.100");
            expect(c1.port).toBe(8899);
            expect(c1.protocol).toBe("udp");
            expect(c1.family).toBe("ET");
            expect(c1.timeout).toBe(1000);
            expect(c1.retries).toBe(3);
            expect(c1.keepAlive).toBe(true);
            done();
        });
    });

    it("should accept custom configuration", function (done) {
        const flow = [
            { 
                id: "c1", 
                type: "goodwe-config", 
                name: "custom config",
                host: "10.0.0.50",
                port: 502,
                protocol: "modbus",
                family: "ES",
                timeout: 2000,
                retries: 5,
                keepAlive: false
            }
        ];

        helper.load(configNode, flow, function () {
            const c1 = helper.getNode("c1");
            expect(c1.host).toBe("10.0.0.50");
            expect(c1.port).toBe(502);
            expect(c1.protocol).toBe("modbus");
            expect(c1.family).toBe("ES");
            expect(c1.timeout).toBe(2000);
            expect(c1.retries).toBe(5);
            expect(c1.keepAlive).toBe(false);
            done();
        });
    });
});
