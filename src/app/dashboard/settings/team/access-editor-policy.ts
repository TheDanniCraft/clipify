import type { Permission } from "@/auth/permissions";

export function permissionsAfterRoleSelection(input: { nextRole: string; currentPermissions: readonly Permission[]; rolePermissions: readonly Permission[]; preserveCurrent?: boolean }): Permission[] {
	if (input.nextRole === "custom") return input.preserveCurrent ? [...input.currentPermissions] : [];
	return [...input.rolePermissions];
}
