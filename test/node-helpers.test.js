/**
 * Tests for lib/node-helpers.js helpers.
 */

const {
    parseSafeInteger,
    STATUSES,
    setTransientStatus,
    mapProtocolStatus,
    STATUS_RESET_MS
} = require("../lib/node-helpers");

describe("parseSafeInteger (#75)", () => {
    test("returns default for empty / null / undefined input", () => {
        expect(parseSafeInteger("", { default: 42 })).toBe(42);
        expect(parseSafeInteger(null, { default: 42 })).toBe(42);
        expect(parseSafeInteger(undefined, { default: 42 })).toBe(42);
    });

    test("returns integer when input is in range", () => {
        expect(parseSafeInteger("100", { default: 0 })).toBe(100);
        expect(parseSafeInteger(250, { default: 0 })).toBe(250);
        expect(parseSafeInteger("0", { default: 99 })).toBe(0); // 0 is valid, not coerced to default
    });

    test("returns default when below min or above max", () => {
        expect(parseSafeInteger(50, { default: 5000, min: 100 })).toBe(5000);
        expect(parseSafeInteger(1e7, { default: 5000, max: 1000 })).toBe(5000);
    });

    test("returns default for non-integer / NaN input", () => {
        expect(parseSafeInteger("abc", { default: 5000 })).toBe(5000);
        expect(parseSafeInteger("1.5", { default: 5000 })).toBe(5000);
        expect(parseSafeInteger(NaN, { default: 5000 })).toBe(5000);
        expect(parseSafeInteger(Infinity, { default: 5000 })).toBe(5000);
    });

    test("Number() correctly parses scientific notation (vs parseInt)", () => {
        // The bug parseInt(\"1e6\") returns 1, silently flooding the network.
        // Number(\"1e6\") returns 1_000_000 — accept it (within cap).
        expect(parseSafeInteger("1e6", { default: 5000, max: 2_000_000 })).toBe(1_000_000);
    });
});

describe("STATUSES and setTransientStatus (#66)", () => {
    test("STATUSES is frozen with canonical bundles", () => {
        expect(Object.isFrozen(STATUSES)).toBe(true);
        expect(STATUSES.ready).toEqual({ fill: "grey", shape: "ring", text: "ready" });
        expect(STATUSES.ok).toEqual({ fill: "green", shape: "dot", text: "ok" });
        expect(STATUSES.error).toEqual({ fill: "red", shape: "ring", text: "error" });
    });

    test("STATUS_RESET_MS is exported", () => {
        expect(STATUS_RESET_MS).toBe(2000);
    });

    test("setTransientStatus applies status now, schedules reset, unrefs timer", () => {
        jest.useFakeTimers();
        const calls = [];
        const node = { status: (s) => calls.push(s) };
        setTransientStatus(node);
        expect(calls[0]).toEqual(STATUSES.ok);
        jest.advanceTimersByTime(STATUS_RESET_MS);
        expect(calls[1]).toEqual(STATUSES.ready);
        jest.useRealTimers();
    });
});

describe("mapProtocolStatus (#66)", () => {
    test("translates known states", () => {
        expect(mapProtocolStatus({ state: "connecting" })).toEqual(STATUSES.connecting);
        expect(mapProtocolStatus({ state: "connected" })).toEqual(STATUSES.connected);
        expect(mapProtocolStatus({ state: "reading" })).toEqual(STATUSES.reading);
    });

    test("retrying includes attempt/maxRetries when present", () => {
        const r = mapProtocolStatus({ state: "retrying", attempt: 2, maxRetries: 3 });
        expect(r.fill).toBe("orange");
        expect(r.text).toBe("retry 2/3");
    });

    test("unknown state falls back to grey with the raw label", () => {
        const r = mapProtocolStatus({ state: "exploded" });
        expect(r).toEqual({ fill: "grey", shape: "ring", text: "exploded" });
    });
});
