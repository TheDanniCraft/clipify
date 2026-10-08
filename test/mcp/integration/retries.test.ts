/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-US2-023/024/034 transactional create retry prerequisites", () => {
	test.each(["replay", "concurrent"])("%s returns one committed safe result", (mode) => {
		const result = flowProbe(`retries:${mode}`).retryResult;
		expect(result.helperAvailable).toBe(true);
		expect(result).toMatchObject({ resources: 1, retries: 1, creations: 1, resultsSafe: true, storedSafe: true });
		expect(new Set(result.resultIds).size).toBe(1);
		expect(result.audits).toBe(mode === "concurrent" ? 20 : 2);
	});
	test("changed payload cannot reuse a successful key", () => {
		const result = flowProbe("retries:conflict").retryResult;
		expect(result.helperAvailable).toBe(true);
		expect(result).toMatchObject({ failure: "RETRY_CONFLICT", resources: 1, retries: 1, creations: 1 });
	});
	test("failure before commit leaves the key retryable and no partial resource", () => {
		const result = flowProbe("retries:rollback").retryResult;
		expect(result.helperAvailable).toBe(true);
		expect(result).toMatchObject({ resources: 1, retries: 1, creations: 2, audits: 1, resultsSafe: true, storedSafe: true });
	});
	test("revocation denies even a cached successful result", () => {
		const result = flowProbe("retries:revoked").retryResult;
		expect(result.helperAvailable).toBe(true);
		expect(result).toMatchObject({ failure: "AUTHENTICATION_REQUIRED", resources: 1, retries: 1, creations: 1, audits: 1 });
	});
	test("audit failure rolls back the resource and retry record before a successful retry", () => {
		const result = flowProbe("retries:audit-failure").retryResult;
		expect(result).toMatchObject({ resources: 1, retries: 1, creations: 2, audits: 1, storedSafe: true });
	});
	test("a deleted resource cannot replay cached success", () => {
		const result = flowProbe("retries:deleted").retryResult;
		expect(result).toMatchObject({ failure: "RESOURCE_UNAVAILABLE", resources: 0, retries: 1, creations: 1, audits: 1 });
	});
	test("expired retry retention permits new intent rather than promising unlimited replay", () => {
		const result = flowProbe("retries:expired").retryResult;
		expect(result).toMatchObject({ resources: 2, retries: 1, creations: 2, audits: 2 });
		expect(new Set(result.resultIds).size).toBe(2);
	});
});

describe("playlist create retry prerequisites", () => {
	test.each(["replay", "concurrent"])("%s returns one committed playlist", (mode) => {
		const result = flowProbe(`retries:playlist:${mode}`).retryResult;
		expect(result).toMatchObject({ resources: 1, retries: 1, creations: 1, resultsSafe: true, storedSafe: true });
		expect(new Set(result.resultIds).size).toBe(1);
		expect(result.audits).toBe(mode === "concurrent" ? 20 : 2);
	});
	test.each([
		["conflict", "RETRY_CONFLICT", 1],
		["deleted", "RESOURCE_UNAVAILABLE", 0],
		["revoked", "AUTHENTICATION_REQUIRED", 1],
	])("%s replay denies safely", (mode, failure, resources) => {
		expect(flowProbe(`retries:playlist:${mode}`).retryResult).toMatchObject({ failure, resources, retries: 1, creations: 1, audits: 1 });
	});
	test.each(["rollback", "audit-failure"])("%s rolls back before retrying", (mode) => {
		expect(flowProbe(`retries:playlist:${mode}`).retryResult).toMatchObject({ resources: 1, retries: 1, creations: 2, audits: 1 });
	});
});
