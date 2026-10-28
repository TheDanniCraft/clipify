import { createAccountExportLayout } from "./account-export-layout";
import { isTable } from "drizzle-orm";
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as schema from "@/db/schema";
import * as authSchema from "@/db/auth-schema";

// Every schema table must have an ownership-scoped dataset or an explicit reason.
export const accountExportCoverage: Record<string, { paths: string[] } | { excluded: string }> = {
	"public.account_deletion_requests": { paths: ["accountLifecycle.deletionRequests"] },
	"public.admin_impersonation_sessions": { paths: ["accountActivity.impersonationSessions"] },
	"public.agency_accounts": { paths: ["ownedAgencies.accounts"] },
	"public.agency_billing_accounts": { paths: ["ownedAgencies.billing"] },
	"public.agency_creator_links": { paths: ["agency.links"] },
	"public.agency_license_allocations": { paths: ["agency.licenseAllocations"] },
	"public.audit_events": { paths: ["accountLifecycle.auditEvents"] },
	"public.billing_subscription_items": { paths: ["billing.subscriptionItems"] },
	"public.billing_subscriptions": { paths: ["billing.subscriptions"] },
	"public.billing_webhook_events": { excluded: "Global Stripe event processing ledger; stores event IDs and processing state, not account payloads." },
	"public.clip_crawl_jobs": { paths: ["clipStorage.crawlJobs"] },
	"public.creator_accounts": { paths: ["identity.creatorAccounts"] },
	"public.creator_identity_links": { paths: ["identity.identityLinks"] },
	"public.entitlement_grants": { paths: ["billing.entitlements"] },
	"public.galleries": { paths: ["content.galleries"] },
	"public.mcp_connection_grants": { paths: ["mcp.grants"] },
	"public.mcp_grant_creators": { paths: ["mcp.creatorApprovals"] },
	"public.mcp_mutation_retries": { paths: ["aiApps.retryRecords"] },
	"public.member_number_allocator": { excluded: "Shared sequence allocator; contains no per-account rows." },
	"public.modQueue": { paths: ["content.modQueue"] },
	"public.notification_outbox": { paths: ["accountLifecycle.notifications"] },
	"public.overlay_effect_jobs": { paths: ["clipStorage.effectJobs"] },
	"public.overlays": { paths: ["content.overlays"] },
	"public.plausible_stats_cache": { paths: ["analytics.cache"] },
	"public.playlist_clips": { paths: ["content.playlistClips"] },
	"public.playlists": { paths: ["content.playlists"] },
	"public.clipQueue": { paths: ["content.queuedClips"] },
	"public.rate_limit_counters": { excluded: "Shared security counters keyed by one-way signal hashes, without an account foreign key." },
	"public.runner_branding_assets": { paths: ["runner.brandingAssets"] },
	"public.runner_branding_profiles": { paths: ["runner.brandingProfiles"] },
	"public.runner_broadcast_admissions": { paths: ["runner.broadcastAdmissions"] },
	"public.runner_destinations": { paths: ["runner.destinations"] },
	"public.runner_enrollments": { paths: ["content.enrollments"] },
	"public.runner_provider_connections": { paths: ["runner.providerConnections"] },
	"public.runner_provider_states": { paths: ["runner.providerStates"] },
	"public.runner_schedule_event_destinations": { paths: ["runner.scheduleDestinations"] },
	"public.runner_schedule_events": { paths: ["runner.scheduleEvents"] },
	"public.runners": { paths: ["content.runners"] },
	"public.userSettings": { paths: ["identity.settings"] },
	"public.stream_session_destinations": { paths: ["runner.sessionDestinations"] },
	"public.stream_sessions": { paths: ["content.streamSessions"] },
	"public.twitchCache": { paths: ["clipStorage.cache"] },
	"public.user_badges": { paths: ["identity.badges"] },
	"public.user_content_states": { paths: ["identity.contentStates"] },
	"public.users": { paths: ["identity.profile"] },
	"public.auditLog": { paths: ["privacy.consentAuditLogs"] },
	"public.consent": { paths: ["privacy.consents"] },
	"public.consentPolicy": { paths: ["privacy.policies"] },
	"public.consentPurpose": { paths: ["privacy.purposes"] },
	"public.domain": { paths: ["privacy.domains"] },
	"public.runtimePolicyDecision": { paths: ["privacy.runtimeDecisions"] },
	"public.subject": { paths: ["privacy.subjects"] },
	"public.private_c15t_settings": { excluded: "Consent service migration state." },
	"auth.account": { paths: ["identity.providerAccounts"] },
	"auth.invitation": { paths: ["organization.invitations"] },
	"auth.jwks": { excluded: "Server-wide signing keys. Private deployment keys are never account data." },
	"auth.member": { paths: ["organization.memberships"] },
	"auth.oauth_access_token": { paths: ["aiApps.accessTokens"] },
	"auth.oauth_client": { paths: ["aiApps.registeredClients"] },
	"auth.oauth_client_assertion": { excluded: "Global assertion replay-prevention IDs without an account relationship." },
	"auth.oauth_client_resource": { paths: ["aiApps.clientResourceBindings"] },
	"auth.oauth_consent": { paths: ["aiApps.consents"] },
	"auth.oauth_refresh_token": { paths: ["aiApps.refreshTokens"] },
	"auth.oauth_resource": { excluded: "Server-wide OAuth resource configuration, not user records." },
	"auth.organization": { paths: ["organization.organizations"] },
	"auth.organization_role": { paths: ["organization.roles"] },
	"auth.passkey": { paths: ["identity.passkeys"] },
	"auth.rate_limit": { excluded: "Shared authentication rate-limit counters without account ownership." },
	"auth.session": { paths: ["identity.sessions"] },
	"auth.user": { paths: ["identity.authUsers"] },
	"auth.verification": { paths: ["verificationRecords"] },
};

export function createAccountExportManifest(data: Record<string, unknown>, locations = createAccountExportLayout(data).locations) {
	[...new Set(Object.values({ ...schema, ...authSchema }).filter(isTable))].forEach((table) => {
		const config = getTableConfig(table as PgTable);
		const name = `${config.schema ?? "public"}.${config.name}`;
		const coverage = accountExportCoverage[name];
		if (!coverage) throw new Error(`ACCOUNT_EXPORT_TABLE_NOT_CLASSIFIED: ${name}`);
		if ("excluded" in coverage) return;
		coverage.paths.forEach((path) => {
			const value = path.split(".").reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined), data);
			if (value === undefined) throw new Error(`ACCOUNT_EXPORT_DATASET_MISSING: ${path}`);
		});
	});
	return {
		format: "clipify-account-data-v4",
		exportedAt: data.exportedAt,
		contents: [...locations].flatMap(([source, location]) => {
			const value = source.split(".").reduce<unknown>((current, key) => (current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined), data);
			if (source === "external.support") {
				const support = value as { contacts: unknown[]; conversations: { messages: unknown[] }[] };
				return [{ ...location, name: "Support conversations", records: support.conversations.length, messages: support.conversations.reduce((count, conversation) => count + conversation.messages.length, 0) }];
			}
			if (source === "external.newsletter") return [{ ...location, name: "Newsletter subscriptions", records: (value as { contacts: unknown[] }).contacts.length }];
			const name = source
				.split(".")
				.at(-1)!
				.replace(/([a-z])([A-Z])/g, "$1 $2");
			return [{ ...location, name: name[0].toUpperCase() + name.slice(1), records: Array.isArray(value) ? value.length : 1 }];
		}),
		dataNotes: [
			"Dates are ISO 8601 strings. Null means no value was stored; an empty array means there were no matching records.",
			"Clipify stores clip metadata and provider URLs, not copies of Twitch video files. Cached entries are scoped to this creator and referenced clips.",
			"Original stored credential values are preserved. Reusable credentials are also decrypted where available in security/security.json; unavailable decryption is identified explicitly. Password hashes cannot be converted back into passwords. Passkey private keys are held on the user's device, not in Clipify.",
		],
		sensitiveFields: [...locations].flatMap(([source, location]) => {
			const fields = sensitiveSources[source] ?? (source.startsWith("reusableCredentials.") ? "value, storedEncryptedValue, accessToken, refreshToken, idToken" : undefined);
			return fields ? [`${location.file}#${location.pointer}: ${fields}`] : [];
		}),
	};
}

const sensitiveSources: Record<string, string> = {
	"external.support": "conversations[].messages[].attachments[].data_url, conversations[].messages[].attachments[].thumb_url",
	"identity.providerAccounts": "accessToken, refreshToken, idToken, password",
	"identity.sessions": "token",
	"identity.passkeys": "credentialID, publicKey",
	"content.overlays": "secret",
	"content.runners": "token",
	"content.enrollments": "deviceCode, userCode",
	"content.streamSessions": "encryptedStreamKey",
	"runner.destinations": "encryptedStreamKey",
	"runner.providerConnections": "encryptedTokens",
	"runner.broadcastAdmissions": "encryptedTargetsSnapshot, terminalCredentialHash",
	"aiApps.accessTokens": "token",
	"aiApps.refreshTokens": "token, rotationReplayResponse",
	"aiApps.registeredClients": "clientSecret",
	verificationRecords: "value",
};
