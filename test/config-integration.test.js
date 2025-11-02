/**
 * Tests for GoodWe Node with Config Node Integration
 * 
 * These tests verify the goodwe node can use both inline configuration
 * and shared configuration nodes.
 */

const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe.js");
const configNode = require("../nodes/config.js");

helper.init(require.resolve("node-red"));

describe("goodwe node with config node", () => {
    
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    describe("using shared config node", () => {
        it("should load and use config from config node", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    name: "Test Config",
                    host: "192.168.1.100",
                    port: 8899,
                    protocol: "udp",
                    family: "ET",
                    timeout: 2000,
                    retries: 5
                },
                { 
                    id: "n1", 
                    type: "goodwe",
                    name: "test node",
                    config: "c1"
                }
            ];
            
            helper.load([configNode, goodweNode], flow, () => {
                const n1 = helper.getNode("n1");
                const c1 = helper.getNode("c1");
                
                try {
                    expect(n1).toBeDefined();
                    expect(c1).toBeDefined();
                    expect(n1.host).toBe("192.168.1.100");
                    expect(n1.port).toBe(8899);
                    expect(n1.protocol).toBe("udp");
                    expect(n1.family).toBe("ET");
                    expect(n1.timeout).toBe(2000);
                    expect(n1.retries).toBe(5);
                    expect(n1.configNode).toBe(c1);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should work with modbus protocol from config node", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.101",
                    port: 502,
                    protocol: "modbus",
                    family: "DT"
                },
                { 
                    id: "n1", 
                    type: "goodwe",
                    config: "c1"
                }
            ];
            
            helper.load([configNode, goodweNode], flow, () => {
                const n1 = helper.getNode("n1");
                
                try {
                    expect(n1.host).toBe("192.168.1.101");
                    expect(n1.port).toBe(502);
                    expect(n1.protocol).toBe("modbus");
                    expect(n1.family).toBe("DT");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should handle missing config node gracefully", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe",
                    config: "invalid-config-id"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                
                try {
                    expect(n1).toBeDefined();
                    // Node should show error status when config is missing
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("using inline configuration", () => {
        it("should work with inline configuration", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe",
                    host: "192.168.1.100",
                    port: 8899,
                    protocol: "udp",
                    family: "ET"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                
                try {
                    expect(n1.host).toBe("192.168.1.100");
                    expect(n1.port).toBe(8899);
                    expect(n1.protocol).toBe("udp");
                    expect(n1.family).toBe("ET");
                    expect(n1.configNode).toBeNull();
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should use default timeout and retries for inline config", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe",
                    host: "192.168.1.100"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                
                try {
                    expect(n1.timeout).toBe(1000);
                    expect(n1.retries).toBe(3);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("multiple nodes sharing config", () => {
        it("should allow multiple goodwe nodes to share one config", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    name: "Shared Config",
                    host: "192.168.1.100",
                    port: 8899,
                    protocol: "udp",
                    family: "ET"
                },
                { 
                    id: "n1", 
                    type: "goodwe",
                    name: "node 1",
                    config: "c1"
                },
                { 
                    id: "n2", 
                    type: "goodwe",
                    name: "node 2",
                    config: "c1"
                }
            ];
            
            helper.load([configNode, goodweNode], flow, () => {
                const n1 = helper.getNode("n1");
                const n2 = helper.getNode("n2");
                const c1 = helper.getNode("c1");
                
                try {
                    expect(n1.configNode).toBe(c1);
                    expect(n2.configNode).toBe(c1);
                    expect(n1.host).toBe("192.168.1.100");
                    expect(n2.host).toBe("192.168.1.100");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("backward compatibility", () => {
        it("should maintain backward compatibility with existing flows", (done) => {
            const flow = [
                { 
                    id: "n1", 
                    type: "goodwe",
                    name: "Legacy Node",
                    host: "192.168.1.100",
                    port: 8899,
                    protocol: "udp",
                    family: "ET"
                }
            ];
            
            helper.load(goodweNode, flow, () => {
                const n1 = helper.getNode("n1");
                
                try {
                    expect(n1).toBeDefined();
                    expect(n1.name).toBe("Legacy Node");
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
