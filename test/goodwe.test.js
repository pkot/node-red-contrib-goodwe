/**
 * Tests for the GoodWe Node-RED node
 */

const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe.js");

helper.init(require.resolve("node-red"));

describe("goodwe node", function () {
    
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it("should be loaded", function (done) {
        const flow = [{ id: "n1", type: "goodwe", name: "test goodwe" }];
        helper.load(goodweNode, flow, function () {
            const n1 = helper.getNode("n1");
            try {
                expect(n1).toBeDefined();
                expect(n1.name).toBe("test goodwe");
                done();
            } catch(err) {
                done(err);
            }
        });
    });

    it("should have default configuration", function (done) {
        const flow = [
            { 
                id: "n1", 
                type: "goodwe", 
                name: "test goodwe",
                host: "192.168.1.100",
                port: 8899,
                protocol: "udp",
                family: "ET"
            }
        ];
        helper.load(goodweNode, flow, function () {
            const n1 = helper.getNode("n1");
            try {
                expect(n1).toBeDefined();
                expect(n1.host).toBe("192.168.1.100");
                expect(n1.port).toBe(8899);
                expect(n1.protocol).toBe("udp");
                expect(n1.family).toBe("ET");
                done();
            } catch(err) {
                done(err);
            }
        });
    });

    it("should handle input messages", function (done) {
        const flow = [
            { id: "n1", type: "goodwe", name: "test goodwe", host: "192.168.1.100", wires:[["n2"]] },
            { id: "n2", type: "helper" }
        ];
        helper.load(goodweNode, flow, function () {
            const n2 = helper.getNode("n2");
            const n1 = helper.getNode("n1");
            n2.on("input", function (msg) {
                try {
                    expect(msg.payload).toBeDefined();
                    expect(msg.payload.success).toBe(true);
                    expect(msg.payload.data).toBeDefined();
                    // Data should now contain runtime sensor data
                    expect(msg.payload.data.vpv1).toBeDefined();
                    expect(msg.payload.data.pac).toBeDefined();
                    done();
                } catch(err) {
                    done(err);
                }
            });
            n1.receive({ payload: "test" });
        });
    });
});
