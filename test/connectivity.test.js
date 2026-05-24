/**
 * Tests for GoodWe Protocol Handler and Connectivity
 * 
 * These tests verify the core connectivity features including UDP/TCP protocols,
 * connection management, error handling, and retry logic.
 */

const { ProtocolHandler, parseDeviceInfo } = require("../lib/protocol.js");

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
                throw new Error("Should have thrown error");
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
                throw new Error("Should have thrown error");
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
                throw new Error("Should have timed out");
            } catch (err) {
                // May get TIMEOUT or EPERM depending on environment
                expect(["TIMEOUT", "EPERM"]).toContain(err.code);
            }

            await handler.disconnect();
        });

        it("should serialize concurrent sendCommand() calls (no overlap)", async () => {
            // Regression for #56: when multiple worker nodes share a handler,
            // concurrent sendCommand() calls must run one at a time so UDP/TCP
            // responses are not interleaved on the shared socket listener.
            const handler = new ProtocolHandler({ protocol: "udp" });

            const callLog = [];
            let active = 0;
            let maxConcurrent = 0;

            // Replace the inner impl with a controllable stub. The queue logic
            // is in sendCommand(); we exercise it directly without sockets.
            handler._sendCommandImpl = async (cmd) => {
                const id = cmd[0];
                callLog.push(`start:${id}`);
                active++;
                maxConcurrent = Math.max(maxConcurrent, active);
                // Yield several ticks so any racing caller would overlap.
                await new Promise(r => setTimeout(r, 10));
                active--;
                callLog.push(`end:${id}`);
                return Buffer.from([id]);
            };

            const results = await Promise.all([
                handler.sendCommand(Buffer.from([1])),
                handler.sendCommand(Buffer.from([2])),
                handler.sendCommand(Buffer.from([3]))
            ]);

            expect(maxConcurrent).toBe(1);
            expect(callLog).toEqual([
                "start:1", "end:1",
                "start:2", "end:2",
                "start:3", "end:3"
            ]);
            expect(results.map(b => b[0])).toEqual([1, 2, 3]);
        });

        it("rejects fast when UDP socket emits 'error' mid-request (#58)", async () => {
            const EventEmitter = require("events");
            const handler = new ProtocolHandler({ protocol: "udp", timeout: 5000 });
            const fake = new EventEmitter();
            fake.send = () => { /* never invokes callback */ };
            handler.socket = fake;

            const pending = handler.sendCommand(Buffer.from([0x01]));
            // Defer the error emit a tick so the request-scoped listener is
            // attached first.
            setImmediate(() => {
                const e = new Error("ENETUNREACH");
                e.code = "ENETUNREACH";
                fake.emit("error", e);
            });

            await expect(pending).rejects.toThrow("ENETUNREACH");
            expect(handler.consecutiveFailures).toBeGreaterThan(0);
            // Long-lived listeners (if any) plus the constructor's default
            // no-op should remain.
            expect(fake.listenerCount("error")).toBe(0);
        });

        it("enforces absolute deadline even when bytes trickle in (#59)", async () => {
            // Regression: previously, every chunk reset the timeout to a 100ms
            // idle timer, so a peer that dribbled bytes every ~90ms could hold
            // the request open past config.timeout indefinitely.
            const EventEmitter = require("events");
            const handler = new ProtocolHandler({
                protocol: "tcp",
                // Short absolute deadline; drip bytes slower than that but
                // faster than IDLE_BYTES_TIMEOUT_MS (100ms) to exercise the bug.
                timeout: 250
            });
            const fake = new EventEmitter();
            fake.write = () => {};
            handler.socket = fake;

            const pending = handler.sendCommand(Buffer.from([0x01])); // no expectedLength

            // Drip bytes at 70ms intervals — under the 100ms idle window so
            // the old code would never have settled via idle either. With the
            // fix, the 250ms absolute deadline still wins.
            const dripHandles = [];
            for (const delay of [70, 140, 210, 280, 350, 420]) {
                dripHandles.push(setTimeout(() => fake.emit("data", Buffer.from([0xAA])), delay));
            }
            // Ensure every scheduled drip is cancelled once the promise settles
            // so it cannot leak into the next test.
            pending.catch(() => {}).finally(() => dripHandles.forEach(clearTimeout));

            const start = Date.now();
            await expect(pending).rejects.toThrow(/timeout/i);
            // Belt-and-suspenders: clear synchronously after the promise settles.
            dripHandles.forEach(clearTimeout);

            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(1000);
            expect(elapsed).toBeGreaterThanOrEqual(200);
        });

        it("rejects fast when TCP socket emits 'close' mid-request (#58)", async () => {
            const EventEmitter = require("events");
            const handler = new ProtocolHandler({ protocol: "tcp", timeout: 5000 });
            const fake = new EventEmitter();
            fake.write = () => { /* never delivers data */ };
            handler.socket = fake;

            const pending = handler.sendCommand(Buffer.from([0x01]));
            setImmediate(() => fake.emit("close"));

            await expect(pending).rejects.toThrow(/closed during request/);
            expect(fake.listenerCount("data")).toBe(0);
            expect(fake.listenerCount("close")).toBe(0);
            expect(fake.listenerCount("error")).toBe(0);
        });

        it("does not crash when 'error' is emitted with no user listener (#58)", () => {
            const handler = new ProtocolHandler();
            // No external listener attached. Emit should not throw — the
            // constructor installed a default no-op consumer.
            expect(() => handler.emit("error", new Error("transient"))).not.toThrow();
        });

        it("should continue serving subsequent calls after one rejects", async () => {
            // Failures must not poison the queue.
            const handler = new ProtocolHandler({ protocol: "udp" });

            let calls = 0;
            handler._sendCommandImpl = async () => {
                calls++;
                if (calls === 1) throw new Error("simulated failure");
                return Buffer.from([calls]);
            };

            const first = handler.sendCommand(Buffer.from([0]));
            const second = handler.sendCommand(Buffer.from([0]));

            await expect(first).rejects.toThrow("simulated failure");
            await expect(second).resolves.toEqual(Buffer.from([2]));
        });
    });

    describe("sendCommandWithRetry", () => {
        it("makes at least one attempt even with retries=0 (#62)", async () => {
            // Regression: retries=0 previously made the for-loop body never
            // run, returning undefined. The caller's downstream parser then
            // crashed on "Cannot read properties of undefined". Now: a single
            // attempt is always made; failures throw the actual error.
            const handler = new ProtocolHandler({ protocol: "udp", retries: 0 });
            let calls = 0;
            handler._sendCommandImpl = async () => {
                calls++;
                throw new Error("inner failure");
            };
            await expect(handler.sendCommandWithRetry(Buffer.from([0x00])))
                .rejects.toThrow("inner failure");
            expect(calls).toBe(1);
        });

        it("coerces non-numeric retries to a safe floor (#62)", async () => {
            const handler = new ProtocolHandler({ protocol: "udp", retries: "abc" });
            let calls = 0;
            handler._sendCommandImpl = async () => {
                calls++;
                throw new Error("inner failure");
            };
            await expect(handler.sendCommandWithRetry(Buffer.from([0x00])))
                .rejects.toThrow("inner failure");
            expect(calls).toBe(1);
        });

        it("honors numeric string retries (#62)", async () => {
            const handler = new ProtocolHandler({ protocol: "udp", retries: "2" });
            let calls = 0;
            handler._sendCommandImpl = async () => {
                calls++;
                throw new Error("inner failure");
            };
            await expect(handler.sendCommandWithRetry(Buffer.from([0x00])))
                .rejects.toThrow("inner failure");
            expect(calls).toBe(2);
        });

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
                throw new Error("Should have failed after retries");
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
            
            handler.on("error", (err) => {
                expect(err).toBeDefined();
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
                throw new Error("Should have timed out");
            } catch (err) {
                expect(err.message).toContain("timeout");
            }
        }, 5000);
    });

    describe("sendCommandWithRetry success scenarios", () => {
        it("should return response on successful first attempt", async () => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                timeout: 100
            });
            
            await handler.connect();
            
            // Mock a successful response by immediately resolving
            const originalSendCommand = handler.sendCommand.bind(handler);
            handler.sendCommand = jest.fn().mockResolvedValue(Buffer.from([0x01, 0x02]));
            
            const result = await handler.sendCommandWithRetry(Buffer.from([0x00]));
            expect(result).toEqual(Buffer.from([0x01, 0x02]));
            expect(handler.sendCommand).toHaveBeenCalledTimes(1);
            
            handler.sendCommand = originalSendCommand;
            await handler.disconnect();
        });

        it("should succeed after retry", async () => {
            const handler = new ProtocolHandler({ 
                protocol: "udp",
                timeout: 100,
                retries: 3
            });
            
            await handler.connect();
            
            let attemptCount = 0;
            handler.sendCommand = jest.fn().mockImplementation(() => {
                attemptCount++;
                if (attemptCount < 2) {
                    return Promise.reject(new Error("Temporary failure"));
                }
                return Promise.resolve(Buffer.from([0x01, 0x02]));
            });
            
            const result = await handler.sendCommandWithRetry(Buffer.from([0x00]));
            expect(result).toEqual(Buffer.from([0x01, 0x02]));
            expect(attemptCount).toBe(2);
            
            await handler.disconnect();
        });
    });
});

describe("discovery helper functions", () => {
    const { discoverInverters } = require("../lib/protocol.js");

    it("should handle discovery timeout", async () => {
        try {
            const result = await discoverInverters({ timeout: 100 });
            // Should return empty array or error depending on environment
            expect(Array.isArray(result) || result === undefined).toBe(true);
        } catch (err) {
            // EPERM or other error is acceptable in test environment
            expect(err).toBeDefined();
        }
    });

    it("should not throw 'Not running' when send fails before bind completes", async () => {
        // Regression: lib/protocol.js cleanup() previously called socket.close()
        // unconditionally. On Node 24+, dgram.close() throws "Not running" when
        // called on an unbound socket — which happens when send() errors out
        // (e.g. DNS resolution failure on an invalid broadcast address) before
        // bind() finishes. The cleanup should be idempotent and tolerate an
        // already-closed or never-bound socket.
        let caught;
        try {
            await discoverInverters({
                timeout: 100,
                broadcastAddress: "invalid"
            });
        } catch (err) {
            caught = err;
        }
        // The promise must settle one way or the other — what we explicitly do
        // NOT want is the process crashing on an uncaught "Not running" throw.
        if (caught) {
            expect(caught.message).not.toContain("Not running");
        }
    });

    describe("source-IP filtering (#61)", () => {
        const { isLocalSubnet, ipv4ToInt } = require("../lib/protocol.js");

        it("ipv4ToInt parses valid dotted-quad addresses", () => {
            expect(ipv4ToInt("0.0.0.0")).toBe(0);
            expect(ipv4ToInt("127.0.0.1")).toBe(0x7F000001);
            expect(ipv4ToInt("192.168.1.100")).toBe(0xC0A80164);
            expect(ipv4ToInt("255.255.255.255")).toBe(0xFFFFFFFF >>> 0);
        });

        it("ipv4ToInt rejects malformed input", () => {
            expect(ipv4ToInt("")).toBeNull();
            expect(ipv4ToInt("not-an-ip")).toBeNull();
            expect(ipv4ToInt("1.2.3")).toBeNull();
            expect(ipv4ToInt("1.2.3.4.5")).toBeNull();
            expect(ipv4ToInt("256.0.0.1")).toBeNull();
            expect(ipv4ToInt("-1.0.0.0")).toBeNull();
            expect(ipv4ToInt("1.2.3.4 ")).toBeNull(); // trailing space → NaN per part
            expect(ipv4ToInt(null)).toBeNull();
            expect(ipv4ToInt(undefined)).toBeNull();
        });

        it("isLocalSubnet accepts loopback addresses", () => {
            expect(isLocalSubnet("127.0.0.1")).toBe(true);
            expect(isLocalSubnet("127.255.255.254")).toBe(true);
        });

        it("isLocalSubnet rejects clearly remote addresses", () => {
            // These are public IPs unlikely to be in any test host's local
            // subnet. Anchored by RFC 6890 / IANA allocations.
            expect(isLocalSubnet("8.8.8.8")).toBe(false);
            expect(isLocalSubnet("1.1.1.1")).toBe(false);
        });

        it("isLocalSubnet returns false for malformed input (fail-closed)", () => {
            expect(isLocalSubnet("")).toBe(false);
            expect(isLocalSubnet("not-an-ip")).toBe(false);
            expect(isLocalSubnet(null)).toBe(false);
        });
    });

    it("should parse device info from AA55 payload", () => {
        // Build a mock device info payload
        const payload = Buffer.alloc(53);
        // Model name (bytes 0-9)
        payload.write("GW5000-EH\0", 0, 10, "ascii");
        // Serial number (bytes 10-25)
        payload.write("95027EST123A0001", 10, 16, "ascii");
        // Firmware (bytes 26-31)
        payload.write("V2.01\0", 26, 6, "ascii");
        // ARM firmware (bytes 32-37)
        payload.write("V2.01\0", 32, 6, "ascii");
        // DSP1 version (bytes 38-43)
        payload.write("V1.14\0", 38, 6, "ascii");
        // DSP2 version (bytes 44-49)
        payload.write("V1.14\0", 44, 6, "ascii");
        // Rated power (bytes 50-51): 5000W
        payload.writeUInt16BE(5000, 50);
        // AC output type (byte 52): single phase
        payload.writeUInt8(0, 52);

        const info = parseDeviceInfo(payload);
        expect(info.model_name).toBe("GW5000-EH");
        expect(info.serial_number).toBe("95027EST123A0001");
        expect(info.firmware).toBe("V2.01");
        expect(info.arm_firmware).toBe("V2.01");
        expect(info.dsp1_version).toBe("V1.14");
        expect(info.dsp2_version).toBe("V1.14");
        expect(info.rated_power).toBe(5000);
        expect(info.ac_output_type).toBe(0);
    });

    it("should handle short device info payloads gracefully", () => {
        // Only model name available
        const payload = Buffer.alloc(10);
        payload.write("GW3000-DT\0", 0, 10, "ascii");

        const info = parseDeviceInfo(payload);
        expect(info.model_name).toBe("GW3000-DT");
        expect(info.serial_number).toBeUndefined();
        expect(info.firmware).toBeUndefined();
    });

    it("should handle empty device info payload", () => {
        const payload = Buffer.alloc(0);
        const info = parseDeviceInfo(payload);
        expect(info.model_name).toBeUndefined();
    });

    it("should parse discovery responses", async () => {
        // Test that discovery can handle AA55 responses
        // This will attempt to broadcast and parse any responses
        try {
            const result = await discoverInverters({ timeout: 200 });
            if (Array.isArray(result)) {
                result.forEach(inv => {
                    expect(inv).toHaveProperty("ip");
                    expect(inv).toHaveProperty("port");
                    expect(inv).toHaveProperty("family");
                });
            }
        } catch (err) {
            // Expected in restricted environments
            expect(err).toBeDefined();
        }
    });
});
