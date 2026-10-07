/** @jest-environment node */
let scopes: any;
try {
	scopes = require("@/server/mcp/scopes");
} catch {}
describe("TDD-US1-027 customized consent scopes", () => {
	test.each(["read", "edit"])("%s preset never silently grants deletion", (preset) => {
		expect(scopes?.consentPreset).toEqual(expect.any(Function));
		expect(scopes.consentPreset(preset)).not.toContain("overlay:delete");
		expect(scopes.consentPreset(preset)).not.toContain("playlist:delete");
	});
	test("grants exactly selected scopes and no unknown or unrequested scope", () => {
		expect(scopes?.validateSelectedScopes).toEqual(expect.any(Function));
		expect(scopes.validateSelectedScopes(["creator:read", "overlay:delete"], ["creator:read", "overlay:delete", "overlay:update"])).toEqual(["creator:read", "overlay:delete"]);
		expect(() => scopes.validateSelectedScopes(["runner-credential:read"], ["runner-credential:read"])).toThrow("INVALID_INPUT");
		expect(() => scopes.validateSelectedScopes(["overlay:delete"], ["creator:read"])).toThrow("INVALID_INPUT");
		expect(() => scopes.validateSelectedScopes([], ["creator:read"])).toThrow("INVALID_INPUT");
	});
});
