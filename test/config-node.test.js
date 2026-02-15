/**
 * Tests for GoodWe Configuration Node
 * 
 * These tests verify the configuration node functionality, validation,
 * and property handling according to the design specification.
 */

const helper = require("node-red-node-test-helper");
const configNode = require("../nodes/config.js");

helper.init(require.resolve("node-red"));

describe("goodwe-config node", () => {
    
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
                    id: "c1", 
                    type: "goodwe-config", 
                    name: "test config",
                    host: "192.168.1.100"
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1).toBeDefined();
                    expect(c1.name).toBe("test config");
                    expect(c1.host).toBe("192.168.1.100");
                    expect(c1.port).toBe(8899); // Default UDP port
                    expect(c1.protocol).toBe("udp"); // Default protocol
                    expect(c1.family).toBe("ET"); // Default family
                    expect(c1.timeout).toBe(1000); // Default timeout
                    expect(c1.retries).toBe(3); // Default retries
                    expect(c1.commAddr).toBe("auto"); // Default comm address
                    expect(c1.keepAlive).toBe(true); // Default keep alive
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should have getConfig method", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100"
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.getConfig).toBeDefined();
                    expect(typeof c1.getConfig).toBe("function");
                    
                    const config = c1.getConfig();
                    expect(config.host).toBe("192.168.1.100");
                    expect(config.port).toBe(8899);
                    expect(config.protocol).toBe("udp");
                    expect(config.family).toBe("ET");
                    expect(config.timeout).toBe(1000);
                    expect(config.retries).toBe(3);
                    expect(config.commAddr).toBe("auto");
                    expect(config.keepAlive).toBe(true);
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
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100"
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.host).toBe("192.168.1.100");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept valid hostname", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "inverter.local"
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.host).toBe("inverter.local");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept FQDN hostname", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "goodwe.home.arpa"
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.host).toBe("goodwe.home.arpa");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("port configuration", () => {
        it("should accept default UDP port", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    port: 8899
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.port).toBe(8899);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept Modbus TCP port", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    protocol: "modbus",
                    port: 502
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.port).toBe(502);
                    expect(c1.protocol).toBe("modbus");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept custom port", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    port: 12345
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.port).toBe(12345);
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
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    protocol: "udp"
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.protocol).toBe("udp");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept Modbus protocol", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    protocol: "modbus"
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.protocol).toBe("modbus");
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
                        id: "c1", 
                        type: "goodwe-config",
                        host: "192.168.1.100",
                        family: family
                    }
                ];
                
                helper.load(configNode, flow, () => {
                    const c1 = helper.getNode("c1");
                    try {
                        expect(c1.family).toBe(family);
                        done();
                    } catch(err) {
                        done(err);
                    }
                });
            });
        });
    });

    describe("advanced configuration", () => {
        it("should accept custom timeout", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    timeout: 2000
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.timeout).toBe(2000);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept custom retries", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    retries: 5
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.retries).toBe(5);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept custom comm address", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    commAddr: "0xF7"
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.commAddr).toBe("0xF7");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should accept keepAlive setting", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    host: "192.168.1.100",
                    keepAlive: false
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.keepAlive).toBe(false);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("complete configuration", () => {
        it("should accept all configuration options", (done) => {
            const flow = [
                { 
                    id: "c1", 
                    type: "goodwe-config",
                    name: "Living Room Inverter",
                    host: "192.168.1.100",
                    port: 8899,
                    protocol: "udp",
                    family: "ET",
                    timeout: 2000,
                    retries: 5,
                    commAddr: "0xF7",
                    keepAlive: true
                }
            ];
            
            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.name).toBe("Living Room Inverter");
                    expect(c1.host).toBe("192.168.1.100");
                    expect(c1.port).toBe(8899);
                    expect(c1.protocol).toBe("udp");
                    expect(c1.family).toBe("ET");
                    expect(c1.timeout).toBe(2000);
                    expect(c1.retries).toBe(5);
                    expect(c1.commAddr).toBe("0xF7");
                    expect(c1.keepAlive).toBe(true);
                    
                    const config = c1.getConfig();
                    expect(config).toEqual({
                        host: "192.168.1.100",
                        port: 8899,
                        protocol: "udp",
                        family: "ET",
                        timeout: 2000,
                        retries: 5,
                        commAddr: "0xF7",
                        keepAlive: true
                    });
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });
    });

    describe("connection management", () => {
        it("should initialize with no protocol handler", (done) => {
            const flow = [
                {
                    id: "c1",
                    type: "goodwe-config",
                    host: "192.168.1.100"
                }
            ];

            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(c1.protocolHandler).toBeNull();
                    expect(c1.users).toEqual([]);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should have getProtocolHandler method", (done) => {
            const flow = [
                {
                    id: "c1",
                    type: "goodwe-config",
                    host: "192.168.1.100"
                }
            ];

            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    expect(typeof c1.getProtocolHandler).toBe("function");
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should return same handler instance on repeated calls", (done) => {
            const flow = [
                {
                    id: "c1",
                    type: "goodwe-config",
                    host: "192.168.1.100"
                }
            ];

            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    const handler1 = c1.getProtocolHandler();
                    const handler2 = c1.getProtocolHandler();
                    expect(handler1).toBe(handler2);
                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should track registered users", (done) => {
            const flow = [
                {
                    id: "c1",
                    type: "goodwe-config",
                    host: "192.168.1.100"
                }
            ];

            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    const mockNode1 = { id: "n1" };
                    const mockNode2 = { id: "n2" };

                    c1.registerUser(mockNode1);
                    expect(c1.users.length).toBe(1);

                    c1.registerUser(mockNode2);
                    expect(c1.users.length).toBe(2);

                    c1.deregisterUser(mockNode1);
                    expect(c1.users.length).toBe(1);
                    expect(c1.users[0].id).toBe("n2");

                    c1.deregisterUser(mockNode2);
                    expect(c1.users.length).toBe(0);

                    done();
                } catch(err) {
                    done(err);
                }
            });
        });

        it("should disconnect handler on close", (done) => {
            const flow = [
                {
                    id: "c1",
                    type: "goodwe-config",
                    host: "192.168.1.100"
                }
            ];

            helper.load(configNode, flow, () => {
                const c1 = helper.getNode("c1");
                try {
                    // Create a handler
                    const handler = c1.getProtocolHandler();
                    expect(handler).toBeDefined();
                    expect(c1.protocolHandler).not.toBeNull();

                    // Close the node
                    c1.close().then(() => {
                        expect(c1.protocolHandler).toBeNull();
                        expect(c1.users).toEqual([]);
                        done();
                    });
                } catch(err) {
                    done(err);
                }
            });
        });
    });
});
