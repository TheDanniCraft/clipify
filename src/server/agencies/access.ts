import type { Permission } from "@/auth/permissions";

export function resolveAgencyAccess(input: { membershipActive: boolean; linkStatus: "proposed" | "accepted" | "revoked" | null; rolePermissions: readonly Permission[]; permissionCeiling: readonly Permission[] }): Permission[] {
	if (!input.membershipActive || input.linkStatus !== "accepted") return [];
	const ceiling = new Set(input.permissionCeiling);
	return [...new Set(input.rolePermissions.filter((permission) => ceiling.has(permission)))];
}
