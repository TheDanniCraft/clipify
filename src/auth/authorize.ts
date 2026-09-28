import type { NonDelegableAction, Permission } from "./permissions";

const RECENT_AUTH_WINDOW_MS = 5 * 60 * 1000;

export type CreatorLifecycle = "active" | "suspension_scheduled" | "suspended" | "purge_eligible";

export type AccessGrant = { kind: "owner"; permissions: readonly Permission[] } | { kind: "direct"; permissions: readonly Permission[] } | { kind: "agency"; permissions: readonly Permission[]; creatorCeiling: readonly Permission[] } | { kind: "none"; permissions: readonly Permission[] };

export interface AuthorizationRequest {
	session: { userId: string; authenticatedAt: Date } | null;
	creatorId: string;
	lifecycle: CreatorLifecycle;
	resourceOwnerId?: string;
	permission: Permission;
	access: AccessGrant;
	entitlements: readonly string[];
	requiredEntitlement?: string;
	requireRecentAuth?: boolean;
	ownerOnlyAction?: NonDelegableAction;
	now: Date;
}

export type AuthorizationDecision =
	| { allowed: true; accessPath: Exclude<AccessGrant["kind"], "none"> }
	| {
			allowed: false;
			code: "AUTHENTICATION_REQUIRED" | "ACCOUNT_SUSPENDED" | "RECENT_AUTH_REQUIRED" | "RESOURCE_OWNERSHIP_MISMATCH" | "ACCESS_PATH_REQUIRED" | "PERMISSION_DENIED" | "OWNER_REQUIRED" | "ENTITLEMENT_REQUIRED";
	  };

function hasPermission(access: Exclude<AccessGrant, { kind: "none" }>, permission: Permission) {
	if (access.kind === "owner") return true;
	if (access.kind === "direct") return access.permissions.includes(permission);
	return access.permissions.includes(permission) && access.creatorCeiling.includes(permission);
}

/**
 * Applies Clipify's authorization invariants in a stable, auditable denial order.
 * Call this on the server immediately before protected reads and mutations.
 */
export function authorize(request: AuthorizationRequest): AuthorizationDecision {
	if (!request.session) return { allowed: false, code: "AUTHENTICATION_REQUIRED" };

	if (request.lifecycle === "suspended" || request.lifecycle === "purge_eligible") {
		return { allowed: false, code: "ACCOUNT_SUSPENDED" };
	}

	if (request.requireRecentAuth && request.now.getTime() - request.session.authenticatedAt.getTime() > RECENT_AUTH_WINDOW_MS) {
		return { allowed: false, code: "RECENT_AUTH_REQUIRED" };
	}

	if (request.resourceOwnerId && request.resourceOwnerId !== request.creatorId) {
		return { allowed: false, code: "RESOURCE_OWNERSHIP_MISMATCH" };
	}

	if (request.access.kind === "none") return { allowed: false, code: "ACCESS_PATH_REQUIRED" };

	if (!hasPermission(request.access, request.permission)) {
		return { allowed: false, code: "PERMISSION_DENIED" };
	}

	if (request.ownerOnlyAction && request.access.kind !== "owner") {
		return { allowed: false, code: "OWNER_REQUIRED" };
	}

	if (request.requiredEntitlement && !request.entitlements.includes(request.requiredEntitlement)) {
		return { allowed: false, code: "ENTITLEMENT_REQUIRED" };
	}

	return { allowed: true, accessPath: request.access.kind };
}
