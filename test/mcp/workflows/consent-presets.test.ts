/** @jest-environment node */
import { consentPreset } from "@/server/mcp/scopes";
describe("workflow consent presets", () => {
	test("read includes the new readable resources", () => {
		expect(consentPreset("read")).toEqual(expect.arrayContaining(["gallery:read", "runner:read"]));
	});
	test("edit offers ordinary configuration while consequential scopes stay explicit", () => {
		expect(consentPreset("edit")).toEqual(expect.arrayContaining(["gallery:create", "gallery:update", "runner:update"]));
		for (const scope of ["gallery:delete", "gallery:publish", "runner:delete", "runner:control", "runner-credential:rotate", "overlay:control", "overlay-secret:read"]) expect(consentPreset("edit")).not.toContain(scope);
	});
});
