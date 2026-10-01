export const PERMISSIONS = [
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

export type Permission = (typeof PERMISSIONS)[number];

export const NON_DELEGABLE_ACTIONS = ["account:delete", "ownership:transfer", "agency:provision", "account:force-purge", "account:restore"] as const;

export type NonDelegableAction = (typeof NON_DELEGABLE_ACTIONS)[number];

const without = (excluded: readonly Permission[]) => PERMISSIONS.filter((permission) => !excluded.includes(permission));

export const STANDARD_ROLES = {
	owner: PERMISSIONS,
	operations: without(["account:export", "member:read", "member:invite", "member:update", "member:remove", "role:read", "role:create", "role:update", "role:delete", "subscription:read", "subscription:manage", "subscription:cancel", "billing:read", "billing:manage", "agency:read", "agency:update", "agency:link-creator", "agency:unlink-creator", "agency:allocate-license", "agency:revoke-license"]),
	contentManager: ["playlist:create", "playlist:read", "playlist:update", "playlist:delete", "playlist-items:manage", "playlist:control", "gallery:create", "gallery:read", "gallery:update", "gallery:delete", "gallery:publish"] satisfies readonly Permission[],
	analyst: ["analytics:read", "analytics:export", "audit:read"] satisfies readonly Permission[],
	billingManager: ["subscription:read", "subscription:manage", "subscription:cancel", "billing:read", "billing:manage"] satisfies readonly Permission[],
} as const satisfies Record<string, readonly Permission[]>;

export type StandardRole = keyof typeof STANDARD_ROLES;
