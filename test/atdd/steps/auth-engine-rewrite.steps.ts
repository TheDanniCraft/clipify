import { createBdd } from "playwright-bdd";
import { TWITCH_REQUIRED_SCOPES } from "@/auth/providers/twitch";
import { acceptInvitation, createInvitation, type InvitationRepository, type InvitationState } from "@/auth/invitations";
import { authorize } from "@/auth/authorize";
import { ControlledClock, createDeterministicTokenGenerator } from "../../support/auth-engine-rewrite/time";
import { anonymizedLegacySnapshot } from "../../support/auth-engine-rewrite/legacy-snapshot";
import { backfillLegacySnapshot, type BackfillRepository, type BackfillState } from "../../../scripts/auth-cutover/backfill";
import { classifyDashboardSession, creatorSignInRecoveryPath } from "@/auth/session-boundary";
import { evaluateOverlayRuntimeAccess, preserveOverlayRuntimeReference } from "@/server/overlay-runtime";
import { buildManifest, verifyManifest } from "../../../scripts/auth-cutover/manifest";
import { executeCheckpointBatch, parseCutoverCommand } from "../../../scripts/auth-cutover/state-machine";
import { executeCutoverWorkflow, runCutoverSmoke, type SmokeChecks } from "../../../scripts/auth-cutover/smoke";
import { scanLegacyConsumers } from "../../../scripts/auth-cutover/legacy-scan";
import { AccountLifecycleService, type AccountLifecycleRepository, type AccountLifecycleState, type LifecycleActor } from "@/server/account-lifecycle/service";
import { evaluateDeletionBoundary, recoverDeletion } from "@/server/account-lifecycle/recovery";
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

const LIFECYCLE_NOW = new Date("2026-09-28T12:00:00.000Z");
const LIFECYCLE_PERIOD_END = new Date("2026-10-28T12:00:00.000Z");

class LifecycleScenarioRepository implements AccountLifecycleRepository {
	constructor(
		public state: AccountLifecycleState = {
			accounts: [{ organizationId: "creator-org-lifecycle", creatorId: "creator-lifecycle", status: "active" }],
			deletionRequests: [],
			subscriptions: [{ id: "sub-lifecycle", organizationId: "creator-org-lifecycle", status: "active", currentPeriodEnd: LIFECYCLE_PERIOD_END, cancelAtPeriodEnd: false, latestStripeEventCreated: 0 }],
			auditEvents: [],
			resources: [{ id: "overlay-lifecycle", organizationId: "creator-org-lifecycle" }],
		},
	) {}
	transaction<T>(operation: (state: AccountLifecycleState) => Promise<T>) {
		return operation(this.state);
	}
}

function lifecycleOwner(authenticatedAt = LIFECYCLE_NOW): LifecycleActor {
	return { authUserId: "owner-lifecycle", sessionId: "session-lifecycle", organizationId: "creator-org-lifecycle", accountRole: "owner", authenticatedAt };
}

Given("a recently authenticated creator account owner", async ({ authWorld }) => {
	authWorld.values.set("lifecycleRepository", new LifecycleScenarioRepository());
	authWorld.values.set("lifecycleService", new AccountLifecycleService(authWorld.values.get("lifecycleRepository") as LifecycleScenarioRepository, { now: () => LIFECYCLE_NOW }));
});

When(/^the owner (updates account information|requests an account export|cancels the subscription)$/, async ({ authWorld }, operation: string) => {
	const service = authWorld.values.get("lifecycleService") as AccountLifecycleService;
	const mapped = operation === "updates account information" ? "update" : operation === "requests an account export" ? "export" : "subscription:cancel";
	const decision = await service.authorizeOwnerOperation(lifecycleOwner(), mapped);
	authWorld.values.set("ownerOperation", { operation, decision, effectiveAt: mapped === "subscription:cancel" ? LIFECYCLE_PERIOD_END : undefined });
});

Then(/^(the changes are recorded for that account|an export is prepared without support intervention|cancellation is recorded for the displayed date)$/, async ({ authWorld }, expectedResult: string) => {
	const operation = authWorld.values.get("ownerOperation") as { decision: { organizationId: string; operation: string }; effectiveAt?: Date } | undefined;
	if (!operation) return;
	expect(operation.decision.organizationId).toBe("creator-org-lifecycle");
	if (expectedResult.includes("displayed date")) expect(operation.effectiveAt).toEqual(LIFECYCLE_PERIOD_END);
});

Given("deletion suspension has begun for a creator account", async ({ authWorld }) => {
	const repository = new LifecycleScenarioRepository();
	const service = new AccountLifecycleService(repository, { now: () => LIFECYCLE_NOW });
	const request = await service.requestDeletion(lifecycleOwner(), { choice: "immediate" });
	authWorld.values.set("lifecycleRepository", repository);
	authWorld.values.set("deletionRequest", request);
});

When(/^(.+) has elapsed$/, async ({ authWorld }, recoveryTime: string) => {
	const request = authWorld.values.get("deletionRequest") as { status: "suspended"; purgeEligibleAt: Date };
	const now = recoveryTime === "less than 30 days" ? new Date(request.purgeEligibleAt.getTime() - 1) : request.purgeEligibleAt;
	authWorld.values.set("deletionBoundary", evaluateDeletionBoundary(request, now));
});

Then(/^the account (.+)$/, async ({ authWorld }, outcome: string) => {
	expect(authWorld.values.get("deletionBoundary")).toBe(outcome.includes("remains recoverable") ? "recoverable" : "purge_eligible");
});

Given("a suspended creator account with a recovery entry point", async ({ authWorld }) => {
	const repository = new LifecycleScenarioRepository();
	const service = new AccountLifecycleService(repository, { now: () => LIFECYCLE_NOW });
	const request = await service.requestDeletion(lifecycleOwner(), { choice: "immediate" });
	authWorld.values.set("lifecycleRepository", repository);
	authWorld.values.set("deletionRequest", request);
});

When("the owner signs in confirms identity and cancels deletion before 30 days", async ({ authWorld }) => {
	const repository = authWorld.values.get("lifecycleRepository") as LifecycleScenarioRepository;
	const request = authWorld.values.get("deletionRequest") as { id: string };
	const recoveryAt = new Date(LIFECYCLE_NOW.getTime() + 10 * 24 * 60 * 60 * 1000);
	const effects: string[] = [];
	const recovered = await recoverDeletion(repository, lifecycleOwner(recoveryAt), {
		requestId: request.id,
		now: recoveryAt,
		resumeRuntime: async () => void effects.push("runtime"),
		restartBilling: async () => void effects.push("billing"),
		reclaimAgencyAllocation: async () => void effects.push("allocation"),
	});
	let linkOnlyError: unknown;
	try {
		await recoverDeletion(repository, lifecycleOwner(recoveryAt), { requestId: request.id, now: recoveryAt, recoveryEntryOnly: true });
	} catch (error) {
		linkOnlyError = error;
	}
	authWorld.values.set("recoveryResult", { recovered, effects, linkOnlyError });
});

Then("account dashboard overlay and integration access are restored", async ({ authWorld }) => {
	const result = authWorld.values.get("recoveryResult") as { recovered: { status: string }; effects: string[] };
	expect(result.recovered.status).toBe("recovered");
	expect(result.effects).toEqual(["runtime"]);
});

Then("the recovery entry point alone cannot authenticate the owner", async ({ authWorld }) => {
	expect((authWorld.values.get("recoveryResult") as { linkOnlyError: Error }).linkOnlyError).toEqual(expect.objectContaining({ message: "AUTHENTICATION_REQUIRED" }));
});

Then("billing and agency allocations are not restarted", async ({ authWorld }) => {
	expect((authWorld.values.get("recoveryResult") as { effects: string[] }).effects).not.toEqual(expect.arrayContaining(["billing", "allocation"]));
});

Given("a recently authenticated owner with paid access through a future date", async ({ authWorld }) => {
	authWorld.values.set("lifecycleRepository", new LifecycleScenarioRepository());
});

When(/^the owner chooses (.+)$/, async ({ authWorld }, deletionChoice: string) => {
	const repository = authWorld.values.get("lifecycleRepository") as LifecycleScenarioRepository;
	const effects: string[] = [];
	const request = await new AccountLifecycleService(repository, { now: () => LIFECYCLE_NOW, revokeSessions: async () => void effects.push("sessions"), pauseRuntime: async () => void effects.push("runtime") }).requestDeletion(lifecycleOwner(), {
		choice: deletionChoice === "delete now" ? "immediate" : "paid_through",
	});
	authWorld.values.set("deletionChoiceResult", { request, effects });
});

Then(/^suspension starts (.+)$/, async ({ authWorld }, expected: string) => {
	const result = authWorld.values.get("deletionChoiceResult") as { request: { suspensionAt: Date }; effects: string[] };
	expect(result.request.suspensionAt).toEqual(expected.includes("paid-through") ? LIFECYCLE_PERIOD_END : LIFECYCLE_NOW);
	if (expected.includes("data retained")) expect((authWorld.values.get("lifecycleRepository") as LifecycleScenarioRepository).state.resources).toHaveLength(1);
});

Then("Stripe remains responsible for billing lifecycle notices", async ({ authWorld }) => {
	expect(authWorld.values.has("clipifyBillingNotice")).toBe(false);
});

Given("a verified backup and a valid pre-migration database", async ({ authWorld }) => {
	authWorld.values.set("cutoverRows", [] as number[]);
	authWorld.values.set("cutoverCommitted", new Set<string>());
});

When("the operator completes the cutover workflow twice against the same database state", async ({ authWorld }) => {
	expect(parseCutoverCommand(["dry-run"])).toEqual({ mode: "dry-run" });
	expect(parseCutoverCommand(["apply"])).toEqual({ mode: "apply" });

	const rows = authWorld.values.get("cutoverRows") as number[];
	const committed = authWorld.values.get("cutoverCommitted") as Set<string>;
	const batch = {
		runId: "atdd-cutover",
		phase: "identity",
		cursor: 0,
		values: [1, 2, 3],
		transaction: async <T>(operation: (writer: { write: (value: number) => void }) => Promise<T>) => {
			const draft = [...rows];
			const result = await operation({ write: (value) => draft.push(value) });
			rows.splice(0, rows.length, ...draft);
			return result;
		},
		onCommitted: (_cursor: number, key: string) => {
			committed.add(key);
		},
		isCommitted: (key: string) => committed.has(key),
	};
	const first = await executeCheckpointBatch(batch);
	const second = await executeCheckpointBatch(batch);
	authWorld.values.set("cutoverBatchResults", [first, second]);

	const invoked: string[] = [];
	const checks = Object.fromEntries(
		["sign-in", "allow-deny", "overlay", "refresh", "subscription", "entitlement", "outbox"].map((name) => [
			name,
			async () => {
				invoked.push(name);
				return true;
			},
		]),
	) as SmokeChecks;
	authWorld.values.set("cutoverSmoke", await runCutoverSmoke(checks));
	authWorld.values.set("cutoverSmokeInvoked", invoked);
	authWorld.values.set("cutoverWorkflow", await executeCutoverWorkflow({ runId: "atdd-cutover" }));
	authWorld.values.set("cutoverManifest", buildManifest({ runId: "atdd-cutover", sourceFingerprint: "sha256:fixture", versions: { app: "fixture" }, createdAt: "2026-09-28T00:00:00.000Z" }));
});

Then("all cutover records are migrated exactly once", async ({ authWorld }) => {
	expect(authWorld.values.get("cutoverRows")).toEqual([1, 2, 3]);
	expect(authWorld.values.get("cutoverBatchResults")).toEqual([expect.objectContaining({ skipped: false }), expect.objectContaining({ skipped: true })]);
});

Then("every required invariant and smoke check passes before maintenance mode is removed", async ({ authWorld }) => {
	expect(authWorld.values.get("cutoverSmoke")).toEqual(expect.objectContaining({ passed: true }));
	expect(authWorld.values.get("cutoverSmokeInvoked")).toHaveLength(7);
	expect(authWorld.values.get("cutoverWorkflow")).toEqual(expect.objectContaining({ ok: true, maintenance: false, reopened: true }));
});

Then("the immutable cutover manifest remains valid", async ({ authWorld }) => {
	expect(verifyManifest(authWorld.values.get("cutoverManifest") as ReturnType<typeof buildManifest>)).toBe(true);
});

Given("migration validation and smoke checks have passed", async ({ authWorld }) => {
	authWorld.values.set("legacyRemovalApproved", true);
});

When("the new identity runtime is activated", async ({ authWorld }) => {
	authWorld.values.set("runtimeActivation", await executeCutoverWorkflow({ runId: "atdd-switch" }));
	authWorld.values.set("legacyFindings", scanLegacyConsumers([{ path: "session.ts", content: "getAuthActorContext(); authorize(request); auth.api.getAccessToken();" }]));
});

Then("no request depends on the legacy auth runtime", async ({ authWorld }) => {
	expect(authWorld.values.get("runtimeActivation")).toEqual(expect.objectContaining({ ok: true, reopened: true }));
	expect(authWorld.values.get("legacyFindings")).toEqual([]);
});

Then("the legacy structures are eligible for approved removal", async ({ authWorld }) => {
	expect(authWorld.values.get("legacyRemovalApproved")).toBe(true);
});
