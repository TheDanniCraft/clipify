/** @jest-environment node */
export {};
let errors: any;
try {
	errors = require("@/server/mcp/errors");
} catch {}
describe("safe stable MCP business errors", () => {
	test.each(["INVALID_INPUT", "ACCESS_DENIED", "RESOURCE_UNAVAILABLE", "FEATURE_RESTRICTED", "RETRY_CONFLICT", "RATE_LIMITED", "SERVICE_UNAVAILABLE"])("%s remains distinct and carries a correlation id", (code) => {
		expect(errors?.toolFailure).toEqual(expect.any(Function));
		const result = errors.toolFailure(new Error(code));
		expect(result.isError).toBe(true);
		expect(result.structuredContent.error.code).toBe(code);
		expect(result.structuredContent.error.correlationId).toMatch(/^[a-f0-9-]{36}$/);
		expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent.error);
	});
	test("revision comparison conflict uses the published CONFLICT code", () => {
		expect(errors?.toolFailure).toEqual(expect.any(Function));
		expect(errors.toolFailure(new Error("REVISION_CONFLICT")).structuredContent.error.code).toBe("CONFLICT");
	});
	test("quota rejection includes only public numeric usage and limit", () => {
		expect(errors?.toolFailure).toEqual(expect.any(Function));
		const error = Object.assign(new Error("PLAN_LIMIT_REACHED"), { usage: 1, limit: 1, secret: "private-key", sql: "private-query" });
		const result = errors.toolFailure(error);
		expect(result.structuredContent.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
		expect(JSON.stringify(result)).not.toMatch(/private-|sql|secret/);
	});
	test.each([new Error("database password=private-password"), { code: "ACCESS_DENIED", message: "private-host" }, undefined])("unknown failure %p never leaks implementation details", (error) => {
		expect(errors?.toolFailure).toEqual(expect.any(Function));
		const result = errors.toolFailure(error);
		expect(result.structuredContent.error.code).toBe("SERVICE_UNAVAILABLE");
		expect(JSON.stringify(result)).not.toMatch(/private-|password|database/);
	});
});
