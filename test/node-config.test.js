/**
 * Tests for GoodWe Node Configuration
 * 
 * These tests verify the node configuration UI, validation,
 * and property handling according to the NODE_DESIGN.md specification.
 */

const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe-legacy.js");

helper.init(require.resolve("node-red"));

describe("goodwe node configuration", () => {
    
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    describe("default configuration", () => {
        it("should load with default values", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy", 
                    name: "test"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1).toBeDefined();
                    expect(n1.name).toBe("test");
                    expect(n1.port).toBe(8899); // Default UDP port
                    expect(n1.protocol).toBe("udp"); // Default protocol
                    expect(n1.family).toBe("ET"); // Default family
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("host configuration", () => {
        it("should accept valid IP address", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.host).toBe("192.168.1.100");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept valid hostname", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "inverter.local"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.host).toBe("inverter.local");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept FQDN hostname", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "goodwe.home.arpa"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.host).toBe("goodwe.home.arpa");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("port configuration", () => {
        it("should accept valid port number", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    port: 8899
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.port).toBe(8899);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept Modbus TCP port", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    port: 502
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.port).toBe(502);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("protocol configuration", () => {
        it("should accept UDP protocol", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    protocol: "udp"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.protocol).toBe("udp");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept Modbus protocol", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    host: "192.168.1.100",
                    protocol: "modbus"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.protocol).toBe("modbus");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("family configuration", () => {
        const families = ["ET", "EH", "BT", "BH", "ES", "EM", "BP", "DT", "MS", "D-NS", "XS"];
        
        families.forEach(family => {
            it(`should accept ${family} family`, (done) => {
                const flow = [
                    { 
                        id: "n1", 
                        type: "goodwe-legacy",
                        host: "192.168.1.100",
                        family: family
                    }
                ];
                
                helper.load(goodweNode, flow, () => {
                    const n1 = helper.getNode("n1");
                    try {
                        expect(n1.family).toBe(family);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
            });
        });
    });

    describe("complete configuration", () => {
        it("should accept all configuration options", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe-legacy",
                    name: "Living Room Inverter",
                    host: "192.168.1.100",
                    port: 8899,
                    protocol: "udp",
                    family: "ET"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                try {
                    expect(n1.name).toBe("Living Room Inverter");
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
    });
});
