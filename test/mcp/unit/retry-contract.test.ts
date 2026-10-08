/** @jest-environment node */
import { getTableConfig } from "drizzle-orm/pg-core";
import * as domain from "@/db/schema";
let retries: any;
try {
	retries = require("@/server/mcp/retries");
} catch {}
const creatorId = "creator",
	base = { creatorId, retryKey: "key", name: "Playlist" };
describe("TDD-US2-035–037 create retry prerequisites", () => {
	test("canonical digest ignores the key and input property order after validation", () => {
		expect(retries?.canonicalCreateDigest).toEqual(expect.any(Function));
		const one = retries.canonicalCreateDigest("create_playlist", base);
		const two = retries.canonicalCreateDigest("create_playlist", { name: " Playlist ", retryKey: "different", creatorId });
		expect(one).toBe(two);
		expect(one).toMatch(/^[a-f0-9]{64}$/);
		expect(retries.canonicalCreateDigest("create_playlist", { ...base, name: "Changed" })).not.toBe(one);
	});
	test("overlay default name and its explicit equivalent have the same digest", () => {
		expect(retries?.canonicalCreateDigest).toEqual(expect.any(Function));
		expect(retries.canonicalCreateDigest("create_overlay", { creatorId, retryKey: "key" })).toBe(retries.canonicalCreateDigest("create_overlay", { creatorId, retryKey: "key", name: "New Overlay" }));
	});
	test.each([
		{ ...base, confirmed: true },
		{ ...base, retryKey: "" },
		{ ...base, name: " " },
		{ ...base, creatorId: "../other" },
	])("invalid create %j cannot reserve a digest", (input) => {
		expect(retries?.canonicalCreateDigest).toEqual(expect.any(Function));
		expect(() => retries.canonicalCreateDigest("create_playlist", input)).toThrow("INVALID_INPUT");
	});
	test("database retry identity includes every principal context and expires no sooner than 24h", () => {
		const table = (domain as any).mcpMutationRetriesTable;
		expect(table).toBeDefined();
		const config = getTableConfig(table);
		expect(config.columns.map((column) => column.name)).toEqual(expect.arrayContaining(["grant_id", "grant_generation", "auth_user_id", "client_id", "creator_id", "tool_name", "retry_key", "input_digest", "safe_response", "resource_id", "created_at", "expires_at"]));
		const unique = config.indexes.find((index) => index.config.unique);
		expect(unique?.config.columns.map((column: any) => column.name)).toEqual(["grant_id", "grant_generation", "auth_user_id", "client_id", "creator_id", "tool_name", "retry_key"]);
		expect(config.checks.map((check) => check.name)).toEqual(expect.arrayContaining(["mcp_retry_minimum_retention", "mcp_retry_key_bounds", "mcp_retry_generation_positive", "mcp_retry_safe_response_object"]));
	});
});
