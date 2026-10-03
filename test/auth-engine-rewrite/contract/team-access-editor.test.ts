import { permissionsAfterRoleSelection } from "@/app/dashboard/settings/team/access-editor-policy";
import { STANDARD_ROLES } from "@/auth/permissions";

describe("TDD-US3-005 team access editor", () => {
	it("starts an explicitly selected Custom role with no permissions", () => {
		expect(permissionsAfterRoleSelection({ nextRole: "custom", currentPermissions: [...STANDARD_ROLES.operations], rolePermissions: STANDARD_ROLES.operations })).toEqual([]);
	});

	it("loads every permission from a selected preset", () => {
		expect(permissionsAfterRoleSelection({ nextRole: "analyst", currentPermissions: [], rolePermissions: STANDARD_ROLES.analyst })).toEqual(STANDARD_ROLES.analyst);
	});

	it("does not clear the modified subset when a preset becomes Custom through a checkbox change", () => {
		const modified = STANDARD_ROLES.operations.slice(1);
		expect(permissionsAfterRoleSelection({ nextRole: "custom", currentPermissions: modified, rolePermissions: STANDARD_ROLES.operations, preserveCurrent: true })).toEqual(modified);
	});
});
