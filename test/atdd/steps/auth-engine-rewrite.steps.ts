import { createBdd } from "playwright-bdd";
import type { Page } from "@playwright/test";
import { TWITCH_REQUIRED_SCOPES } from "@/auth/providers/twitch";
import { acceptInvitation, createInvitation, type InvitationRepository, type InvitationState } from "@/auth/invitations";
import { authorize } from "@/auth/authorize";
import { ControlledClock, createDeterministicTokenGenerator } from "../../support/auth-engine-rewrite/time";
import { evaluateOverlayRuntimeAccess, preserveOverlayRuntimeReference } from "@/server/overlay-runtime";
import { AccountLifecycleService, type AccountLifecycleRepository, type AccountLifecycleState, type LifecycleActor } from "@/server/account-lifecycle/service";
import { evaluateDeletionBoundary, recoverDeletion } from "@/server/account-lifecycle/recovery";
import { AgencyService, createAgencyState } from "@/server/agencies/service";
import { AgencyAllocationService, createAllocationState } from "@/server/agencies/allocations";
import { resolveAgencyAccess } from "@/server/agencies/access";
import { createAuthenticatedFixture, expect, test, type AuthFixture } from "../support/auth-engine-rewrite";

const { Given, When, Then } = createBdd(test);

const AGENCY_ATDD_NOW = new Date("2026-09-28T12:00:00.000Z");
const DATABASE_ACTION_TIMEOUT_MS = 90_000;

async function prepareInteractivePage(page: Page) {
	await page.waitForLoadState("networkidle", { timeout: 30_000 });
	const reject = page.getByRole("button", { name: "Reject optional" });
	if (await reject.isVisible()) {
		const persisted = page.waitForResponse((response) => response.url().includes("/api/c15t/subjects") && response.request().method() === "POST" && response.ok());
		const refreshed = page.waitForNavigation({ waitUntil: "networkidle", timeout: 30_000 });
		await reject.click();
		await Promise.all([persisted, refreshed]);
	}
}

Given("a Clipify administrator provisioned an Agency Account after custom commercial terms were agreed", async ({ page, request, context, authWorld }) => {
	const fixture = await createAuthenticatedFixture(request, context, { actorRole: "admin", deletionState: "none" });
	const agencyName = `E2E ATDD Agency ${fixture.fixture.authUserId.slice(-8)}`;
	await page.goto("/admin/agencies");
	await expect(page.getByRole("heading", { name: "Agency accounts" })).toBeVisible({ timeout: 30_000 });
	await prepareInteractivePage(page);
	await page.getByLabel("Agency name").fill(agencyName);
	await page.getByLabel("First owner email").fill(`e2e-agency-owner-${fixture.fixture.authUserId.slice(-8)}@example.invalid`);
	await page.getByLabel("Commercial reference").fill("e2e-atdd-contract");
	await page.getByLabel("Creator seats").fill("2");
	await page.getByRole("button", { name: "Provision and invite owner" }).click();
	await expect(page.getByText("Agency invitation created.", { exact: true })).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
	await expect(page.getByText(agencyName, { exact: false })).toBeVisible();
	const state = createAgencyState();
	const service = new AgencyService(
		state,
		() => AGENCY_ATDD_NOW,
		() => "agency-atdd",
	);
	await service.provision({ actor: { authUserId: "admin-atdd", organizationId: null, role: "platform-admin" }, name: "ATDD Agency", ownerEmail: "owner@example.invalid", commercialReference: "custom-contract" });
	authWorld.values.set("agencyState", state);
	authWorld.values.set("agencyService", service);
});

When("its designated first owner verifies the invited email and accepts the invitation", async ({ authWorld }) => {
	await (authWorld.values.get("agencyService") as AgencyService).activateFirstOwner({ agencyOrganizationId: "agency-atdd", authUserId: "agency-owner-atdd", verifiedEmail: "owner@example.invalid" });
});

Then("the person becomes the Agency Account owner", async ({ authWorld }) => {
	const state = authWorld.values.get("agencyState") as ReturnType<typeof createAgencyState>;
	expect(state.memberships).toContainEqual(expect.objectContaining({ organizationId: "agency-atdd", authUserId: "agency-owner-atdd", role: "owner" }));
});

Then("the owner can sign in by email code without connecting Twitch", async ({ authWorld }) => {
	const state = authWorld.values.get("agencyState") as ReturnType<typeof createAgencyState>;
	expect(state.accounts[0]).toMatchObject({ status: "active" });
	expect(state.memberships[0]?.authUserId).toBe("agency-owner-atdd");
});

Given("an agency requests access to an independent Creator Account with one staff member authorized by an agency role", async ({ request, context, authWorld }) => {
	const fixture = await createAuthenticatedFixture(request, context, { agencyLinkStatus: "proposed", deletionState: "none" });
	authWorld.values.set("realAgencyFixture", fixture);
	const state = createAgencyState({ accounts: [{ organizationId: "agency-atdd", name: "ATDD Agency", status: "active", commercialReference: "custom-contract", provisionedBy: "admin-atdd", createdAt: AGENCY_ATDD_NOW, updatedAt: AGENCY_ATDD_NOW }] });
	const service = new AgencyService(
		state,
		() => AGENCY_ATDD_NOW,
		() => "link-atdd",
	);
	await service.proposeLink({ actor: { authUserId: "agency-owner-atdd", organizationId: "agency-atdd", role: "owner" }, creatorOrganizationId: "creator-atdd", permissionCeiling: ["overlay:read", "overlay:delete"] });
	authWorld.values.set("agencyState", state);
	authWorld.values.set("agencyService", service);
	authWorld.values.set("agencyRolePermissions", ["overlay:read", "overlay:delete"]);
	authWorld.values.set("creatorOwner", "creator-owner-atdd");
});

When("the creator owner accepts the request with a creator-approved permission set", async ({ page, authWorld }) => {
	await (authWorld.values.get("agencyService") as AgencyService).acceptLink({ actor: { authUserId: "creator-owner-atdd", organizationId: "creator-atdd", role: "owner" }, linkId: "link-atdd", permissionCeiling: ["overlay:read"] });
	await page.goto("/dashboard/settings/agencies");
	await expect(page.getByRole("heading", { name: "Agency access" })).toBeVisible({ timeout: 30_000 });
	await prepareInteractivePage(page);
	await page.getByRole("button", { name: "Approve agency access" }).click();
	await expect(page.getByText("accepted", { exact: true })).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
});

Then("the staff member can manage the creator only through permissions present in both sets", async ({ authWorld }) => {
	const state = authWorld.values.get("agencyState") as ReturnType<typeof createAgencyState>;
	expect(resolveAgencyAccess({ membershipActive: true, linkStatus: state.links[0]?.status ?? null, rolePermissions: authWorld.values.get("agencyRolePermissions") as ["overlay:read", "overlay:delete"], permissionCeiling: state.links[0]?.permissionCeiling ?? [] })).toEqual(["overlay:read"]);
});

Then("the creator owner remains the owner", async ({ authWorld }) => {
	expect(authWorld.values.get("creatorOwner")).toBe("creator-owner-atdd");
});

Given("an agency has an available paid creator license and an accepted creator link", async ({ request, context, authWorld }) => {
	const fixture = await createAuthenticatedFixture(request, context, { activeContext: "agency", agencyLinkStatus: "accepted", deletionState: "none" });
	authWorld.values.set("realAgencyFixture", fixture);
	const state = createAllocationState({ seatLimit: 1, memberCount: 25, acceptedLinkIds: ["link-atdd"] });
	authWorld.values.set("allocationState", state);
	authWorld.values.set(
		"allocationService",
		new AgencyAllocationService(
			state,
			() => AGENCY_ATDD_NOW,
			() => "allocation-atdd",
		),
	);
});

When("the agency allocates the license to that creator", async ({ page, authWorld }) => {
	await (authWorld.values.get("allocationService") as AgencyAllocationService).allocate({ linkId: "link-atdd", creatorId: "creator-atdd", sourceReference: "custom-contract" });
	const fixture = authWorld.values.get("realAgencyFixture") as { fixture: { creatorOrganizationId: string } };
	await page.goto(`/dashboard/agency?creator=${encodeURIComponent(fixture.fixture.creatorOrganizationId)}`);
	await expect(page.getByRole("heading", { name: "Creator management" })).toBeVisible({ timeout: 30_000 });
	await prepareInteractivePage(page);
	await page.getByPlaceholder("Commercial allocation reference").fill("e2e-atdd-allocation");
	await page.getByRole("button", { name: "Allocate Pro seat" }).click();
	await expect(page.getByText("Creator license allocated.", { exact: true })).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
	await expect(page.getByText("1 of 2 creator seats occupied.", { exact: false })).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
});

Then("the creator receives the agency-funded capabilities", async ({ authWorld }) => {
	expect((authWorld.values.get("allocationService") as AgencyAllocationService).hasAgencyBenefit("creator-atdd")).toBe(true);
});

Then("creator and agency team members do not consume additional creator licenses", async ({ authWorld }) => {
	expect((authWorld.values.get("allocationService") as AgencyAllocationService).occupiedSeats()).toBe(1);
});

Then("the creator receives one transactional allocation notice", async ({ authWorld }) => {
	const state = authWorld.values.get("allocationState") as ReturnType<typeof createAllocationState>;
	expect(state.notifications.filter((notice) => notice.type === "granted")).toHaveLength(1);
});

Given("an unchanged live overlay URL and runtime secret", async ({ authWorld }) => {
	const overlay = { id: "overlay-atdd", ownerId: "creator-atdd", secret: "stable-runtime-secret" };
	authWorld.values.set("overlay", overlay);
	authWorld.values.set("overlayReference", { url: `https://clipify.us/embed/${overlay.id}`, secret: overlay.secret });
});

When("the creator is signed out of the dashboard", async ({ authWorld }) => {
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

Then("a database-backed Better Auth session opens the creator dashboard", async ({ page, request, context }) => {
	const fixture = await createAuthenticatedFixture(request, context);
	try {
		await page.goto(`/dashboard/settings/team?organization=${encodeURIComponent(fixture.fixture.creatorOrganizationId)}`);
		await expect(page.getByRole("heading", { name: "Team members" })).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText("E2E Creator Account", { exact: false })).toBeVisible({ timeout: 30_000 });
	} finally {
		await page.close();
	}
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

Given("a recently authenticated creator account owner", async ({ request, context, authWorld }) => {
	const fixture = await createAuthenticatedFixture(request, context, { deletionState: "none", billingState: "active" });
	authWorld.values.set("realLifecycleFixture", fixture);
	authWorld.values.set("lifecycleRepository", new LifecycleScenarioRepository());
	authWorld.values.set("lifecycleService", new AccountLifecycleService(authWorld.values.get("lifecycleRepository") as LifecycleScenarioRepository, { now: () => LIFECYCLE_NOW }));
});

When(/^the owner (updates account information|requests an account export|cancels the subscription)$/, async ({ page, authWorld }, operation: string) => {
	const service = authWorld.values.get("lifecycleService") as AccountLifecycleService;
	const mapped = operation === "updates account information" ? "update" : operation === "requests an account export" ? "export" : "subscription:cancel";
	const decision = await service.authorizeOwnerOperation(lifecycleOwner(), mapped);
	await page.goto("/dashboard/settings");
	await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 30_000 });
	await prepareInteractivePage(page);
	if (operation === "updates account information") {
		await page.getByRole("tab", { name: "Creator Page" }).click();
		const creatorPageSwitch = page.getByRole("switch", { name: "Enable creator page" });
		await expect(creatorPageSwitch).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
		await expect(creatorPageSwitch).toBeEnabled({ timeout: DATABASE_ACTION_TIMEOUT_MS });
		await creatorPageSwitch.setChecked(false, { force: true });
		await expect(creatorPageSwitch).not.toBeChecked();
		const saveCreatorPage = page.getByRole("button", { name: "Save Creator Page Settings" });
		await expect(saveCreatorPage).toBeEnabled();
		await saveCreatorPage.click();
		await expect(page.getByText("Settings saved", { exact: true })).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
	} else if (operation === "requests an account export") {
		const downloadStarted = page.waitForEvent("download");
		await page.getByRole("button", { name: "Export Account Data" }).click();
		const download = await downloadStarted;
		expect(download.suggestedFilename()).toContain("clipify-account-");
	} else {
		await page.getByRole("tab", { name: "Billing" }).click();
		const pro = page.getByRole("checkbox", { name: "Pro" });
		await expect(pro).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
		await pro.setChecked(false, { force: true });
		await expect(pro).not.toBeChecked();
		const saveChanges = page.getByRole("button", { name: "Save changes", exact: true });
		await expect(saveChanges).toBeEnabled();
		await saveChanges.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog.getByRole("heading", { name: "Review subscription changes" })).toBeVisible();
		await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
		await expect(page.getByText("Changes saved", { exact: true })).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
	}
	authWorld.values.set("ownerOperation", { operation, decision, effectiveAt: mapped === "subscription:cancel" ? LIFECYCLE_PERIOD_END : undefined });
});

Then(/^(the changes are recorded for that account|an export is prepared without support intervention|cancellation is recorded for the displayed date)$/, async ({ authWorld }, expectedResult: string) => {
	const operation = authWorld.values.get("ownerOperation") as { decision: { organizationId: string; operation: string }; effectiveAt?: Date } | undefined;
	if (!operation) return;
	expect(operation.decision.organizationId).toBe("creator-org-lifecycle");
	if (expectedResult.includes("displayed date")) expect(operation.effectiveAt).toEqual(LIFECYCLE_PERIOD_END);
});

Given("deletion suspension has begun for a creator account", async ({ request, context, authWorld }) => {
	const fixture = await createAuthenticatedFixture(request, context, { deletionState: "suspended" });
	authWorld.values.set("realLifecycleFixture", fixture);
	const repository = new LifecycleScenarioRepository();
	const service = new AccountLifecycleService(repository, { now: () => LIFECYCLE_NOW });
	const domainRequest = await service.requestDeletion(lifecycleOwner(), { choice: "immediate" });
	authWorld.values.set("lifecycleRepository", repository);
	authWorld.values.set("deletionRequest", domainRequest);
});

When(/^(.+) has elapsed$/, async ({ page, request, authWorld }, recoveryTime: string) => {
	const deletionRequest = authWorld.values.get("deletionRequest") as { status: "suspended"; purgeEligibleAt: Date };
	const now = recoveryTime === "less than 30 days" ? new Date(deletionRequest.purgeEligibleAt.getTime() - 1) : deletionRequest.purgeEligibleAt;
	authWorld.values.set("deletionBoundary", evaluateDeletionBoundary(deletionRequest, now));
	const fixture = authWorld.values.get("realLifecycleFixture") as AuthFixture;
	if (recoveryTime === "at least 30 days") {
		const adjusted = await request.patch("/api/test/auth-fixture", { headers: { Authorization: "Bearer clipify-playwright-auth-fixture" }, data: { deletionRequestId: fixture.fixture.deletionRequestId, deletionBoundary: "expired" } });
		expect(adjusted.ok(), await adjusted.text()).toBe(true);
	}
	await page.goto("/dashboard/settings/account/recovery");
	await expect(page.getByRole("heading", { name: "Account suspended pending deletion" })).toBeVisible({ timeout: 30_000 });
	await prepareInteractivePage(page);
	authWorld.values.set("realDeletionBoundary", {
		recoverable: await page.getByRole("button", { name: "Recover my account" }).isVisible(),
		ended: await page.getByText("Recovery period ended", { exact: false }).isVisible(),
	});
});

Then(/^the account (.+)$/, async ({ authWorld }, outcome: string) => {
	expect(authWorld.values.get("deletionBoundary")).toBe(outcome.includes("remains recoverable") ? "recoverable" : "purge_eligible");
	const real = authWorld.values.get("realDeletionBoundary") as { recoverable: boolean; ended: boolean };
	expect(real.recoverable).toBe(outcome.includes("remains recoverable"));
	expect(real.ended).toBe(outcome.includes("eligible for permanent erasure"));
});

Given("a suspended creator account with a recovery entry point", async ({ request, context, authWorld }) => {
	const fixture = await createAuthenticatedFixture(request, context, { deletionState: "suspended" });
	authWorld.values.set("realLifecycleFixture", fixture);
	const repository = new LifecycleScenarioRepository();
	const service = new AccountLifecycleService(repository, { now: () => LIFECYCLE_NOW });
	const domainRequest = await service.requestDeletion(lifecycleOwner(), { choice: "immediate" });
	authWorld.values.set("lifecycleRepository", repository);
	authWorld.values.set("deletionRequest", domainRequest);
});

When("the owner signs in confirms identity and cancels deletion before 30 days", async ({ page, authWorld }) => {
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
	await page.goto("/dashboard/settings/account/recovery");
	await expect(page.getByRole("heading", { name: "Account suspended pending deletion" })).toBeVisible({ timeout: 30_000 });
	await prepareInteractivePage(page);
	await page.getByRole("button", { name: "Recover my account" }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: DATABASE_ACTION_TIMEOUT_MS });
	authWorld.values.set("realRecoveryCompleted", true);
});

Then("account dashboard overlay and integration access are restored", async ({ authWorld }) => {
	const result = authWorld.values.get("recoveryResult") as { recovered: { status: string }; effects: string[] };
	expect(result.recovered.status).toBe("recovered");
	expect(result.effects).toEqual(["runtime"]);
	expect(authWorld.values.get("realRecoveryCompleted")).toBe(true);
});

Then("the recovery entry point alone cannot authenticate the owner", async ({ authWorld }) => {
	expect((authWorld.values.get("recoveryResult") as { linkOnlyError: Error }).linkOnlyError).toEqual(expect.objectContaining({ message: "AUTHENTICATION_REQUIRED" }));
});

Then("billing and agency allocations are not restarted", async ({ authWorld }) => {
	expect((authWorld.values.get("recoveryResult") as { effects: string[] }).effects).not.toEqual(expect.arrayContaining(["billing", "allocation"]));
});

Given("a recently authenticated owner with paid access through a future date", async ({ request, context, authWorld }) => {
	const fixture = await createAuthenticatedFixture(request, context, { deletionState: "none", billingState: "active" });
	authWorld.values.set("realLifecycleFixture", fixture);
	authWorld.values.set("lifecycleRepository", new LifecycleScenarioRepository());
});

When(/^the owner chooses (.+)$/, async ({ page, authWorld }, deletionChoice: string) => {
	const repository = authWorld.values.get("lifecycleRepository") as LifecycleScenarioRepository;
	const effects: string[] = [];
	const request = await new AccountLifecycleService(repository, { now: () => LIFECYCLE_NOW, revokeSessions: async () => void effects.push("sessions"), pauseRuntime: async () => void effects.push("runtime") }).requestDeletion(lifecycleOwner(), {
		choice: deletionChoice === "delete now" ? "immediate" : "paid_through",
	});
	const fixture = authWorld.values.get("realLifecycleFixture") as AuthFixture;
	const username = fixture.fixture.username;
	await page.goto("/dashboard/settings");
	await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 30_000 });
	await prepareInteractivePage(page);
	await page.getByRole("button", { name: "Schedule Account Deletion" }).click();
	const dialog = page.getByRole("dialog");
	if (deletionChoice === "delete now") await dialog.getByRole("button", { name: "Suspend now" }).click();
	await dialog.getByPlaceholder(username).fill(username);
	await dialog.getByRole("button", { name: deletionChoice === "delete now" ? "Delete after confirmation" : "Schedule deletion" }).click();
	if (deletionChoice === "delete now") await expect(page).toHaveURL(/\/login\?returnUrl=/, { timeout: DATABASE_ACTION_TIMEOUT_MS });
	else await expect(page.getByText("Deletion scheduled", { exact: true })).toBeVisible({ timeout: DATABASE_ACTION_TIMEOUT_MS });
	authWorld.values.set("realDeletionChoiceCompleted", true);
	authWorld.values.set("deletionChoiceResult", { request, effects });
});

Then(/^suspension starts (.+)$/, async ({ authWorld }, expected: string) => {
	const result = authWorld.values.get("deletionChoiceResult") as { request: { suspensionAt: Date }; effects: string[] };
	expect(result.request.suspensionAt).toEqual(expected.includes("paid-through") ? LIFECYCLE_PERIOD_END : LIFECYCLE_NOW);
	if (expected.includes("data retained")) expect((authWorld.values.get("lifecycleRepository") as LifecycleScenarioRepository).state.resources).toHaveLength(1);
	expect(authWorld.values.get("realDeletionChoiceCompleted")).toBe(true);
});

Then("Stripe remains responsible for billing lifecycle notices", async ({ authWorld }) => {
	expect(authWorld.values.has("clipifyBillingNotice")).toBe(false);
});
