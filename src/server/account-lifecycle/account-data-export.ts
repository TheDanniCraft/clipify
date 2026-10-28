import "server-only";

import { eq, inArray, or, sql } from "drizzle-orm";
import * as tables from "@/db/schema";
import * as authTables from "@/db/auth-schema";
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
	mcpConnectionGrantsTable,
	mcpGrantCreatorsTable,
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
import { account, invitation, member, organization, organizationRole, passkey, session, user, oauthClient } from "@/db/auth-schema";
import { collectReusableCredentialExport, collectOAuthCredentialExport } from "./account-data-export-credentials";
import { collectExternalAccountData } from "./account-export-external";

function serializeExport(value: unknown): unknown {
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "bigint") return value.toString();
	if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { encoding: "base64", value: Buffer.from(value).toString("base64") };
	if (Array.isArray(value)) return value.map(serializeExport);
	if (value && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serializeExport(nested)]));
	}
	return value;
}

export async function collectComprehensiveAccountData(input: { authUserId: string; creatorId: string; organizationId: string; now?: Date }) {
	const now = input.now ?? new Date();
	const ownMemberships = await db.select().from(member).where(eq(member.userId, input.authUserId));
	const organizationIds = [...new Set([input.organizationId, ...ownMemberships.filter((row) => row.role === "owner").map((row) => row.organizationId)])];
	const [profiles, settings, badges, contentStates, creatorAccounts, identityLinks, authUsers, providerAccounts, sessions, passkeys, organizations, memberships, roles, invitations, overlays, playlists, galleries, runners, enrollments, streamSessions, modQueue, subscriptions, entitlements, deletionRequests, auditEvents, notifications, analyticsCache, agencyLinks, licenseAllocations] = await Promise.all([
		db.select().from(usersTable).where(eq(usersTable.id, input.creatorId)),
		db.select().from(settingsTable).where(eq(settingsTable.id, input.creatorId)),
		db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, input.creatorId)),
		db.select().from(userContentStatesTable).where(eq(userContentStatesTable.userId, input.creatorId)),
		db.select().from(creatorAccountsTable).where(eq(creatorAccountsTable.creatorId, input.creatorId)),
		db.select().from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.creatorId, input.creatorId)),
		db.select().from(user).where(eq(user.id, input.authUserId)),
		db.select().from(account).where(eq(account.userId, input.authUserId)),
		db.select().from(session).where(eq(session.userId, input.authUserId)),
		db.select().from(passkey).where(eq(passkey.userId, input.authUserId)),
		db.select().from(organization).where(inArray(organization.id, organizationIds)),
		db
			.select()
			.from(member)
			.where(or(inArray(member.organizationId, organizationIds), eq(member.userId, input.authUserId))),
		db.select().from(organizationRole).where(inArray(organizationRole.organizationId, organizationIds)),
		db
			.select()
			.from(invitation)
			.where(or(inArray(invitation.organizationId, organizationIds), eq(invitation.inviterId, input.authUserId))),
		db.select().from(overlaysTable).where(eq(overlaysTable.ownerId, input.creatorId)),
		db.select().from(playlistsTable).where(eq(playlistsTable.ownerId, input.creatorId)),
		db.select().from(galleriesTable).where(eq(galleriesTable.ownerId, input.creatorId)),
		db.select().from(runnersTable).where(eq(runnersTable.ownerId, input.creatorId)),
		db.select().from(runnerEnrollmentsTable).where(eq(runnerEnrollmentsTable.ownerId, input.creatorId)),
		db.select().from(streamSessionsTable).where(eq(streamSessionsTable.ownerId, input.creatorId)),
		db.select().from(modQueueTable).where(eq(modQueueTable.broadcasterId, input.creatorId)),
		db.select().from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.userId, input.creatorId)),
		db.select().from(entitlementGrantsTable).where(eq(entitlementGrantsTable.userId, input.creatorId)),
		db.select().from(accountDeletionRequestsTable).where(inArray(accountDeletionRequestsTable.organizationId, organizationIds)),
		db
			.select()
			.from(auditEventsTable)
			.where(or(inArray(auditEventsTable.accountOrganizationId, organizationIds), eq(auditEventsTable.actorUserId, input.authUserId))),
		db.select().from(notificationOutboxTable).where(inArray(notificationOutboxTable.authorityOrganizationId, organizationIds)),
		db.select().from(plausibleStatsCacheTable).where(eq(plausibleStatsCacheTable.ownerId, input.creatorId)),
		db
			.select()
			.from(agencyCreatorLinksTable)
			.where(or(inArray(agencyCreatorLinksTable.creatorOrganizationId, organizationIds), inArray(agencyCreatorLinksTable.agencyOrganizationId, organizationIds))),
		db
			.select()
			.from(agencyLicenseAllocationsTable)
			.where(or(eq(agencyLicenseAllocationsTable.creatorId, input.creatorId), inArray(agencyLicenseAllocationsTable.linkId, db.select({ id: agencyCreatorLinksTable.id }).from(agencyCreatorLinksTable).where(inArray(agencyCreatorLinksTable.agencyOrganizationId, organizationIds))))),
	]);

	const overlayIds = overlays.map((row) => row.id);
	const playlistIds = playlists.map((row) => row.id);
	const subscriptionIds = subscriptions.map((row) => row.id);
	const identifiers = [...new Set([input.authUserId, input.creatorId, profiles[0]?.email, authUsers[0]?.email].filter((value): value is string => Boolean(value)))];
	const subjects = identifiers.length
		? await db
				.select()
				.from(c15t_subject)
				.where(or(inArray(c15t_subject.externalId, identifiers), inArray(c15t_subject.verifiedExternalId, identifiers)))
		: [];
	const subjectIds = subjects.map((row) => row.id);
	const [queuedClips, playlistClips, subscriptionItems, consents, consentAuditLogs] = await Promise.all([
		overlayIds.length ? db.select().from(queueTable).where(inArray(queueTable.overlayId, overlayIds)) : [],
		playlistIds.length ? db.select().from(playlistClipsTable).where(inArray(playlistClipsTable.playlistId, playlistIds)) : [],
		subscriptionIds.length ? db.select().from(billingSubscriptionItemsTable).where(inArray(billingSubscriptionItemsTable.subscriptionId, subscriptionIds)) : [],
		subjectIds.length ? db.select().from(c15t_consent).where(inArray(c15t_consent.subjectId, subjectIds)) : [],
		subjectIds.length ? db.select().from(c15t_auditLog).where(inArray(c15t_auditLog.subjectId, subjectIds)) : [],
	]);
	// Only approvals owned by the exporting actor; client secrets and arbitrary metadata are excluded.
	const grants = await db.select({ grant: mcpConnectionGrantsTable, clientName: oauthClient.name }).from(mcpConnectionGrantsTable).leftJoin(oauthClient, eq(oauthClient.clientId, mcpConnectionGrantsTable.clientId)).where(eq(mcpConnectionGrantsTable.authUserId, input.authUserId));
	const grantIds = grants.map(({ grant }) => grant.id);
	const approvals = grantIds.length ? await db.select().from(mcpGrantCreatorsTable).where(inArray(mcpGrantCreatorsTable.grantId, grantIds)) : [];
	const mcp = {
		grants: grants.map(({ grant }) => grant),
		creatorApprovals: approvals,
		connections: grants.map(({ grant, clientName }) => ({
			id: grant.id,
			clientId: grant.clientId,
			clientName: clientName ?? grant.clientId,
			resource: grant.resource,
			issuer: grant.issuer,
			scopes: grant.scopes,
			active: grant.active && !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now),
			createdAt: grant.createdAt.toISOString(),
			expiresAt: grant.expiresAt?.toISOString() ?? null,
			revokedAt: grant.revokedAt?.toISOString() ?? null,
			creators: approvals.filter((approval) => approval.grantId === grant.id).map(({ creatorId, agencyOrganizationId }) => ({ creatorId, agencyOrganizationId })),
		})),
	};
	const policyIds = [...new Set(consents.map((row) => row.policyId).filter((id): id is string => Boolean(id)))];
	const purposeIds = [...new Set(consents.flatMap((row) => (Array.isArray(row.purposeIds) ? row.purposeIds.filter((id): id is string => typeof id === "string") : [])))];
	const domainIds = [...new Set(consents.map((row) => row.domainId).filter((id): id is string => Boolean(id)))];
	const decisionIds = [...new Set(consents.map((row) => row.runtimePolicyDecisionId).filter((id): id is string => Boolean(id)))];
	const [policies, purposes, domains, runtimeDecisions] = await Promise.all([
		policyIds.length ? db.select().from(tables.c15t_consentPolicy).where(inArray(tables.c15t_consentPolicy.id, policyIds)) : [],
		purposeIds.length ? db.select().from(tables.c15t_consentPurpose).where(inArray(tables.c15t_consentPurpose.id, purposeIds)) : [],
		domainIds.length ? db.select().from(tables.c15t_domain).where(inArray(tables.c15t_domain.id, domainIds)) : [],
		decisionIds.length ? db.select().from(tables.c15t_runtimePolicyDecision).where(inArray(tables.c15t_runtimePolicyDecision.id, decisionIds)) : [],
	]);
	const emails = [...new Set([profiles[0]?.email, authUsers[0]?.email].filter((email): email is string => Boolean(email)))];
	const { resourceAuditEvents, addressedNotifications, receivedInvitations, ...additional } = await collectAdditionalAccountData(input, { emails, resourceIds: [...overlays, ...playlists, ...galleries, ...runners, ...streamSessions].map((row) => row.id).concat(grantIds), queuedClips, playlistClips, modQueue });
	const reusableCredentials = { ...collectReusableCredentialExport({ overlays, runners, streamSessions, destinations: additional.runner.destinations }), oauthAccounts: await collectOAuthCredentialExport(providerAccounts) };
	const external = await collectExternalAccountData(
		authUsers.filter((row) => row.emailVerified).map((row) => row.email),
		input.creatorId,
	);

	return serializeExport({
		exportFormat: "clipify-account-data-v3",
		exportedAt: now.toISOString(),
		securityNotice: "This private package contains personal data and account credentials, including stored OAuth and session tokens, overlay secrets, Runner tokens and stream keys. Never share it publicly. Deployment encryption keys, server signing keys and other users' private data are not included.",
		identity: { profile: profiles[0] ?? null, settings: settings[0] ?? null, badges, contentStates, creatorAccounts, identityLinks, authUsers, providerAccounts, sessions, passkeys },
		organization: { organizations, memberships, roles, invitations: [...new Map([...invitations, ...receivedInvitations].map((row) => [row.id, row])).values()] },
		content: { overlays, queuedClips, playlists, playlistClips, galleries, runners, enrollments, streamSessions, modQueue },
		reusableCredentials,
		billing: { subscriptions, subscriptionItems, entitlements },
		agency: { links: agencyLinks, licenseAllocations },
		privacy: { subjects, consents, consentAuditLogs, policies, purposes, domains, runtimeDecisions },
		mcp,
		accountLifecycle: { deletionRequests, auditEvents: [...new Map([...auditEvents, ...resourceAuditEvents].map((row) => [row.id, row])).values()], notifications: [...new Map([...notifications, ...addressedNotifications].map((row) => [row.id, row])).values()] },
		analytics: { cache: analyticsCache },
		...additional,
		external,
	});
}

async function collectAdditionalAccountData(input: { authUserId: string; creatorId: string; organizationId: string }, related: { emails: string[]; resourceIds: string[]; queuedClips: Array<{ clipId: string }>; playlistClips: Array<{ clipId: string }>; modQueue: Array<{ clipId: string }> }) {
	const clipIds = [...new Set([...related.queuedClips, ...related.playlistClips, ...related.modQueue].map((clip) => clip.clipId))];
	const ownedMemberships = await db.select().from(member).where(eq(member.userId, input.authUserId));
	const ownedOrganizationIds = [...new Set([input.organizationId, ...ownedMemberships.filter((membership) => membership.role === "owner").map((membership) => membership.organizationId)])];
	const registeredClients = await db.select().from(authTables.oauthClient).where(eq(authTables.oauthClient.userId, input.authUserId));
	const clientIds = registeredClients.map((client) => client.clientId);
	const [resourceAuditEvents, receivedInvitations, addressedNotifications, brandingAssets, brandingProfiles, destinations, providerConnections, providerStates, scheduleEvents, scheduleDestinations, sessionDestinations, broadcastAdmissions, effectJobs, crawlJobs, clipCache, retries, impersonationSessions, agencyAccounts, agencyBilling, ownOAuthAccessTokens, ownOAuthRefreshTokens, ownOAuthConsents, ownClientResources, ownVerifications] = await Promise.all([
		db
			.select()
			.from(auditEventsTable)
			.where(inArray(auditEventsTable.targetId, [input.creatorId, input.authUserId, ...related.resourceIds])),
		related.emails.length ? db.select().from(invitation).where(inArray(invitation.email, related.emails)) : [],
		related.emails.length ? db.select().from(notificationOutboxTable).where(inArray(notificationOutboxTable.recipient, related.emails)) : [],
		db.select().from(tables.runnerBrandingAssetsTable).where(eq(tables.runnerBrandingAssetsTable.ownerId, input.creatorId)),
		db.select().from(tables.runnerBrandingProfilesTable).where(eq(tables.runnerBrandingProfilesTable.ownerId, input.creatorId)),
		db.select().from(tables.runnerDestinationsTable).where(eq(tables.runnerDestinationsTable.ownerId, input.creatorId)),
		db.select().from(tables.runnerProviderConnectionsTable).where(eq(tables.runnerProviderConnectionsTable.ownerId, input.creatorId)),
		db.select().from(tables.runnerProviderStatesTable).where(eq(tables.runnerProviderStatesTable.authUserId, input.authUserId)),
		db.select().from(tables.runnerScheduleEventsTable).where(eq(tables.runnerScheduleEventsTable.ownerId, input.creatorId)),
		db.select().from(tables.runnerScheduleEventDestinationsTable).where(eq(tables.runnerScheduleEventDestinationsTable.ownerId, input.creatorId)),
		db.select().from(tables.streamSessionDestinationsTable).where(eq(tables.streamSessionDestinationsTable.ownerId, input.creatorId)),
		db.select().from(tables.runnerBroadcastAdmissionsTable).where(eq(tables.runnerBroadcastAdmissionsTable.ownerId, input.creatorId)),
		db.select().from(tables.overlayEffectJobsTable).where(eq(tables.overlayEffectJobsTable.creatorId, input.creatorId)),
		db.select().from(tables.clipCrawlJobsTable).where(eq(tables.clipCrawlJobsTable.creatorId, input.creatorId)),
		db
			.select()
			.from(tables.twitchCacheTable)
			.where(or(eq(tables.twitchCacheTable.key, input.creatorId), sql`split_part(${tables.twitchCacheTable.key}, ':', 2) = ${input.creatorId}`, ...(clipIds.length ? [inArray(sql<string>`split_part(${tables.twitchCacheTable.key}, ':', 2)`, clipIds)] : []))),
		db.select().from(tables.mcpMutationRetriesTable).where(eq(tables.mcpMutationRetriesTable.authUserId, input.authUserId)),
		db
			.select()
			.from(tables.adminImpersonationSessionsTable)
			.where(or(eq(tables.adminImpersonationSessionsTable.targetUserId, input.creatorId), eq(tables.adminImpersonationSessionsTable.adminUserId, input.creatorId))),
		db.select().from(tables.agencyAccountsTable).where(inArray(tables.agencyAccountsTable.organizationId, ownedOrganizationIds)),
		db.select().from(tables.agencyBillingAccountsTable).where(inArray(tables.agencyBillingAccountsTable.organizationId, ownedOrganizationIds)),

		db.select().from(authTables.oauthAccessToken).where(eq(authTables.oauthAccessToken.userId, input.authUserId)),
		db.select().from(authTables.oauthRefreshToken).where(eq(authTables.oauthRefreshToken.userId, input.authUserId)),
		db.select().from(authTables.oauthConsent).where(eq(authTables.oauthConsent.userId, input.authUserId)),
		clientIds.length ? db.select().from(authTables.oauthClientResource).where(inArray(authTables.oauthClientResource.clientId, clientIds)) : [],
		db
			.select()
			.from(authTables.verification)
			.where(or(eq(authTables.verification.identifier, input.authUserId), ...related.emails.flatMap((email) => [eq(authTables.verification.identifier, email), ...["sign-in-otp-", "email-verification-otp-", "forget-password-otp-"].map((prefix) => eq(authTables.verification.identifier, `${prefix}${email}`))]))),
	]);
	return {
		runner: { brandingAssets, brandingProfiles, destinations, providerConnections, providerStates, scheduleEvents, scheduleDestinations, sessionDestinations, broadcastAdmissions },
		clipStorage: { cache: clipCache, crawlJobs, effectJobs },
		resourceAuditEvents,
		addressedNotifications,
		receivedInvitations,
		accountActivity: { impersonationSessions, memberships: ownedMemberships },
		aiApps: { retryRecords: retries, registeredClients, clientResourceBindings: ownClientResources, accessTokens: ownOAuthAccessTokens, refreshTokens: ownOAuthRefreshTokens, consents: ownOAuthConsents },
		ownedAgencies: { accounts: agencyAccounts, billing: agencyBilling },
		verificationRecords: ownVerifications,
	};
}
