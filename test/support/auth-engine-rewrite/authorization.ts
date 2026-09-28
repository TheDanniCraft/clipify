export const permissionCatalogue = [
	"account:read",
	"account:update",
	"account:export",
	"member:read",
	"member:invite",
	"member:update",
	"member:remove",
	"role:read",
	"role:create",
	"role:update",
	"role:delete",
	"creator:read",
	"creator:update",
	"creator:connect",
	"creator:disconnect",
	"overlay:create",
	"overlay:read",
	"overlay:update",
	"overlay:delete",
	"overlay:control",
	"overlay-secret:read",
	"overlay-secret:rotate",
	"playlist:create",
	"playlist:read",
	"playlist:update",
	"playlist:delete",
	"playlist-items:manage",
	"playlist:control",
	"gallery:create",
	"gallery:read",
	"gallery:update",
	"gallery:delete",
	"gallery:publish",
	"runner:create",
	"runner:read",
	"runner:update",
	"runner:delete",
	"runner:control",
	"runner-credential:read",
	"runner-credential:rotate",
	"analytics:read",
	"analytics:export",
	"integration:read",
	"integration:connect",
	"integration:disconnect",
	"integration:reauthorize",
	"subscription:read",
	"subscription:manage",
	"subscription:cancel",
	"billing:read",
	"billing:manage",
	"audit:read",
	"agency:read",
	"agency:update",
	"agency:link-creator",
	"agency:unlink-creator",
	"agency:allocate-license",
	"agency:revoke-license",
] as const;

export type Permission = (typeof permissionCatalogue)[number];
export type LifecycleState = "active" | "suspension_scheduled" | "suspended" | "purge_eligible";

export interface AuthorizationFixture {
	required: Permission;
	directPermissions: Permission[];
	agencyPermissions: Permission[];
	resourceOwnerId: string;
	requestedCreatorId: string;
	entitlements: string[];
	requiredEntitlement?: string;
	lifecycle: LifecycleState;
	hasMembership: boolean;
}

export function authorizationFixture(overrides: Partial<AuthorizationFixture> = {}): AuthorizationFixture {
	return {
		required: "overlay:read",
		directPermissions: ["overlay:read"],
		agencyPermissions: [],
		resourceOwnerId: "creator-000001",
		requestedCreatorId: "creator-000001",
		entitlements: ["pro"],
		requiredEntitlement: undefined,
		lifecycle: "active",
		hasMembership: true,
		...overrides,
	};
}

export function agencyPermissionIntersection(role: readonly Permission[], ceiling: readonly Permission[]): Permission[] {
	const allowed = new Set(ceiling);
	return role.filter((permission) => allowed.has(permission));
}

export function permissionMatrix(): AuthorizationFixture[] {
	return permissionCatalogue.flatMap((required) => [authorizationFixture({ required, directPermissions: [required] }), authorizationFixture({ required, directPermissions: [] })]);
}
