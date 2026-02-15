/**
 * Tests for enhanced error handling with suggestions
 */

const { enhanceError, inferErrorCode, SUGGESTION_GENERATORS } = require("../lib/errors");

describe("Error Enhancement", () => {

    const defaultCtx = {
        host: "192.168.1.100",
        port: 8899,
        protocol: "udp",
        family: "ET",
        timeout: 1000
    };

    describe("enhanceError", () => {

        it("should add suggestions for TIMEOUT errors", () => {
            const err = new Error("Response timeout");
            err.code = "TIMEOUT";

            enhanceError(err, defaultCtx);

            expect(err.suggestions).toBeDefined();
            expect(Array.isArray(err.suggestions)).toBe(true);
            expect(err.suggestions.length).toBeGreaterThan(0);
            expect(err.suggestions.some(s => s.includes("192.168.1.100"))).toBe(true);
            expect(err.suggestions.some(s => s.includes("1000ms"))).toBe(true);
        });

        it("should add suggestions for ECONNREFUSED errors", () => {
            const err = new Error("connect ECONNREFUSED");
            err.code = "ECONNREFUSED";

            enhanceError(err, defaultCtx);

            expect(err.suggestions).toBeDefined();
            expect(err.suggestions.some(s => s.includes("8899"))).toBe(true);
        });

        it("should add suggestions for READ_ERROR", () => {
            const err = new Error("Failed to read");
            err.code = "READ_ERROR";

            enhanceError(err, defaultCtx);

            expect(err.suggestions).toBeDefined();
            expect(err.suggestions.some(s => s.includes("ET"))).toBe(true);
        });

        it("should add suggestions for PROTOCOL_ERROR", () => {
            const err = new Error("Invalid response");
            err.code = "PROTOCOL_ERROR";

            enhanceError(err, { ...defaultCtx, protocol: "tcp" });

            expect(err.suggestions).toBeDefined();
            expect(err.suggestions.some(s => s.includes("tcp"))).toBe(true);
        });

        it("should add suggestions for UNSUPPORTED_FAMILY", () => {
            const err = new Error("Unsupported family");
            err.code = "UNSUPPORTED_FAMILY";

            enhanceError(err, { ...defaultCtx, family: "XYZ" });

            expect(err.suggestions).toBeDefined();
            expect(err.suggestions.some(s => s.includes("XYZ"))).toBe(true);
            expect(err.suggestions.some(s => s.includes("ET"))).toBe(true);
        });

        it("should add suggestions for EHOSTUNREACH", () => {
            const err = new Error("Host unreachable");
            err.code = "EHOSTUNREACH";

            enhanceError(err, defaultCtx);

            expect(err.suggestions).toBeDefined();
            expect(err.suggestions.some(s => s.includes("192.168.1.100"))).toBe(true);
        });

        it("should add suggestions for ECONNRESET", () => {
            const err = new Error("Connection reset");
            err.code = "ECONNRESET";

            enhanceError(err, defaultCtx);

            expect(err.suggestions).toBeDefined();
            expect(err.suggestions.length).toBeGreaterThan(0);
        });

        it("should add details to error", () => {
            const err = new Error("Test error");
            err.code = "TIMEOUT";

            enhanceError(err, defaultCtx);

            expect(err.details).toBeDefined();
            expect(err.details.host).toBe("192.168.1.100");
            expect(err.details.port).toBe(8899);
            expect(err.details.protocol).toBe("udp");
            expect(err.details.family).toBe("ET");
        });

        it("should provide default suggestions for unknown error codes", () => {
            const err = new Error("Something went wrong");
            err.code = "SOME_UNKNOWN_CODE";

            enhanceError(err, defaultCtx);

            expect(err.suggestions).toBeDefined();
            expect(err.suggestions.length).toBeGreaterThan(0);
        });

        it("should return the same error object", () => {
            const err = new Error("Test");
            err.code = "TIMEOUT";

            const result = enhanceError(err, defaultCtx);

            expect(result).toBe(err);
        });
    });

    describe("inferErrorCode", () => {

        it("should infer TIMEOUT from message", () => {
            expect(inferErrorCode(new Error("Response timeout"))).toBe("TIMEOUT");
            expect(inferErrorCode(new Error("Connection timeout after 5s"))).toBe("TIMEOUT");
        });

        it("should infer ECONNREFUSED from message", () => {
            expect(inferErrorCode(new Error("connect ECONNREFUSED"))).toBe("ECONNREFUSED");
            expect(inferErrorCode(new Error("Connection refused"))).toBe("ECONNREFUSED");
        });

        it("should infer ECONNRESET from message", () => {
            expect(inferErrorCode(new Error("read ECONNRESET"))).toBe("ECONNRESET");
        });

        it("should infer EHOSTUNREACH from message", () => {
            expect(inferErrorCode(new Error("EHOSTUNREACH"))).toBe("EHOSTUNREACH");
            expect(inferErrorCode(new Error("Host unreachable"))).toBe("EHOSTUNREACH");
        });

        it("should infer UNSUPPORTED_FAMILY from message", () => {
            expect(inferErrorCode(new Error("Unsupported inverter family: XYZ"))).toBe("UNSUPPORTED_FAMILY");
        });

        it("should infer PROTOCOL_ERROR from response validation messages", () => {
            expect(inferErrorCode(new Error("Invalid AA55 response"))).toBe("PROTOCOL_ERROR");
            expect(inferErrorCode(new Error("Invalid Modbus TCP response"))).toBe("PROTOCOL_ERROR");
        });

        it("should return UNKNOWN for unrecognized messages", () => {
            expect(inferErrorCode(new Error("Something else"))).toBe("UNKNOWN");
        });

        it("should infer code when error has no code set", () => {
            const err = new Error("Response timeout");
            enhanceError(err, defaultCtx);
            expect(err.code).toBe("TIMEOUT");
        });

        it("should not override existing error code", () => {
            const err = new Error("Response timeout");
            err.code = "CUSTOM_CODE";
            enhanceError(err, defaultCtx);
            expect(err.code).toBe("CUSTOM_CODE");
        });
    });

    describe("SUGGESTION_GENERATORS", () => {

        it("should have generators for all documented error codes", () => {
            const expectedCodes = [
                "TIMEOUT", "ECONNREFUSED", "ECONNRESET",
                "EHOSTUNREACH", "READ_ERROR", "PROTOCOL_ERROR",
                "UNSUPPORTED_FAMILY"
            ];

            expectedCodes.forEach(code => {
                expect(SUGGESTION_GENERATORS[code]).toBeDefined();
                expect(typeof SUGGESTION_GENERATORS[code]).toBe("function");
            });
        });

        it("should return arrays of strings", () => {
            Object.keys(SUGGESTION_GENERATORS).forEach(code => {
                const suggestions = SUGGESTION_GENERATORS[code](defaultCtx);
                expect(Array.isArray(suggestions)).toBe(true);
                suggestions.forEach(s => {
                    expect(typeof s).toBe("string");
                });
            });
        });
    });
});
