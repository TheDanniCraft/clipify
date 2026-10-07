/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
const probe = (mode: string) => runMcpProbe("request-boundary-probe", [mode]);
describe("TDD-HTTP-001 / T109 public request envelope boundaries", () => {
	test.each(["oversized", "stream-overflow"])("rejects %s before parsing or authenticating", (mode) => {
		expect(probe(mode).status).toBe(413);
	});
	test("rejects a Host outside the configured service origin", () => {
		expect(probe("bad-host").status).toBe(403);
	});
	test("modern browser preflight permits the SDK method and name headers", () => {
		const result = probe("preflight");
		expect(result.status).toBe(204);
		const allowed = result.headers["access-control-allow-headers"]
			.toLowerCase()
			.split(",")
			.map((s: string) => s.trim());
		expect(allowed).toEqual(expect.arrayContaining(["authorization", "content-type", "mcp-protocol-version", "mcp-method", "mcp-name"]));
	});
	test.each(["exact-limit", "get", "delete", "framework-url"])("an allowed-origin %s request exposes its OAuth challenge", (mode) => {
		const result = probe(mode);
		expect(result.status).toBe(401);
		expect(result.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:3107");
		expect(result.headers["access-control-expose-headers"].toLowerCase()).toContain("www-authenticate");
		expect(result.headers["www-authenticate"]).toContain("resource_metadata=");
	});
});
