/* istanbul ignore file -- exercised only by the real Playwright server against an isolated test database. */
import { createHmac, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { account, member, organization, user as authUser } from "@/db/auth-schema";
import { accountDeletionRequestsTable, agencyAccountsTable, agencyCreatorLinksTable, auditEventsTable, billingSubscriptionItemsTable, billingSubscriptionsTable, creatorAccountsTable, creatorIdentityLinksTable, notificationOutboxTable, overlaysTable, playlistClipsTable, playlistsTable, usersTable } from "@/db/schema";
import { BillingProduct, OverlayType, Plan, Role, StatusOptions } from "@types";

const FIXTURE_AUTHORIZATION = "Bearer clipify-playwright-auth-fixture";

type FixtureContext = "creator" | "agency";
type FixtureActorRole = "user" | "admin";
type FixtureDeletionState = "none" | "suspended";
type FixtureAgencyLinkStatus = "proposed" | "accepted";
type FixtureBillingState = "none" | "active";

function fixtureRequestAllowed(request: Request) {
	if (process.env.APP_ENV !== "test" || process.env.E2E_TEST_MODE !== "true") return false;
	const url = new URL(request.url);
	return (url.hostname === "127.0.0.1" || url.hostname === "localhost") && request.headers.get("authorization") === FIXTURE_AUTHORIZATION;
}

function signedCookieValue(value: string, secret: string) {
	return `${value}.${createHmac("sha256", secret).update(value).digest("base64")}`;
}

export async function POST(request: Request) {
	if (!fixtureRequestAllowed(request)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
	const body = (await request.json().catch(() => ({}))) as { activeContext?: FixtureContext; actorRole?: FixtureActorRole; deletionState?: FixtureDeletionState; agencyLinkStatus?: FixtureAgencyLinkStatus; billingState?: FixtureBillingState; withPlaylist?: boolean; withProviderCredentials?: boolean; withPlaylistItems?: boolean; withSecondOverlay?: boolean };
	const activeContext: FixtureContext = body.activeContext === "agency" ? "agency" : "creator";
	const actorRole: FixtureActorRole = body.actorRole === "admin" ? "admin" : "user";
	const deletionState: FixtureDeletionState = body.deletionState === "suspended" ? "suspended" : "none";
	const agencyLinkStatus: FixtureAgencyLinkStatus = body.agencyLinkStatus === "proposed" ? "proposed" : "accepted";
	const billingState: FixtureBillingState = body.billingState === "active" ? "active" : "none";
	const fixtureId = randomUUID();
	const authUserId = `e2e-auth-${fixtureId}`;
	const creatorId = `e2e-creator-${fixtureId}`;
	const creatorOrganizationId = `e2e-creator-org-${fixtureId}`;
	const agencyOrganizationId = `e2e-agency-org-${fixtureId}`;
	const overlayId = randomUUID();
	const secondOverlayId = body.withSecondOverlay === true ? randomUUID() : null;
	const playlistId = body.withPlaylist === true ? randomUUID() : null;
	const deletionRequestId = randomUUID();
	const agencyLinkId = randomUUID();
	const billingSubscriptionId = `e2e-sub-${fixtureId}`;
	const username = `e2e_${fixtureId.replaceAll("-", "").slice(0, 12)}`;
	const now = new Date();
	const purgeEligibleAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
	const billingCurrentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

	await db.transaction(async (tx) => {
		await tx.insert(authUser).values({ id: authUserId, name: "Clipify E2E Owner", email: `e2e-${fixtureId}@example.invalid`, emailVerified: true, createdAt: now, updatedAt: now });
		await tx.insert(usersTable).values({ id: creatorId, email: `e2e-${fixtureId}@example.invalid`, username, avatar: "https://example.invalid/e2e-avatar.png", role: actorRole === "admin" ? Role.Admin : Role.User, plan: Plan.Pro, createdAt: now, updatedAt: now, lastLogin: now });
		await tx.insert(organization).values([
			{ id: creatorOrganizationId, name: "E2E Creator Account", slug: `e2e-creator-${fixtureId}`, createdAt: now, metadata: JSON.stringify({ accountType: "creator" }) },
			{ id: agencyOrganizationId, name: "E2E Agency Account", slug: `e2e-agency-${fixtureId}`, createdAt: now, metadata: JSON.stringify({ accountType: "agency" }) },
		]);
		await tx.insert(member).values([
			{ id: `e2e-creator-member-${fixtureId}`, organizationId: creatorOrganizationId, userId: authUserId, role: "owner", createdAt: now },
			{ id: `e2e-agency-member-${fixtureId}`, organizationId: agencyOrganizationId, userId: authUserId, role: "owner", createdAt: now },
		]);
		await tx.insert(creatorAccountsTable).values({ organizationId: creatorOrganizationId, creatorId, status: deletionState === "suspended" ? "suspended" : "active", suspensionAt: deletionState === "suspended" ? now : null, purgeEligibleAt: deletionState === "suspended" ? purgeEligibleAt : null, createdAt: now, updatedAt: now });
		if (playlistId) {
			await tx.insert(playlistsTable).values({ id: playlistId, ownerId: creatorId, name: "Browser playlist" });
			if (body.withPlaylistItems === true) await tx.insert(playlistClipsTable).values(["ClipFirst", "ClipSecond"].map((id, position) => ({ playlistId, clipId: id, position, clipData: JSON.stringify({ id, title: id, duration: 10, thumbnail_url: "https://example.invalid/clip.png", broadcaster_id: creatorId, created_at: now.toISOString() }) })));
		}
		await tx.insert(creatorIdentityLinksTable).values({ creatorId, authUserId, source: "admin_repair", createdAt: now, updatedAt: now });
		await tx.insert(agencyAccountsTable).values({ organizationId: agencyOrganizationId, status: "active", commercialReference: "e2e-commercial-reference", creatorSeatLimit: 2, provisionedBy: authUserId, createdAt: now, updatedAt: now });
		await tx.insert(agencyCreatorLinksTable).values({ id: agencyLinkId, agencyOrganizationId, creatorOrganizationId, status: agencyLinkStatus, permissionCeiling: ["overlay:read", "analytics:read"], proposedBy: authUserId, proposedAt: now, acceptedBy: agencyLinkStatus === "accepted" ? authUserId : null, acceptedAt: agencyLinkStatus === "accepted" ? now : null, createdAt: now, updatedAt: now });
		if (deletionState === "suspended") await tx.insert(accountDeletionRequestsTable).values({ id: deletionRequestId, organizationId: creatorOrganizationId, choice: "immediate", status: "suspended", requestedBy: authUserId, requestedAt: now, suspensionAt: now, suspendedAt: now, purgeEligibleAt, stripeSnapshot: {}, version: 1, createdAt: now, updatedAt: now });
		if (billingState === "active") {
			await tx.insert(billingSubscriptionsTable).values({ id: billingSubscriptionId, userId: creatorId, stripeCustomerId: `e2e-customer-${fixtureId}`, status: "active", currentPeriodStart: now, currentPeriodEnd: billingCurrentPeriodEnd, cancelAtPeriodEnd: false, createdAt: now, updatedAt: now });
			await tx.insert(billingSubscriptionItemsTable).values({ id: `e2e-item-${fixtureId}`, subscriptionId: billingSubscriptionId, productKey: BillingProduct.Pro, stripeProductId: "e2e-product-pro", stripePriceId: "e2e-price-pro-monthly", unitAmount: 900, currency: "eur", billingInterval: "month", quantity: 1, createdAt: now, updatedAt: now });
		}
		await tx.insert(overlaysTable).values({ id: overlayId, ownerId: creatorId, secret: `e2e-secret-${fixtureId}`, name: "E2E continuity overlay", status: deletionState === "suspended" ? StatusOptions.Paused : StatusOptions.Active, type: OverlayType.All, createdAt: now, updatedAt: now });
		if (secondOverlayId) await tx.insert(overlaysTable).values({ id: secondOverlayId, ownerId: creatorId, secret: `e2e-second-secret-${fixtureId}`, name: "Second continuity overlay", status: StatusOptions.Active, type: OverlayType.All, createdAt: now, updatedAt: now });
	});

	const context = await auth.$context;
	if (typeof context.secret !== "string") throw new Error("E2E fixture requires a string Better Auth secret");
	if (body.withProviderCredentials === true) {
		const { symmetricEncrypt } = await import("better-auth/crypto");
		await db.insert(account).values({ id: randomUUID(), accountId: creatorId, providerId: "twitch", userId: authUserId, accessToken: await symmetricEncrypt({ key: context.secret, data: "isolated-dashboard-fixture-token" }), accessTokenExpiresAt: new Date(now.getTime() + 60 * 60 * 1000), scope: "user:read:email", createdAt: now, updatedAt: now });
	}
	const activeOrganizationId = activeContext === "agency" ? agencyOrganizationId : creatorOrganizationId;
	const session = await context.internalAdapter.createSession(authUserId, false, { activeOrganizationId }, true);
	if (!session) throw new Error("E2E session creation failed");

	return NextResponse.json({
		fixture: { authUserId, creatorId, creatorOrganizationId, agencyOrganizationId, overlayId, ...(secondOverlayId ? { secondOverlayId } : {}), ...(playlistId ? { playlistId } : {}), overlaySecret: `e2e-secret-${fixtureId}`, deletionRequestId: deletionState === "suspended" ? deletionRequestId : null, username, billingCurrentPeriodEnd: billingState === "active" ? billingCurrentPeriodEnd.toISOString() : null },
		cookie: { name: context.authCookies.sessionToken.name, value: signedCookieValue(session.token, context.secret), domain: "127.0.0.1", path: "/", httpOnly: true, secure: false, sameSite: "Lax" as const },
	});
}

export async function PATCH(request: Request) {
	if (!fixtureRequestAllowed(request)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
	const body = (await request.json().catch(() => ({}))) as { deletionRequestId?: string; deletionBoundary?: "expired"; creatorId?: string; overlayId?: string; bumpOverlayRevision?: boolean };
	if (body.bumpOverlayRevision === true) {
		if (!body.creatorId?.startsWith("e2e-creator-") || !body.overlayId || !/^[0-9a-f-]{36}$/i.test(body.overlayId)) return NextResponse.json({ error: "INVALID_FIXTURE" }, { status: 400 });
		const updated = await db
			.update(overlaysTable)
			.set({ configurationRevision: sql`${overlaysTable.configurationRevision} + 1` })
			.where(and(eq(overlaysTable.id, body.overlayId), eq(overlaysTable.ownerId, body.creatorId)))
			.returning({ id: overlaysTable.id });
		return NextResponse.json({ updated: updated.length === 1 });
	}

	if (!body.deletionRequestId || !/^[0-9a-f-]{36}$/i.test(body.deletionRequestId) || body.deletionBoundary !== "expired") return NextResponse.json({ error: "INVALID_FIXTURE" }, { status: 400 });
	const fixtureRequest = await db
		.select({ organizationId: accountDeletionRequestsTable.organizationId })
		.from(accountDeletionRequestsTable)
		.where(and(eq(accountDeletionRequestsTable.id, body.deletionRequestId), eq(accountDeletionRequestsTable.status, "suspended")))
		.limit(1);
	if (!fixtureRequest[0]?.organizationId?.startsWith("e2e-creator-org-")) return NextResponse.json({ error: "INVALID_FIXTURE" }, { status: 400 });
	const expiredAt = new Date(Date.now() - 1);
	await db
		.update(accountDeletionRequestsTable)
		.set({ status: "purge_eligible", purgeEligibleAt: expiredAt, updatedAt: new Date() })
		.where(and(eq(accountDeletionRequestsTable.id, body.deletionRequestId), eq(accountDeletionRequestsTable.status, "suspended")));
	await db.update(creatorAccountsTable).set({ status: "purge_eligible", purgeEligibleAt: expiredAt, updatedAt: new Date() }).where(eq(creatorAccountsTable.organizationId, fixtureRequest[0].organizationId));
	return NextResponse.json({ updated: true });
}

export async function DELETE(request: Request) {
	if (!fixtureRequestAllowed(request)) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
	const body = (await request.json().catch(() => ({}))) as { authUserId?: string; creatorId?: string; organizationIds?: string[]; cleanupAll?: boolean };
	if (body.cleanupAll) {
		await db.transaction(async (tx) => {
			const fixtureOrganizations = await tx
				.select({ id: organization.id })
				.from(organization)
				.where(or(like(organization.id, "e2e-%"), like(organization.name, "E2E ATDD Agency %")));
			const organizationIds = fixtureOrganizations.map(({ id }) => id);
			if (organizationIds.length) {
				await tx.delete(notificationOutboxTable).where(inArray(notificationOutboxTable.authorityOrganizationId, organizationIds));
				await tx.delete(auditEventsTable).where(inArray(auditEventsTable.accountOrganizationId, organizationIds));
				await tx.delete(organization).where(inArray(organization.id, organizationIds));
			}
			await tx.delete(usersTable).where(like(usersTable.id, "e2e-creator-%"));
			await tx.delete(authUser).where(like(authUser.id, "e2e-auth-%"));
		});
		return new NextResponse(null, { status: 204 });
	}
	if (!body.authUserId?.startsWith("e2e-auth-") || !body.creatorId?.startsWith("e2e-creator-") || !body.organizationIds?.length || !body.organizationIds.every((id) => id.startsWith("e2e-"))) return NextResponse.json({ error: "INVALID_FIXTURE" }, { status: 400 });
	await db.transaction(async (tx) => {
		await tx.delete(organization).where(inArray(organization.id, body.organizationIds!));
		await tx.delete(usersTable).where(eq(usersTable.id, body.creatorId!));
		await tx.delete(authUser).where(and(eq(authUser.id, body.authUserId!), eq(authUser.emailVerified, true)));
	});
	return new NextResponse(null, { status: 204 });
}
