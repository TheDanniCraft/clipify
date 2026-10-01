import type { Permission } from "@/auth/permissions";

export type AgencyCreatorContext = {
	id: string;
	creatorOrganizationId: string;
	status: "proposed" | "accepted" | "revoked";
	permissionCeiling: readonly Permission[];
};

export function resolveAgencyAccess(input: { membershipActive: boolean; linkStatus: "proposed" | "accepted" | "revoked" | null; rolePermissions: readonly Permission[]; permissionCeiling: readonly Permission[] }): Permission[] {
	if (!input.membershipActive || input.linkStatus !== "accepted") return [];
	const ceiling = new Set(input.permissionCeiling);
	return [...new Set(input.rolePermissions.filter((permission) => ceiling.has(permission)))];
}

/** Selects an accepted creator link while the session remains in its agency organization. */
export function selectAgencyCreatorContext(links: readonly AgencyCreatorContext[], requestedCreatorOrganizationId?: string): { options: AgencyCreatorContext[]; selected: AgencyCreatorContext | null } {
	const options = links.filter((link) => link.status === "accepted");
	const selected = requestedCreatorOrganizationId ? (options.find((link) => link.creatorOrganizationId === requestedCreatorOrganizationId) ?? null) : (options[0] ?? null);
	return { options, selected };
}
