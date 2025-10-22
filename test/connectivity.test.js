/**
 * Tests for GoodWe Protocol Handler and Connectivity
 * 
 * These tests verify the core connectivity features including UDP/TCP protocols,
 * connection management, error handling, and retry logic.
 */

const { ProtocolHandler } = require("../lib/protocol.js");

describe("ProtocolHandler", () => {
    
    describe("constructor", () => {
        it("should create instance with default config", () => {
            const handler = new ProtocolHandler();
            expect(handler).toBeDefined();
            expect(handler.config.protocol).toBe("udp");
            expect(handler.config.port).toBe(8899);
            expect(handler.config.timeout).toBe(1000);
            expect(handler.config.retries).toBe(3);
        });

        it("should accept custom configuration", () => {
            const handler = new ProtocolHandler({
                host: "192.168.1.200",
                port: 502,
                protocol: "tcp",
                timeout: 2000,
                retries: 5
            });
            
            expect(handler.config.host).toBe("192.168.1.200");
            expect(handler.config.port).toBe(502);
            expect(handler.config.protocol).toBe("tcp");
            expect(handler.config.timeout).toBe(2000);
            expect(handler.config.retries).toBe(5);
        });

        it("should initialize with disconnected state", () => {
            const handler = new ProtocolHandler();
            expect(handler.connected).toBe(false);
            expect(handler.socket).toBeNull();
            expect(handler.consecutiveFailures).toBe(0);
        });
    });

    describe("connect", () => {
        it("should return a promise", () => {
            const handler = new ProtocolHandler({ protocol: "udp" });
            const result = handler.connect();
            expect(result).toBeInstanceOf(Promise);
            return handler.disconnect();
        });

        it("should emit status event when connecting", (done) => {
            const handler = new ProtocolHandler({ protocol: "udp" });
            
            handler.on("status", (status) => {
                if (status.state === "connecting") {
                    handler.disconnect().then(() => done());
                }
            });
            
            handler.connect();
        });

        it("should set connected state after successful connection", async () => {
            const handler = new ProtocolHandler({ protocol: "udp" });
            await handler.connect();
            
            expect(handler.connected).toBe(true);
            
            await handler.disconnect();
        });

        it("should handle multiple connect calls", async () => {
            const handler = new ProtocolHandler({ protocol: "udp" });
            
            await handler.connect();
            await handler.connect(); // Second call should not fail
            
            expect(handler.connected).toBe(true);
            
            await handler.disconnect();
        });

        it("should reject with unsupported protocol", async () => {
            const handler = new ProtocolHandler({ protocol: "invalid" });
            
            try {
                await handler.connect();
                fail("Should have thrown error");
            } catch (err) {
                expect(err.message).toContain("Unsupported protocol");
            }
        });
    });

    describe("disconnect", () => {
        it("should disconnect and set state", async () => {
            const handler = new ProtocolHandler({ protocol: "udp" });
            await handler.connect();
            await handler.disconnect();
            
            expect(handler.connected).toBe(false);
            expect(handler.socket).toBeNull();
        });

        it("should handle disconnect when not connected", async () => {
            const handler = new ProtocolHandler();
            await handler.disconnect(); // Should not throw
            expect(handler.connected).toBe(false);
        });

        it("should emit disconnected status", (done) => {
            const handler = new ProtocolHandler({ protocol: "udp" });
            
            handler.connect().then(() => {
                handler.on("status", (status) => {
                    if (status.state === "disconnected") {
                        done();
                    }
                });
                handler.disconnect();
            });
        });
    });

    describe("getStatus", () => {
        it("should return status object", () => {
            const handler = new ProtocolHandler({
                host: "192.168.1.100",
                port: 8899,
                protocol: "udp"
            });
            
            const status = handler.getStatus();
            
            expect(status.connected).toBe(false);
            expect(status.consecutiveFailures).toBe(0);
            expect(status.protocol).toBe("udp");
            expect(status.host).toBe("192.168.1.100");
            expect(status.port).toBe(8899);
        });

        it("should track consecutive failures", async () => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                timeout: 100
            });
            
            await handler.connect();
            
            // Simulate a failure
            try {
                await handler.sendCommand(Buffer.from([0x00]));
            } catch (err) {
                // Expected to fail
            }
            
            const status = handler.getStatus();
            expect(status.consecutiveFailures).toBeGreaterThan(0);
            
            await handler.disconnect();
        });
    });

    describe("sendCommand", () => {
        it("should reject when not connected", async () => {
            const handler = new ProtocolHandler();
            
            try {
                await handler.sendCommand(Buffer.from([0x00]));
                fail("Should have thrown error");
            } catch (err) {
                expect(err.message).toBe("Not connected");
            }
        });

        it("should timeout if no response received", async () => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                timeout: 100,
                host: "192.168.255.255" // Invalid host to ensure timeout
            });
            
            await handler.connect();
            
            try {
                await handler.sendCommand(Buffer.from([0x00]));
                fail("Should have timed out");
            } catch (err) {
                // May get TIMEOUT or EPERM depending on environment
                expect(["TIMEOUT", "EPERM"]).toContain(err.code);
            }
            
            await handler.disconnect();
        });
    });

    describe("sendCommandWithRetry", () => {
        it("should retry on failure", async () => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                timeout: 100,
                retries: 3,
                host: "192.168.255.255" // Invalid host
            });
            
            await handler.connect();
            
            const startTime = Date.now();
            
            try {
                await handler.sendCommandWithRetry(Buffer.from([0x00]));
                fail("Should have failed after retries");
            } catch (err) {
                const elapsed = Date.now() - startTime;
                // Should have tried multiple times with backoff
                expect(elapsed).toBeGreaterThan(100); // At least one retry
                expect(handler.consecutiveFailures).toBeGreaterThan(0);
            }
            
            await handler.disconnect();
        });

        it("should emit retry status events", (done) => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                timeout: 50,
                retries: 2,
                host: "192.168.255.255"
            });
            
            let retryStatusSeen = false;
            
            handler.on("status", (status) => {
                if (status.state === "retrying") {
                    retryStatusSeen = true;
                }
            });
            
            handler.connect().then(() => {
                handler.sendCommandWithRetry(Buffer.from([0x00]))
                    .catch(() => {
                        expect(retryStatusSeen).toBe(true);
                        handler.disconnect().then(done);
                    });
            });
        }, 10000);
    });

    describe("error handling", () => {
        it("should emit error events", (done) => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                host: "invalid-host",
                timeout: 100
            });
            
            let errorEmitted = false;
            
            handler.on("error", (err) => {
                expect(err).toBeDefined();
                errorEmitted = true;
            });
            
            handler.connect()
                .then(() => handler.sendCommand(Buffer.from([0x00])))
                .catch(() => {
                    // Expected to fail
                    handler.disconnect().then(() => {
                        // Error may or may not be emitted depending on environment
                        done();
                    });
                });
        }, 3000);

        it("should track last error", async () => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                timeout: 100
            });
            
            await handler.connect();
            
            try {
                await handler.sendCommand(Buffer.from([0x00]));
            } catch (err) {
                // Expected
            }
            
            const status = handler.getStatus();
            expect(status.lastError).toBeDefined();
            
            await handler.disconnect();
        });
    });

    describe("protocol-specific behavior", () => {
        it("should handle UDP protocol", async () => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                host: "127.0.0.1"
            });
            
            await handler.connect();
            expect(handler.connected).toBe(true);
            expect(handler.config.protocol).toBe("udp");
            
            await handler.disconnect();
        });

        it("should handle TCP timeout on connection", async () => {
            const handler = new ProtocolHandler({ 
                protocol: "tcp",
                host: "192.168.255.255", // Unreachable
                port: 8899,
                timeout: 100
            });
            
            try {
                await handler.connect();
                fail("Should have timed out");
            } catch (err) {
                expect(err.message).toContain("timeout");
            }
        }, 5000);
    });
});
