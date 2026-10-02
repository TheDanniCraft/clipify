import "server-only";

import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/db/client";
import {
	accountDeletionRequestsTable,
	agencyCreatorLinksTable,
	agencyLicenseAllocationsTable,
	auditEventsTable,
	billingSubscriptionItemsTable,
	billingSubscriptionsTable,
	c15t_auditLog,
	c15t_consent,
	c15t_subject,
	creatorAccountsTable,
	creatorIdentityLinksTable,
	entitlementGrantsTable,
	galleriesTable,
	modQueueTable,
	notificationOutboxTable,
	overlaysTable,
	plausibleStatsCacheTable,
	playlistClipsTable,
	playlistsTable,
	queueTable,
	runnerEnrollmentsTable,
	runnersTable,
	settingsTable,
	streamSessionsTable,
	userBadgesTable,
	userContentStatesTable,
	usersTable,
} from "@/db/schema";
import { account, invitation, member, organization, organizationRole, passkey, session, user } from "@/db/auth-schema";

const SECRET_FIELDS = new Set(["accessToken", "refreshToken", "idToken", "password", "token", "secret", "publicKey", "credentialID", "encryptedStreamKey", "deviceCode", "userCode"]);

function redactSecrets(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(redactSecrets);
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => !SECRET_FIELDS.has(key) && !/(authorization|cookie|password|refresh.?token|access.?token|id.?token|otp|private.?key)/i.test(key))
				.map(([key, nested]) => [key, redactSecrets(nested)]),
		);
	}
	return value;
}

export async function collectComprehensiveAccountData(input: { authUserId: string; creatorId: string; organizationId: string; now?: Date }) {
	const now = input.now ?? new Date();
	const [profiles, settings, badges, contentStates, creatorAccounts, identityLinks, authUsers, providerAccounts, sessions, passkeys, organizations, memberships, roles, invitations, overlays, playlists, galleries, runners, enrollments, streamSessions, modQueue, subscriptions, entitlements, deletionRequests, auditEvents, notifications, analyticsCache, agencyLinks, licenseAllocations] = await Promise.all([
		db.select().from(usersTable).where(eq(usersTable.id, input.creatorId)),
		db.select().from(settingsTable).where(eq(settingsTable.id, input.creatorId)),
		db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, input.creatorId)),
		db.select().from(userContentStatesTable).where(eq(userContentStatesTable.userId, input.creatorId)),
		db.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, input.creatorId)),
		db.select().from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.creatorId, input.creatorId)),
		db.select().from(user).where(eq(user.id, input.authUserId)),
		db.select({ id: account.id, accountId: account.accountId, providerId: account.providerId, userId: account.userId, accessTokenExpiresAt: account.accessTokenExpiresAt, refreshTokenExpiresAt: account.refreshTokenExpiresAt, scope: account.scope, createdAt: account.createdAt, updatedAt: account.updatedAt }).from(account).where(eq(account.userId, input.authUserId)),
		db.select({ id: session.id, expiresAt: session.expiresAt, createdAt: session.createdAt, updatedAt: session.updatedAt, ipAddress: session.ipAddress, userAgent: session.userAgent, activeOrganizationId: session.activeOrganizationId }).from(session).where(eq(session.userId, input.authUserId)),
		db.select({ id: passkey.id, name: passkey.name, counter: passkey.counter, deviceType: passkey.deviceType, backedUp: passkey.backedUp, transports: passkey.transports, createdAt: passkey.createdAt, aaguid: passkey.aaguid }).from(passkey).where(eq(passkey.userId, input.authUserId)),
		db.select().from(organization).where(eq(organization.id, input.organizationId)),
		db.select().from(member).where(eq(member.organizationId, input.organizationId)),
		db.select().from(organizationRole).where(eq(organizationRole.organizationId, input.organizationId)),
		db.select().from(invitation).where(eq(invitation.organizationId, input.organizationId)),
		db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, input.creatorId)),
		db.select().from(playlistsTable).where(eq(playlistsTable.ownerId, input.creatorId)),
		db.select().from(galleriesTable).where(eq(galleriesTable.ownerId, input.creatorId)),
		db.select().from(runnersTable).where(eq(runnersTable.ownerId, input.creatorId)),
		db.select().from(runnerEnrollmentsTable).where(eq(runnerEnrollmentsTable.ownerId, input.creatorId)),
		db.select().from(streamSessionsTable).where(eq(streamSessionsTable.ownerId, input.creatorId)),
		db.select().from(modQueueTable).where(eq(modQueueTable.broadcasterId, input.creatorId)),
		db.select().from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.userId, input.creatorId)),
		db.select().from(entitlementGrantsTable).where(eq(entitlementGrantsTable.userId, input.creatorId)),
		db.select().from(accountDeletionRequestsTable).where(eq(accountDeletionRequestsTable.organizationId, input.organizationId)),
		db
			.select()
			.from(auditEventsTable)
			.where(or(eq(auditEventsTable.accountOrganizationId, input.organizationId), eq(auditEventsTable.actorUserId, input.authUserId))),
		db.select().from(notificationOutboxTable).where(eq(notificationOutboxTable.authorityOrganizationId, input.organizationId)),
		db.select().from(plausibleStatsCacheTable).where(eq(plausibleStatsCacheTable.ownerId, input.creatorId)),
		db.select().from(agencyCreatorLinksTable).where(eq(agencyCreatorLinksTable.creatorOrganizationId, input.organizationId)),
		db.select().from(agencyLicenseAllocationsTable).where(eq(agencyLicenseAllocationsTable.creatorId, input.creatorId)),
	]);

	const overlayIds = overlays.map((row) => row.id);
	const playlistIds = playlists.map((row) => row.id);
	const subscriptionIds = subscriptions.map((row) => row.id);
	const identifiers = [...new Set([input.authUserId, input.creatorId, profiles[0]?.email, authUsers[0]?.email].filter((value): value is string => Boolean(value)))];
	const subjects = identifiers.length ? await db.select().from(c15t_subject).where(inArray(c15t_subject.externalId, identifiers)) : [];
	const subjectIds = subjects.map((row) => row.id);
	const [queuedClips, playlistClips, subscriptionItems, consents, consentAuditLogs] = await Promise.all([
		overlayIds.length ? db.select().from(queueTable).where(inArray(queueTable.overlayId, overlayIds)) : [],
		playlistIds.length ? db.select().from(playlistClipsTable).where(inArray(playlistClipsTable.playlistId, playlistIds)) : [],
		subscriptionIds.length ? db.select().from(billingSubscriptionItemsTable).where(inArray(billingSubscriptionItemsTable.subscriptionId, subscriptionIds)) : [],
		subjectIds.length ? db.select().from(c15t_consent).where(inArray(c15t_consent.subjectId, subjectIds)) : [],
		subjectIds.length ? db.select().from(c15t_auditLog).where(inArray(c15t_auditLog.subjectId, subjectIds)) : [],
	]);

	return redactSecrets({
		exportFormat: "clipify-account-data-v2",
		exportedAt: now.toISOString(),
		securityNotice: "Reusable credentials are intentionally excluded. This package does not contain OAuth access or refresh tokens, session tokens, passkey key material or credential IDs, runner enrollment codes or tokens, overlay secrets, or stream keys.",
		identity: { profile: profiles[0] ?? null, settings: settings[0] ?? null, badges, contentStates, creatorAccounts, identityLinks, authUsers, providerAccounts, sessions, passkeys },
		organization: { organizations, memberships, roles, invitations },
		content: { overlays, queuedClips, playlists, playlistClips, galleries, runners, enrollments, streamSessions, modQueue },
		billing: { subscriptions, subscriptionItems, entitlements },
		agency: { links: agencyLinks, licenseAllocations },
		privacy: { subjects, consents, consentAuditLogs },
		accountLifecycle: { deletionRequests, auditEvents, notifications },
		analytics: { cache: analyticsCache },
	});
}
