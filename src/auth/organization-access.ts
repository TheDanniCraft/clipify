import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";
import { STANDARD_ROLES, type Permission } from "./permissions";

export const clipifyStatements = {
	...defaultStatements,
	account: ["read", "update", "export"],
	member: ["create", "update", "delete", "read", "invite", "remove"],
	role: ["read", "create", "update", "delete"],
	creator: ["read", "update", "connect", "disconnect"],
	overlay: ["create", "read", "update", "delete", "control"],
	"overlay-secret": ["read", "rotate"],
	playlist: ["create", "read", "update", "delete", "control"],
	"playlist-items": ["manage"],
	gallery: ["create", "read", "update", "delete", "publish"],
	runner: ["create", "read", "update", "delete", "control"],
	"runner-credential": ["read", "rotate"],
	analytics: ["read", "export"],
	integration: ["read", "connect", "disconnect", "reauthorize"],
	subscription: ["read", "manage", "cancel"],
	billing: ["read", "manage"],
	audit: ["read"],
	agency: ["read", "update", "link-creator", "unlink-creator", "allocate-license", "revoke-license"],
} as const;

export const clipifyAccessControl = createAccessControl(clipifyStatements);

function roleStatements(permissions: readonly Permission[]) {
	const statements: Record<string, string[]> = {};
	for (const permission of permissions) {
		const [resource, action] = permission.split(":") as [string, string];
		(statements[resource] ??= []).push(action);
	}
	return statements;
}

export const betterAuthOrganizationRoles = {
	owner: clipifyAccessControl.newRole(Object.fromEntries(Object.entries(clipifyStatements).map(([resource, actions]) => [resource, [...actions]]))),
	admin: clipifyAccessControl.newRole(roleStatements(STANDARD_ROLES.operations)),
	member: clipifyAccessControl.newRole({ ac: ["read"] }),
	operations: clipifyAccessControl.newRole(roleStatements(STANDARD_ROLES.operations)),
	"content-manager": clipifyAccessControl.newRole(roleStatements(STANDARD_ROLES.contentManager)),
	analyst: clipifyAccessControl.newRole(roleStatements(STANDARD_ROLES.analyst)),
	"billing-manager": clipifyAccessControl.newRole(roleStatements(STANDARD_ROLES.billingManager)),
};
