/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({ db: {} }));
import { authorizeTrustedCreatorOperation, type TrustedCreatorPrincipal } from "@/auth/authorize-operation";
const principal: TrustedCreatorPrincipal = {
	kind: "oauth",
	authUserId: "user",
	authenticatedAt: new Date(),
	scopes: ["creator:read", "overlay:read", "overlay:update"],
	creators: [
		{ creatorId: "readonly", agencyOrganizationId: null, scopes: ["creator:read", "overlay:read"] },
		{ creatorId: "editable", agencyOrganizationId: null, scopes: ["creator:read", "overlay:read", "overlay:update"] },
	],
};
test("a writable token cannot edit a creator authorized only for Read", async () => {
	await expect(authorizeTrustedCreatorOperation({ principal, creatorId: "readonly", permission: "overlay:update" })).resolves.toEqual({ allowed: false, code: "PERMISSION_DENIED" });
});
test("per-creator consent cannot exceed the token scope ceiling", async () => {
	await expect(authorizeTrustedCreatorOperation({ principal: { ...principal, scopes: ["overlay:read"] }, creatorId: "editable", permission: "overlay:update" })).resolves.toEqual({ allowed: false, code: "PERMISSION_DENIED" });
});
test("an unselected creator remains inaccessible", async () => {
	await expect(authorizeTrustedCreatorOperation({ principal, creatorId: "other", permission: "overlay:read" })).resolves.toEqual({ allowed: false, code: "ACCESS_PATH_REQUIRED" });
});
