jest.mock("server-only", () => ({}));
import { PERMISSIONS, STANDARD_ROLES } from "@/auth/permissions";
import { parseOrganizationRolePermissions } from "@/auth/authorize-operation";
it("offers an event manager without granting billing or unrelated creator writes", () => {
	const permissions = parseOrganizationRolePermissions("event-manager");
	expect(permissions).toEqual(expect.arrayContaining(["creator:read", "event:read", "event:create", "event:update", "event:review", "event:publish", "event-presenter:rotate"]));
	expect(permissions).not.toContain("billing:manage");
	expect(permissions).not.toContain("creator:update");
	expect(PERMISSIONS).toEqual(expect.arrayContaining(permissions));
	expect(STANDARD_ROLES.owner).toEqual(expect.arrayContaining(permissions));
});
