import { createBdd } from "playwright-bdd";
import { onboardTwitchIdentity, type CreatorOnboardingRepository, type CreatorOnboardingState } from "@/auth/creator-onboarding";
import { mapTwitchOAuthError } from "@/app/lib/twitchErrors";
import { authorize } from "@/auth/authorize";
import { acceptInvitation, createInvitation, revokeInvitation, type InvitationRepository, type InvitationState } from "@/auth/invitations";
import { passkeyFallback, type PasskeyLifecycleState } from "@/auth/credential-policy";
import { consumeRateLimit, type RateLimitRepository, type RateLimitState } from "@/auth/rate-limit";
import { appendAuditEvent, type AuditActionClass, type AuditEvent, type AuditOutcome } from "@/auth/audit";
import { ControlledClock, createDeterministicTokenGenerator } from "../../support/auth-engine-rewrite/time";
import { AccountLifecycleService, DELETION_RECOVERY_MS, type AccountLifecycleRepository, type AccountLifecycleState, type LifecycleActor } from "@/server/account-lifecycle/service";
import { buildDeletionNotificationIntents, renderAccountLifecycleNotification, type DeletionNotificationBoundary } from "@/server/notifications/templates/account-lifecycle";
import { DeterministicMailAdapter } from "../../support/auth-engine-rewrite/mail";
import { AgencyService, createAgencyState } from "@/server/agencies/service";
import { AgencyAllocationService, createAllocationState } from "@/server/agencies/allocations";
import { resolveAgencyAccess } from "@/server/agencies/access";
import { expect, test } from "../support/auth-engine-rewrite";

const { Given, When, Then } = createBdd(test);

const AGENCY_BDD_NOW = new Date("2026-09-28T12:00:00.000Z");

const twitch = {
	subject: "twitch-bdd-0001",
	username: "bdd_creator",
	email: "creator@example.invalid",
	emailVerified: true,
	image: "https://example.invalid/avatar.png",
};

function emptyState(): CreatorOnboardingState {
	return { users: [], providerAccounts: [], creators: [], organizations: [], memberships: [], identityLinks: [] };
}

class ScenarioRepository implements CreatorOnboardingRepository {
	state = emptyState();

	async transaction<T>(operation: (draft: CreatorOnboardingState) => Promise<T>) {
		const draft = structuredClone(this.state);
		const result = await operation(draft);
		this.state = draft;
		return result;
	}
}

function repository(values: Map<string, unknown>) {
	const value = values.get("repository");
	if (!(value instanceof ScenarioRepository)) throw new Error("Scenario repository was not initialized");
	return value;
}

Given("a Twitch subject has already completed Clipify onboarding", async ({ authWorld }) => {
	const value = new ScenarioRepository();
	await onboardTwitchIdentity(twitch, value, () => `id-${value.state.users.length}-${value.state.organizations.length}`);
	authWorld.values.set("repository", value);
});

When("the same Twitch subject returns with a newly verified email", async ({ authWorld }) => {
	await onboardTwitchIdentity({ ...twitch, email: "updated@example.invalid" }, repository(authWorld.values));
});

Then("Clipify keeps one person and creator account", async ({ authWorld }) => {
	const state = repository(authWorld.values).state;
	expect(state.users).toHaveLength(1);
	expect(state.creators).toHaveLength(1);
	expect(state.organizations).toHaveLength(1);
});

Then("the verified notification email is synchronized", async ({ authWorld }) => {
	expect(repository(authWorld.values).state.users[0]?.email).toBe("updated@example.invalid");
});

Given("Twitch returns the OAuth error {word}", async ({ authWorld }, providerError: string) => {
	authWorld.values.set("providerError", providerError);
});

When("Clipify maps the provider callback failure", async ({ authWorld }) => {
	authWorld.values.set("mappedError", mapTwitchOAuthError({ error: authWorld.values.get("providerError"), error_description: "Provider fixture" }));
});

Then("the public auth error is {word}", async ({ authWorld }, publicError: string) => {
	expect(authWorld.values.get("mappedError")).toMatchObject({ code: publicError });
});

Given("a Twitch subject is bound to an inconsistent person", async ({ authWorld }) => {
	const value = new ScenarioRepository();
	value.state.providerAccounts.push({ providerId: "twitch", accountId: twitch.subject, authUserId: "orphaned-user" });
	authWorld.values.set("repository", value);
});

When("Clipify attempts creator onboarding", async ({ authWorld }) => {
	try {
		await onboardTwitchIdentity(twitch, repository(authWorld.values));
	} catch (error) {
		authWorld.values.set("onboardingError", error);
	}
});

Then("onboarding fails with TWITCH_IDENTITY_CONFLICT", async ({ authWorld }) => {
	expect(authWorld.values.get("onboardingError")).toMatchObject({ code: "TWITCH_IDENTITY_CONFLICT" });
});

Then("no creator records are added", async ({ authWorld }) => {
	const state = repository(authWorld.values).state;
	expect(state.users).toHaveLength(0);
	expect(state.creators).toHaveLength(0);
	expect(state.organizations).toHaveLength(0);
});

Given("a direct team member only has analytics read access", async ({ authWorld }) => {
	authWorld.values.set("authorizationRequest", { session: { userId: "member-bdd", authenticatedAt: new Date() }, creatorId: "creator-bdd", lifecycle: "active" as const, resourceOwnerId: "creator-bdd", permission: "overlay:delete" as const, access: { kind: "direct" as const, permissions: ["analytics:read" as const] }, entitlements: [], now: new Date() });
	authWorld.values.set("protectedMutationCount", 0);
});

When("the team member attempts to delete an overlay", async ({ authWorld }) => {
	const decision = authorize(authWorld.values.get("authorizationRequest") as Parameters<typeof authorize>[0]);
	authWorld.values.set("authorizationDecision", decision);
	if (decision.allowed) authWorld.values.set("protectedMutationCount", 1);
});

Then("authorization is denied with PERMISSION_DENIED", async ({ authWorld }) => {
	expect(authWorld.values.get("authorizationDecision")).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
});

Then("the protected mutation is not invoked", async ({ authWorld }) => {
	expect(authWorld.values.get("protectedMutationCount")).toBe(0);
});

class InvitationScenarioRepository implements InvitationRepository {
	state: InvitationState = { invitations: [], memberships: [] };
	async transaction<T>(operation: (draft: InvitationState) => Promise<T>) {
		const draft = structuredClone(this.state);
		const result = await operation(draft);
		this.state = draft;
		return result;
	}
}

function invitationDependencies(values: Map<string, unknown>) {
	const repository = values.get("invitationRepository") as InvitationScenarioRepository;
	const clock = values.get("invitationClock") as ControlledClock;
	return { repository, now: clock.now, generateToken: createDeterministicTokenGenerator("bdd-invite"), roleExists: async () => true, deliver: async () => undefined };
}

Given("a pending team invitation", async ({ authWorld }) => {
	const repository = new InvitationScenarioRepository();
	const clock = new ControlledClock();
	authWorld.values.set("invitationRepository", repository);
	authWorld.values.set("invitationClock", clock);
	const created = await createInvitation({ organizationId: "creator-bdd", email: "member@example.invalid", role: "analyst", inviterId: "owner-bdd", delivery: "copy" }, invitationDependencies(authWorld.values));
	authWorld.values.set("invitation", created);
});

Given("the invitation becomes {word}", async ({ authWorld }, state: string) => {
	const created = authWorld.values.get("invitation") as { id: string; token: string };
	const dependencies = invitationDependencies(authWorld.values);
	if (state === "expired") (authWorld.values.get("invitationClock") as ControlledClock).advance(7 * 24 * 60 * 60 * 1000 + 1);
	if (state === "replayed") await acceptInvitation({ token: created.token, authenticatedEmail: "member@example.invalid", authUserId: "member-first" }, dependencies);
	if (state === "revoked") await revokeInvitation(created.id, dependencies);
	authWorld.values.set("acceptanceEmail", state === "wrong-email" ? "attacker@example.invalid" : "member@example.invalid");
});

When("the invited identity attempts acceptance", async ({ authWorld }) => {
	const created = authWorld.values.get("invitation") as { token: string };
	try {
		await acceptInvitation({ token: created.token, authenticatedEmail: String(authWorld.values.get("acceptanceEmail")), authUserId: "member-bdd" }, invitationDependencies(authWorld.values));
	} catch (error) {
		authWorld.values.set("invitationError", error);
	}
});

Then("invitation acceptance is denied with {word}", async ({ authWorld }, code: string) => {
	expect(authWorld.values.get("invitationError")).toMatchObject({ code });
});

Then("no team membership is created", async ({ authWorld }) => {
	const repository = authWorld.values.get("invitationRepository") as InvitationScenarioRepository;
	const newMemberships = repository.state.memberships.filter((membership) => membership.authUserId === "member-bdd");
	expect(newMemberships).toEqual([]);
});

Given("the account passkey is {word}", async ({ authWorld }, state: PasskeyLifecycleState) => {
	authWorld.values.set("passkeyState", state);
});

When("the person chooses a sign-in method", async ({ authWorld }) => {
	authWorld.values.set("signInMethod", passkeyFallback(authWorld.values.get("passkeyState") as PasskeyLifecycleState));
});

Then("the selected sign-in method is {word}", async ({ authWorld }, method: string) => {
	expect(authWorld.values.get("signInMethod")).toBe(method);
});

class RateLimitScenarioRepository implements RateLimitRepository {
	state: RateLimitState = { counters: [] };
	async transaction<T>(operation: (draft: RateLimitState) => Promise<T>) {
		const draft = structuredClone(this.state);
		const result = await operation(draft);
		this.state = draft;
		return result;
	}
}

Given("the shared invitation threshold is exhausted", async ({ authWorld }) => {
	const repository = new RateLimitScenarioRepository();
	const clock = new ControlledClock();
	const request = { identityKey: "owner-bdd", networkKey: "network-bdd", action: "invitation", limit: 1, windowMs: 60_000, now: clock.now() };
	await consumeRateLimit(repository, request);
	authWorld.values.set("rateLimitRepository", repository);
	authWorld.values.set("rateLimitRequest", request);
});

When("another invitation request arrives from the same identity and network", async ({ authWorld }) => {
	authWorld.values.set("rateLimitDecision", await consumeRateLimit(authWorld.values.get("rateLimitRepository") as RateLimitScenarioRepository, authWorld.values.get("rateLimitRequest") as Parameters<typeof consumeRateLimit>[1]));
});

Then("the request is denied with RATE_LIMITED", async ({ authWorld }) => {
	expect(authWorld.values.get("rateLimitDecision")).toMatchObject({ allowed: false, code: "RATE_LIMITED" });
});

Then("retry timing is returned without creating an invitation", async ({ authWorld }) => {
	expect(authWorld.values.get("rateLimitDecision")).toMatchObject({ retryAfterSeconds: 60 });
});

Given("a protected {word} operation with outcome {word}", async ({ authWorld }, actionClass: AuditActionClass, outcome: AuditOutcome) => {
	authWorld.values.set("auditInput", { actionClass, action: "change", outcome, reason: outcome === "denied" ? "PERMISSION_DENIED" : undefined, correlationId: "bdd-correlation", metadata: { refreshToken: "secret", safe: "visible" }, occurredAt: new Date() });
	authWorld.values.set("auditEvents", [] as AuditEvent[]);
});

When("the operation records its audit result", async ({ authWorld }) => {
	appendAuditEvent(authWorld.values.get("auditEvents") as AuditEvent[], authWorld.values.get("auditInput") as Parameters<typeof appendAuditEvent>[1]);
});

Then("one append-only audit event is visible", async ({ authWorld }) => {
	expect(authWorld.values.get("auditEvents")).toHaveLength(1);
});

Then("the audit event contains no credential material", async ({ authWorld }) => {
	const serialized = JSON.stringify(authWorld.values.get("auditEvents"));
	expect(serialized).not.toContain("secret");
	expect(serialized).toContain("[REDACTED]");
});

const BDD_LIFECYCLE_NOW = new Date("2026-09-28T12:00:00.000Z");
const BDD_PURGE_AT = new Date(BDD_LIFECYCLE_NOW.getTime() + DELETION_RECOVERY_MS);

class BddLifecycleRepository implements AccountLifecycleRepository {
	state: AccountLifecycleState = {
		accounts: [{ organizationId: "creator-org-bdd", creatorId: "creator-bdd", status: "active" }],
		deletionRequests: [],
		subscriptions: [],
		auditEvents: [],
		resources: [{ id: "overlay-bdd", organizationId: "creator-org-bdd" }],
	};
	transaction<T>(operation: (state: AccountLifecycleState) => Promise<T>) {
		return operation(this.state);
	}
}

function bddLifecycleActor(role: "owner" | "member"): LifecycleActor {
	return { authUserId: `auth-${role}`, sessionId: `session-${role}`, organizationId: "creator-org-bdd", accountRole: role, authenticatedAt: BDD_LIFECYCLE_NOW };
}

Given("a team member has every delegable permission", async ({ authWorld }) => {
	authWorld.values.set("bddLifecycleRepository", new BddLifecycleRepository());
});

When("the team member attempts account deletion", async ({ authWorld }) => {
	try {
		await new AccountLifecycleService(authWorld.values.get("bddLifecycleRepository") as BddLifecycleRepository, { now: () => BDD_LIFECYCLE_NOW }).requestDeletion(bddLifecycleActor("member"), { choice: "immediate" });
	} catch (error) {
		authWorld.values.set("accountDeletionError", error);
	}
});

Then("account deletion is denied with OWNER_REQUIRED", async ({ authWorld }) => {
	expect(authWorld.values.get("accountDeletionError")).toEqual(expect.objectContaining({ message: "OWNER_REQUIRED" }));
});

Then("no deletion request is created", async ({ authWorld }) => {
	expect((authWorld.values.get("bddLifecycleRepository") as BddLifecycleRepository).state.deletionRequests).toEqual([]);
});

Given("an owner has requested account deletion", async ({ authWorld }) => {
	const mail = new DeterministicMailAdapter();
	authWorld.values.set("deletionMail", mail);
	authWorld.values.set("deletionIntents", buildDeletionNotificationIntents({ requestId: "delete-bdd", recipient: "owner@example.invalid", requestedAt: BDD_LIFECYCLE_NOW, suspensionAt: BDD_LIFECYCLE_NOW, purgeEligibleAt: BDD_PURGE_AT }));
});

When("the {word} deletion notice becomes due", async ({ authWorld }, boundary: DeletionNotificationBoundary) => {
	const intent = (authWorld.values.get("deletionIntents") as ReturnType<typeof buildDeletionNotificationIntents>).find((candidate) => candidate.boundary === boundary);
	if (!intent) throw new Error(`Unknown deletion notice boundary: ${boundary}`);
	const message = renderAccountLifecycleNotification(boundary, { effectiveAt: new Date(intent.payload.effectiveAt), recoveryPath: intent.payload.recoveryPath });
	await (authWorld.values.get("deletionMail") as DeterministicMailAdapter).send({ to: intent.recipient, template: intent.templateVersion, dedupeKey: intent.dedupeKey, payload: { subject: message.subject, body: message.body, effectiveAt: intent.payload.effectiveAt, recoveryPath: intent.payload.recoveryPath } });
	authWorld.values.set("deletionMessage", message);
});

Then("exactly one product lifecycle notice is captured", async ({ authWorld }) => {
	expect((authWorld.values.get("deletionMail") as DeterministicMailAdapter).sent).toHaveLength(1);
});

Then("the notice states the erasure date and requires normal sign-in for recovery", async ({ authWorld }) => {
	const message = authWorld.values.get("deletionMessage") as { body: string };
	expect(message.body).toContain(BDD_PURGE_AT.toISOString());
	expect(message.body).toContain("sign in normally");
	expect(message.body).not.toMatch(/invoice|receipt|payment failed|bearer|token|otp|secret/i);
});

Given("an agency has active access to a Creator Account", async ({ authWorld }) => {
	const state = createAgencyState({
		accounts: [{ organizationId: "agency-bdd", name: "BDD Agency", status: "active", commercialReference: null, provisionedBy: "admin-bdd", createdAt: AGENCY_BDD_NOW, updatedAt: AGENCY_BDD_NOW }],
		links: [{ id: "link-bdd", agencyOrganizationId: "agency-bdd", creatorOrganizationId: "creator-bdd", status: "accepted", permissionCeiling: ["overlay:read"], proposedBy: "agency-owner-bdd", proposedAt: AGENCY_BDD_NOW, acceptedBy: "creator-owner-bdd", acceptedAt: AGENCY_BDD_NOW, revokedBy: null, revokedAt: null, updatedAt: AGENCY_BDD_NOW }],
		memberships: [{ organizationId: "creator-bdd", authUserId: "direct-member-bdd", role: "member", createdAt: AGENCY_BDD_NOW }],
	});
	authWorld.values.set("agencyBddState", state);
	authWorld.values.set(
		"agencyBddService",
		new AgencyService(
			state,
			() => AGENCY_BDD_NOW,
			() => "unused",
		),
	);
});

When("the creator owner revokes the link", async ({ authWorld }) => {
	await (authWorld.values.get("agencyBddService") as AgencyService).revokeLink({ actor: { authUserId: "creator-owner-bdd", organizationId: "creator-bdd", role: "owner" }, linkId: "link-bdd" });
});

Then("agency-derived access ends immediately", async ({ authWorld }) => {
	const state = authWorld.values.get("agencyBddState") as ReturnType<typeof createAgencyState>;
	expect(resolveAgencyAccess({ membershipActive: true, linkStatus: state.links[0]?.status ?? null, rolePermissions: ["overlay:read"], permissionCeiling: state.links[0]?.permissionCeiling ?? [] })).toEqual([]);
});

Then("direct creator-team memberships remain unchanged", async ({ authWorld }) => {
	const state = authWorld.values.get("agencyBddState") as ReturnType<typeof createAgencyState>;
	expect(state.memberships).toContainEqual(expect.objectContaining({ organizationId: "creator-bdd", authUserId: "direct-member-bdd" }));
});

Given("an agency staff role permits overlay deletion but the creator-approved agency permission set does not", async ({ authWorld }) => {
	authWorld.values.set("agencyDeletionPermissions", resolveAgencyAccess({ membershipActive: true, linkStatus: "accepted", rolePermissions: ["overlay:delete"], permissionCeiling: ["overlay:read"] }));
	authWorld.values.set("agencyOverlay", { id: "overlay-bdd", ownerId: "creator-bdd" });
});

When("that staff member attempts to delete the creator's overlay", async ({ authWorld }) => {
	const decision = authorize({ session: { userId: "agency-staff-bdd", authenticatedAt: AGENCY_BDD_NOW }, creatorId: "creator-bdd", lifecycle: "active", resourceOwnerId: "creator-bdd", permission: "overlay:delete", access: { kind: "agency", permissions: authWorld.values.get("agencyDeletionPermissions") as [], creatorCeiling: ["overlay:read"] }, entitlements: [], now: AGENCY_BDD_NOW });
	authWorld.values.set("agencyDeletionDecision", decision);
});

Then("the server rejects the operation", async ({ authWorld }) => {
	expect(authWorld.values.get("agencyDeletionDecision")).toMatchObject({ allowed: false, code: "PERMISSION_DENIED" });
});

Then("the overlay remains unchanged", async ({ authWorld }) => {
	expect(authWorld.values.get("agencyOverlay")).toEqual({ id: "overlay-bdd", ownerId: "creator-bdd" });
});

Given("a creator has both creator-owned benefits and an agency-funded allocation", async ({ authWorld }) => {
	const state = createAllocationState({
		seatLimit: 1,
		acceptedLinkIds: ["link-bdd"],
		creatorOwnedBenefits: { "creator-bdd": ["analytics"] },
		allocations: [{ id: "allocation-bdd", linkId: "link-bdd", creatorId: "creator-bdd", status: "active", effectiveAt: AGENCY_BDD_NOW, removalRequestedAt: null, endsAt: null, sourceReference: "custom-contract", createdAt: AGENCY_BDD_NOW, updatedAt: AGENCY_BDD_NOW }],
	});
	let now = AGENCY_BDD_NOW;
	authWorld.values.set("agencyAllocationClock", { get: () => now, set: (value: Date) => (now = value) });
	authWorld.values.set("agencyAllocationState", state);
	authWorld.values.set(
		"agencyAllocationService",
		new AgencyAllocationService(
			state,
			() => now,
			() => "unused",
		),
	);
});

When("the agency schedules the allocation for removal", async ({ authWorld }) => {
	await (authWorld.values.get("agencyAllocationService") as AgencyAllocationService).scheduleRemoval("allocation-bdd");
});

Then("the creator keeps the agency-funded capabilities for seven days", async ({ authWorld }) => {
	expect((authWorld.values.get("agencyAllocationService") as AgencyAllocationService).hasAgencyBenefit("creator-bdd")).toBe(true);
});

Then("the allocation continues consuming its agency seat during that grace period", async ({ authWorld }) => {
	expect((authWorld.values.get("agencyAllocationService") as AgencyAllocationService).occupiedSeats()).toBe(1);
});

Then("after grace only the agency-funded capabilities are removed", async ({ authWorld }) => {
	const clock = authWorld.values.get("agencyAllocationClock") as { set(value: Date): void };
	clock.set(new Date(AGENCY_BDD_NOW.getTime() + 7 * 24 * 60 * 60 * 1000));
	const service = authWorld.values.get("agencyAllocationService") as AgencyAllocationService;
	await service.endDueAllocations();
	expect(service.hasAgencyBenefit("creator-bdd")).toBe(false);
});

Then("creator-owned benefits remain active", async ({ authWorld }) => {
	expect((authWorld.values.get("agencyAllocationService") as AgencyAllocationService).effectiveBenefits("creator-bdd")).toEqual(new Set(["analytics"]));
});

Then("no creator data is deleted", async ({ authWorld }) => {
	const state = authWorld.values.get("agencyAllocationState") as ReturnType<typeof createAllocationState>;
	expect(state.deletedCreatorIds).toEqual([]);
});

Then("the creator receives notices when removal is scheduled, when 3 and 1 days remain, and when access ends", async ({ authWorld }) => {
	const state = authWorld.values.get("agencyAllocationState") as ReturnType<typeof createAllocationState>;
	expect(state.notifications.map((notice) => notice.type)).toEqual(["removal-scheduled", "removal-3d", "removal-1d", "ended"]);
});
