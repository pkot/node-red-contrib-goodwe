/**
 * Tests for GoodWe Helper Library
 */

const helper = require("../lib/goodwe-helper.js");

describe("GoodWe Helper Library", function () {

    describe("formatOutput", function () {
        const testData = {
            vpv1: 245.5,
            ipv1: 6.2,
            ppv1: 1522,
            battery_soc: 87,
            vac1: 230.5
        };

        it("should format as flat by default", function () {
            const result = helper.formatOutput(testData, "flat");
            expect(result).toEqual(testData);
        });

        it("should format as categorized", function () {
            const result = helper.formatOutput(testData, "categorized");
            expect(result.pv).toBeDefined();
            expect(result.battery).toBeDefined();
            expect(result.grid).toBeDefined();
        });

        it("should format as array", function () {
            const result = helper.formatOutput(testData, "array");
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe("categorizeSensorData", function () {
        it("should categorize PV sensors", function () {
            const data = { vpv1: 245.5, ipv1: 6.2, ppv1: 1522 };
            const result = helper.categorizeSensorData(data);
            expect(result.pv.vpv1).toBe(245.5);
            expect(result.pv.ipv1).toBe(6.2);
            expect(result.pv.ppv1).toBe(1522);
        });

        it("should categorize battery sensors", function () {
            const data = { battery_soc: 87, battery_voltage: 51.2 };
            const result = helper.categorizeSensorData(data);
            expect(result.battery.battery_soc).toBe(87);
            expect(result.battery.battery_voltage).toBe(51.2);
        });

        it("should categorize grid sensors", function () {
            const data = { vac1: 230.5, iac1: 6.2, fac1: 50.0, pac: 2875 };
            const result = helper.categorizeSensorData(data);
            expect(result.grid.vac1).toBe(230.5);
            expect(result.grid.iac1).toBe(6.2);
        });

        it("should categorize energy sensors", function () {
            const data = { e_day: 15.2, e_total: 1234.5, h_total: 2468 };
            const result = helper.categorizeSensorData(data);
            expect(result.energy.e_day).toBe(15.2);
            expect(result.energy.e_total).toBe(1234.5);
        });

        it("should categorize status sensors", function () {
            const data = { temperature: 42.5, work_mode: 1 };
            const result = helper.categorizeSensorData(data);
            expect(result.status.temperature).toBe(42.5);
            expect(result.status.work_mode).toBe(1);
        });
    });

    describe("convertToArray", function () {
        it("should convert object to array format", function () {
            const data = { vpv1: 245.5, battery_soc: 87 };
            const result = helper.convertToArray(data);
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBe(2);
            expect(result[0].id).toBe("vpv1");
            expect(result[0].value).toBe(245.5);
        });
    });

    describe("createErrorResponse", function () {
        it("should create error response", function () {
            const error = new Error("Test error");
            error.code = "TEST_ERROR";
            const result = helper.createErrorResponse(error, "test_command");
            expect(result.success).toBe(false);
            expect(result.command).toBe("test_command");
            expect(result.error.code).toBe("TEST_ERROR");
            expect(result.error.message).toBe("Test error");
        });
    });

    describe("validateSetting", function () {
        it("should validate valid setting", function () {
            const result = helper.validateSetting("grid_export_limit", 5000);
            expect(result.valid).toBe(true);
        });

        it("should reject unknown setting", function () {
            const result = helper.validateSetting("unknown_setting", 100);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("Unknown setting");
        });

        it("should reject out of range value", function () {
            const result = helper.validateSetting("grid_export_limit", 99999);
            expect(result.valid).toBe(false);
            expect(result.error).toContain("out of range");
        });

        it("should reject invalid enum value", function () {
            const result = helper.validateSetting("operation_mode", "INVALID");
            expect(result.valid).toBe(false);
        });
    });

    describe("generateMockRuntimeData", function () {
        it("should generate ET family data", function () {
            const data = helper.generateMockRuntimeData("ET");
            expect(data.vpv1).toBeDefined();
            expect(data.battery_soc).toBeDefined();
        });

        it("should generate DT family data", function () {
            const data = helper.generateMockRuntimeData("DT");
            expect(data.vac2).toBeDefined();
            expect(data.vac3).toBeDefined();
        });

        it("should generate ES family data", function () {
            const data = helper.generateMockRuntimeData("ES");
            expect(data.battery_soc).toBeDefined();
        });
    });
});
