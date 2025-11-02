/**
 * Example Tests Using Test Utilities
 * 
 * This file demonstrates how to use the test utilities and mock data
 * for writing clean, maintainable tests.
 */

const helper = require("node-red-node-test-helper");
const goodweNode = require("../nodes/goodwe-legacy.js");
const testUtils = require("./test-utils");
const mockData = require("./fixtures/mock-inverter-data");

helper.init(require.resolve("node-red"));

describe("Example: Using Test Utilities", () => {
    
    beforeEach(testUtils.testLifecycle.beforeEach);
    afterEach(testUtils.testLifecycle.afterEach);

    describe("Basic flow creation", () => {
        it("should create a basic test flow easily", async () => {
            const flow = testUtils.createBasicFlow({
                host: "192.168.1.100",
                family: "ET"
            });
            
            const nodes = await testUtils.loadFlowWithNodes(goodweNode, flow);
            
            expect(nodes.n1).toBeDefined();
            expect(nodes.n1.host).toBe("192.168.1.100");
            expect(nodes.n1.family).toBe("ET");
        });
    });

    describe("Send and wait pattern", () => {
        it("should send message and wait for response", async () => {
            const flow = testUtils.createBasicFlow();
            const nodes = await testUtils.loadFlowWithNodes(goodweNode, flow);
            
            const response = await testUtils.sendAndWait(
                nodes.n1,
                nodes.n2,
                testUtils.sampleMessages.read
            );
            
            testUtils.assertions.isSuccess(response);
            expect(response.payload.command).toBe("read");
        });
    });

    describe("Using mock data", () => {
        it("should work with mock runtime data", async () => {
            const flow = testUtils.createBasicFlow();
            const nodes = await testUtils.loadFlowWithNodes(goodweNode, flow);
            
            const response = await testUtils.sendAndWait(
                nodes.n1,
                nodes.n2,
                testUtils.sampleMessages.read
            );
            
            // In a real implementation, you would mock the inverter communication
            // and return mockData.runtimeData
            expect(response.payload).toBeDefined();
            
            // Example of what the mocked data would look like:
            const expectedStructure = mockData.runtimeData;
            expect(expectedStructure.data).toHaveProperty("vpv1");
            expect(expectedStructure.data).toHaveProperty("pac");
        });
    });

    describe("Status monitoring", () => {
        it("should capture status updates", async () => {
            const flow = testUtils.createBasicFlow();
            const nodes = await testUtils.loadFlowWithNodes(goodweNode, flow);
            
            const statusCalls = testUtils.captureStatusCalls(nodes.n1);
            
            await testUtils.sendAndWait(
                nodes.n1,
                nodes.n2,
                testUtils.sampleMessages.read
            );
            
            // Status should have been updated during operation
            expect(statusCalls.length).toBeGreaterThan(0);
        });
    });

    describe("Error handling with mocks", () => {
        it("should demonstrate error mock usage", async () => {
            // Example of creating an error mock
            const errorMock = testUtils.createMockError("Connection failed");
            
            expect(typeof errorMock).toBe("function");
            
            // This would be used to mock inverter communication failures
            try {
                await errorMock();
                fail("Should have thrown an error");
            } catch (err) {
                expect(err.message).toBe("Connection failed");
            }
        });
    });

    describe("Message structure assertions", () => {
        it("should validate message structure easily", async () => {
            const flow = testUtils.createBasicFlow();
            const nodes = await testUtils.loadFlowWithNodes(goodweNode, flow);
            
            const response = await testUtils.sendAndWait(
                nodes.n1,
                nodes.n2,
                testUtils.sampleMessages.read
            );
            
            testUtils.assertMessageStructure(response, {
                success: true,
                command: "read",
                timestamp: true,
                data: true
            });
        });
    });

    describe("Custom message properties", () => {
        it("should preserve custom properties", async () => {
            const flow = testUtils.createBasicFlow();
            const nodes = await testUtils.loadFlowWithNodes(goodweNode, flow);
            
            const customMessage = testUtils.sampleMessages.withProperties(
                "read",
                {
                    correlationId: "test-123",
                    customProp: "preserved"
                }
            );
            
            const response = await testUtils.sendAndWait(
                nodes.n1,
                nodes.n2,
                customMessage
            );
            
            expect(response.correlationId).toBe("test-123");
            expect(response.customProp).toBe("preserved");
        });
    });

    describe("Mock data examples", () => {
        it("should have runtime data mock", () => {
            expect(mockData.runtimeData).toBeDefined();
            expect(mockData.runtimeData.data.vpv1).toBe(245.5);
            expect(mockData.runtimeData.data.pac).toBe(2875);
        });

        it("should have device info mock", () => {
            expect(mockData.deviceInfo).toBeDefined();
            expect(mockData.deviceInfo.data.modelName).toBe("GW5000-ET");
        });

        it("should have error response mocks", () => {
            expect(mockData.errors.connectionTimeout).toBeDefined();
            expect(mockData.errors.connectionTimeout.success).toBe(false);
            expect(mockData.errors.connectionTimeout.error.code).toBe("CONNECTION_TIMEOUT");
        });

        it("should have discovery response mocks", () => {
            expect(mockData.discoveryResponse).toBeDefined();
            expect(mockData.discoveryResponse.data.inverters).toHaveLength(2);
        });
    });
});
