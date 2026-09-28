import { createBdd } from "playwright-bdd";
import { onboardTwitchIdentity, type CreatorOnboardingRepository, type CreatorOnboardingState } from "@/auth/creator-onboarding";
import { mapTwitchOAuthError } from "@/app/lib/twitchErrors";
import { authorize } from "@/auth/authorize";
import { acceptInvitation, createInvitation, revokeInvitation, type InvitationRepository, type InvitationState } from "@/auth/invitations";
import { passkeyFallback, type PasskeyLifecycleState } from "@/auth/credential-policy";
import { consumeRateLimit, type RateLimitRepository, type RateLimitState } from "@/auth/rate-limit";
import { appendAuditEvent, type AuditActionClass, type AuditEvent, type AuditOutcome } from "@/auth/audit";
import { ControlledClock, createDeterministicTokenGenerator } from "../../support/auth-engine-rewrite/time";
import { expect, test } from "../support/auth-engine-rewrite";

const { Given, When, Then } = createBdd(test);

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
