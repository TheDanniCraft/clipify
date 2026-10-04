import { PERMISSIONS, STANDARD_ROLES, type Permission } from "./permissions";

type PermissionStatements = Record<string, readonly string[]>;

const STATIC_ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
	owner: PERMISSIONS,
	admin: STANDARD_ROLES.operations,
	member: [],
	operations: STANDARD_ROLES.operations,
	"content-manager": STANDARD_ROLES.contentManager,
	analyst: STANDARD_ROLES.analyst,
	"billing-manager": STANDARD_ROLES.billingManager,
};

function roleNames(value: string) {
	return value
		.split(",")
		.map((role) => role.trim())
		.filter(Boolean);
}

function flattenStatements(statements: PermissionStatements | undefined): Permission[] {
	if (!statements) return [];
	return Object.entries(statements)
		.flatMap(([resource, actions]) => actions.map((action) => `${resource}:${action}`))
		.filter((permission): permission is Permission => PERMISSIONS.includes(permission as Permission));
}

export function permissionsForOrganizationRoles(value: string, dynamicRoles: ReadonlyMap<string, PermissionStatements>): Permission[] | null {
	const permissions = new Set<Permission>();
	for (const role of roleNames(value)) {
		const rolePermissions = STATIC_ROLE_PERMISSIONS[role] ?? (dynamicRoles.has(role) ? flattenStatements(dynamicRoles.get(role)) : null);
		if (rolePermissions === null) return null;
		for (const permission of rolePermissions) permissions.add(permission);
	}
	return [...permissions];
}

export type RoleAssignmentDecision = { allowed: true } | { allowed: false; code: "SELF_ROLE_UPDATE_DENIED" | "ROLE_NOT_FOUND" | "ROLE_PERMISSION_ESCALATION_DENIED" };

export function evaluateRoleAssignment(input: { actorMemberId: string; targetMemberId?: string; actorRole: string; requestedRole: string; dynamicRoles?: ReadonlyMap<string, PermissionStatements> }): RoleAssignmentDecision {
	const actorRoles = roleNames(input.actorRole);
	if (actorRoles.includes("owner")) return { allowed: true };
	if (input.targetMemberId === input.actorMemberId) return { allowed: false, code: "SELF_ROLE_UPDATE_DENIED" };

	const dynamicRoles = input.dynamicRoles ?? new Map();
	const actorPermissions = permissionsForOrganizationRoles(input.actorRole, dynamicRoles);
	const requestedPermissions = permissionsForOrganizationRoles(input.requestedRole, dynamicRoles);
	if (!actorPermissions || !requestedPermissions) return { allowed: false, code: "ROLE_NOT_FOUND" };

	const actorPermissionSet = new Set(actorPermissions);
	if (requestedPermissions.some((permission) => !actorPermissionSet.has(permission))) return { allowed: false, code: "ROLE_PERMISSION_ESCALATION_DENIED" };
	return { allowed: true };
}
