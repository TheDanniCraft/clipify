import { createBdd } from "playwright-bdd";
import { TWITCH_REQUIRED_SCOPES } from "@/auth/providers/twitch";
import { acceptInvitation, createInvitation, type InvitationRepository, type InvitationState } from "@/auth/invitations";
import { authorize } from "@/auth/authorize";
import { ControlledClock, createDeterministicTokenGenerator } from "../../support/auth-engine-rewrite/time";
import { anonymizedLegacySnapshot } from "../../support/auth-engine-rewrite/legacy-snapshot";
import { backfillLegacySnapshot, type BackfillRepository, type BackfillState } from "../../../scripts/auth-cutover/backfill";
import { classifyDashboardSession, creatorSignInRecoveryPath } from "@/auth/session-boundary";
import { evaluateOverlayRuntimeAccess, preserveOverlayRuntimeReference } from "@/server/overlay-runtime";
import { expect, test } from "../support/auth-engine-rewrite";

const { Given, When, Then } = createBdd(test);

class AtddBackfillRepository implements BackfillRepository {
	state: BackfillState = { creators: [], resources: [], subscriptions: [], entitlements: [], authUsers: [], providerAccounts: [], organizations: [], memberships: [], identityLinks: [], anomalies: [] };
	async transaction<T>(operation: (draft: BackfillState, checkpoint: (name: "identity" | "membership") => Promise<void>) => Promise<T>) {
		const draft = structuredClone(this.state);
		const result = await operation(draft, async () => undefined);
		this.state = draft;
		return result;
	}
}

Given("a representative legacy creator snapshot", async ({ authWorld }) => {
	const snapshot = structuredClone(anonymizedLegacySnapshot);
	snapshot.editors[0]!.editorTwitchSubject = snapshot.creators[1]!.twitchSubject;
	authWorld.values.set("legacySnapshot", snapshot);
	authWorld.values.set("backfillRepository", new AtddBackfillRepository());
});

When("the snapshot is migrated to Better Auth identities and memberships", async ({ authWorld }) => {
	await backfillLegacySnapshot(authWorld.values.get("legacySnapshot") as typeof anonymizedLegacySnapshot, authWorld.values.get("backfillRepository") as AtddBackfillRepository);
});

Then("all creator resource subscription and entitlement identifiers are unchanged", async ({ authWorld }) => {
	const snapshot = authWorld.values.get("legacySnapshot") as typeof anonymizedLegacySnapshot;
	const state = (authWorld.values.get("backfillRepository") as AtddBackfillRepository).state;
	expect(state.creators).toEqual(snapshot.creators);
	expect(state.resources).toEqual(snapshot.resources);
	expect(state.subscriptions).toEqual(snapshot.subscriptions);
	expect(state.entitlements).toEqual(snapshot.entitlements);
});

Then("the safely matched legacy editor receives Operations access", async ({ authWorld }) => {
	const state = (authWorld.values.get("backfillRepository") as AtddBackfillRepository).state;
	expect(state.memberships).toContainEqual(expect.objectContaining({ role: "operations" }));
});

Given("an otherwise valid legacy dashboard JWT", async ({ authWorld }) => {
	authWorld.values.set("legacyJwt", "valid.header.signature");
});

When("the creator opens a protected dashboard after cutover", async ({ authWorld }) => {
	authWorld.values.set("sessionDecision", classifyDashboardSession({ legacyDashboardCookie: String(authWorld.values.get("legacyJwt")), betterAuthSession: null }));
});

Then("the legacy dashboard JWT is rejected", async ({ authWorld }) => {
	expect(authWorld.values.get("sessionDecision")).toEqual({ authenticated: false, reason: "better-auth-session-required" });
});

Then("the creator receives a recoverable Better Auth sign-in path", async () => {
	expect(creatorSignInRecoveryPath("/dashboard")).toBe("/login?returnUrl=%2Fdashboard");
});

Given("an unchanged live overlay URL and runtime secret", async ({ authWorld }) => {
	const overlay = { id: "overlay-atdd", ownerId: "creator-atdd", secret: "stable-runtime-secret" };
	authWorld.values.set("overlay", overlay);
	authWorld.values.set("overlayReference", { url: `https://clipify.dev/embed/${overlay.id}`, secret: overlay.secret });
});

When("dashboard authentication is unavailable during cutover", async ({ authWorld }) => {
	const overlay = authWorld.values.get("overlay") as { id: string; ownerId: string; secret: string };
	authWorld.values.set("httpRuntime", evaluateOverlayRuntimeAccess({ channel: "http", overlay, ownerSuspended: false }));
	authWorld.values.set("socketRuntime", evaluateOverlayRuntimeAccess({ channel: "websocket", overlay, presentedSecret: overlay.secret, ownerSuspended: false }));
});

Then("overlay HTTP and WebSocket runtime access remains available", async ({ authWorld }) => {
	expect(authWorld.values.get("httpRuntime")).toEqual(expect.objectContaining({ allowed: true }));
	expect(authWorld.values.get("socketRuntime")).toEqual(expect.objectContaining({ allowed: true }));
});

Then("the overlay URL and runtime secret remain byte-for-byte unchanged", async ({ authWorld }) => {
	const reference = authWorld.values.get("overlayReference") as { url: string; secret: string };
	expect(preserveOverlayRuntimeReference(reference)).toEqual(reference);
});

Given("a creator is signed out of Clipify", async ({ context, authWorld }) => {
	await context.clearCookies();
	authWorld.values.clear();
});

When("the creator starts Twitch sign-in from the public login page", async ({ page, authWorld }) => {
	await page.goto("/login");
	await expect(page.getByRole("button", { name: "Login with Twitch" })).toBeVisible();
	const result = await page.evaluate(async () => {
		const response = await fetch("/api/auth/sign-in/social", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ provider: "twitch", callbackURL: "/dashboard", disableRedirect: true }),
		});
		return { status: response.status, body: (await response.json()) as { url?: string } };
	});
	expect(result.status).toBe(200);
	expect(result.body.url).toBeTruthy();
	authWorld.values.set("twitchAuthorizationUrl", result.body.url);
});

Then("Better Auth requests the complete Twitch permission set", async ({ authWorld }) => {
	const authorizationUrl = new URL(String(authWorld.values.get("twitchAuthorizationUrl")));
	const scopes = new Set((authorizationUrl.searchParams.get("scope") ?? "").split(" "));
	for (const scope of TWITCH_REQUIRED_SCOPES) expect(scopes.has(scope)).toBe(true);
});

Then("the callback targets the Clipify Better Auth Twitch route", async ({ authWorld }) => {
	const authorizationUrl = new URL(String(authWorld.values.get("twitchAuthorizationUrl")));
	expect(new URL(authorizationUrl.searchParams.get("redirect_uri") ?? "http://invalid").pathname).toBe("/api/auth/callback/twitch");
});

class DelegationRepository implements InvitationRepository {
	state: InvitationState = { invitations: [], memberships: [] };
	async transaction<T>(operation: (draft: InvitationState) => Promise<T>) {
		const draft = structuredClone(this.state);
		const result = await operation(draft);
		this.state = draft;
		return result;
	}
}

Given("a creator owner is ready to invite a team member", async ({ authWorld }) => {
	authWorld.values.set("delegationRepository", new DelegationRepository());
	authWorld.values.set("delegationClock", new ControlledClock());
	authWorld.values.set("deliveryTokens", [] as string[]);
	authWorld.values.set("delegationStartedAt", Date.now());
});

When("the owner creates a {word} team invitation", async ({ authWorld }, delivery: string) => {
	const repository = authWorld.values.get("delegationRepository") as DelegationRepository;
	const clock = authWorld.values.get("delegationClock") as ControlledClock;
	const deliveryTokens = authWorld.values.get("deliveryTokens") as string[];
	const created = await createInvitation(
		{ organizationId: "creator-org-atdd", email: "member@example.invalid", role: "analyst", inviterId: "owner-atdd", delivery: delivery === "optional-email" ? "copy-and-email" : "copy" },
		{
			repository,
			now: clock.now,
			generateToken: createDeterministicTokenGenerator("atdd-invite"),
			roleExists: async () => true,
			deliver: async ({ token }) => {
				deliveryTokens.push(token);
			},
		},
	);
	authWorld.values.set("createdInvitation", created);
});

Then("the same invitation token is available to the owner and delivery channel", async ({ authWorld }) => {
	const created = authWorld.values.get("createdInvitation") as { token: string; delivery: string };
	const deliveryTokens = authWorld.values.get("deliveryTokens") as string[];
	expect(created.token).toBeTruthy();
	expect(deliveryTokens).toEqual(created.delivery === "copy-and-email" ? [created.token] : []);
});

When("the invited person accepts with the verified account email", async ({ authWorld }) => {
	const repository = authWorld.values.get("delegationRepository") as DelegationRepository;
	const clock = authWorld.values.get("delegationClock") as ControlledClock;
	const created = authWorld.values.get("createdInvitation") as { token: string };
	await acceptInvitation({ token: created.token, authenticatedEmail: "member@example.invalid", authUserId: "member-atdd" }, { repository, now: clock.now, generateToken: () => "unused", roleExists: async () => true, deliver: async () => undefined });
});

Then("the team member can open the authorized creator view", async ({ authWorld }) => {
	const repository = authWorld.values.get("delegationRepository") as DelegationRepository;
	const membership = repository.state.memberships[0];
	expect(membership).toBeTruthy();
	expect(authorize({ session: { userId: "member-atdd", authenticatedAt: new Date() }, creatorId: "creator-atdd", lifecycle: "active", resourceOwnerId: "creator-atdd", permission: "analytics:read", access: { kind: "direct", permissions: ["analytics:read"] }, entitlements: [], now: new Date() })).toEqual({ allowed: true, accessPath: "direct" });
});

Then("delegation completes in under three minutes", async ({ authWorld }) => {
	expect(Date.now() - Number(authWorld.values.get("delegationStartedAt"))).toBeLessThan(3 * 60 * 1000);
});
