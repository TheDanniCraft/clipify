# Contract: Authorization

## Server API

```ts
type Permission = `${Resource}:${Action}`;

type ActorContext = {
	personId: string;
	sessionId: string;
	authenticatedAt: Date;
};

type AuthorizationRequest = {
	actor: ActorContext;
	creatorId: string;
	permission: Permission;
	resource?: { type: string; id: string; ownerCreatorId: string };
	requiredEntitlement?: string;
	recentAuthentication?: boolean;
};

type AuthorizationDecision = { allowed: true; path: "owner" | "direct" | "agency"; auditContext: object } | { allowed: false; code: DenialCode; auditContext: object };
```

`authorize(request)` is the only production permission decision point. A caller must not infer authorization from UI state, cookie presence, a cached role, Creator Profile ID equality alone, or a Better Auth client-side permission check.

## Evaluation order

1. Resolve and validate the current Better Auth database session.
2. Reject suspended/deletion-blocked person or Creator Account state.
3. If requested, enforce authentication freshness (≤5 minutes).
4. Resolve the Creator Account for `creatorId` and validate resource ownership.
5. Resolve one access path:
   - owner/direct active Creator Account membership; or
   - active Agency Account membership + accepted agency link.
6. Direct path: expand current role permissions. Agency path: intersect current agency role permissions with the current link ceiling.
7. Reject owner-only operations unless the caller is the account owner.
8. Validate the required entitlement without treating it as permission.
9. Return a structured decision; denied mutations make no state change.

## Denial codes

`UNAUTHENTICATED`, `SESSION_REVOKED`, `RECENT_AUTH_REQUIRED`, `ACCOUNT_SUSPENDED`, `NO_MEMBERSHIP`, `LINK_NOT_ACCEPTED`, `PERMISSION_DENIED`, `OWNER_ONLY`, `RESOURCE_NOT_OWNED`, `ENTITLEMENT_REQUIRED`, `IDENTITY_CONFLICT`.

Externally visible errors disclose no cross-account existence. Security-relevant decisions emit redacted audit events.

## Agency invariant

```text
effective = activeAgencyRolePermissions ∩ acceptedCreatorLinkCeiling
```

This is recomputed for every protected operation. Revoking membership/link or reducing either permission set affects the next operation despite an existing session.

## Compatibility facade

During migration, `validateAuth()` may return an `ActorContext` plus explicitly selected Creator Account context. It must use Better Auth internally and must not issue/accept the legacy dashboard JWT. Callers migrate incrementally to `authorize`; the legacy facade is removed by the contract phase.
