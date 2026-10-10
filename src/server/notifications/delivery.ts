import { renderProMembershipEmail } from "./templates/pro-membership";
import { renderAccountAccessEmail } from "./templates/account-access";
import { badgeCatalog, badgeSlugs } from "@lib/badgeCatalog";
import { renderBadgeEmail } from "./templates/badge";
import { renderBenefitEmail } from "./templates/benefits";
import { z } from "zod";
import { notificationStillApplies } from "./eligibility";
import { randomUUID } from "node:crypto";
import { claimDatabaseNotifications, completeDatabaseNotification, failDatabaseNotification } from "./outbox";
import { renderIdentitySecurityEmail, type IdentitySecurityTemplateInput } from "./templates/identity-security";
import { renderAccountLifecycleEmail, renderAccountDeletedEmail } from "./templates/account-lifecycle";
import { renderAgencyAllocationEmail } from "./templates/agency-allocation";
import { UseSendTransactionalMailAdapter } from "@/auth/transactional-mail";

export interface DeliveryRecord {
	id: string;
	event_type: string;
	recipient: string;
	template_version: string;
	payload: Record<string, unknown>;
	dedupe_key: string;
}
const lifecyclePayload = z.object({ boundary: z.enum(["request", "suspension", "30d", "7d", "3d", "1d", "0d", "recovery"]), effectiveAt: z.iso.datetime(), recoveryPath: z.string().startsWith("/") });
const allocationPayload = z.object({ product: z.enum(["creator_pro", "runner"]).optional(), boundary: z.enum(["granted", "removal-scheduled", "removal-30d", "removal-7d", "removal-3d", "removal-1d", "ended"]), agencyName: z.string().min(1), effectiveAt: z.iso.datetime() });
const identityPayload = z.discriminatedUnion("type", [
	z.object({ type: z.literal("welcome"), name: z.string() }),
	z.object({ type: z.literal("invitation"), organizationName: z.string(), invitationUrl: z.url() }),
	z.object({ type: z.literal("security"), change: z.enum(["passkey-added", "passkey-removed", "email-changed"]).optional(), message: z.string().optional() }).refine((value) => !!value.change || !!value.message),
	z.object({ type: z.literal("organization-membership"), organizationName: z.string(), status: z.enum(["joined", "removed"]) }),
	z.object({ type: z.literal("agency-access"), agencyName: z.string(), creatorName: z.string(), status: z.enum(["granted", "removed"]) }),
]);
const benefitPayload = z.object({
	type: z.literal("benefit"),
	benefit: z.enum(["pro", "runner"]),
	event: z.enum(["granted", "trial-30d", "trial-7d", "access-30d", "access-7d", "access-3d", "access-1d", "trial-3d", "trial-1d", "ended", "revoked", "updated", "restored", "cancellation", "cancellation-30d", "cancellation-7d", "cancellation-3d", "cancellation-1d", "cancellation-0d", "partner-scheduled", "partner-ended", "partner-30d", "partner-7d", "partner-3d", "partner-1d", "partner-ending-30d", "partner-ending-7d", "partner-ending-3d", "partner-ending-1d"]),
	partner: z.boolean().optional(),
	proContinues: z.boolean().optional(),
	runnerContinues: z.boolean().optional(),
	trial: z.boolean().optional(),
	complimentary: z.boolean().optional(),
	startsAt: z.iso.datetime().optional(),
	endsAt: z.iso.datetime().nullable().optional(),
	reason: z.string().nullable().optional(),
});
export async function renderQueuedEmail(record: DeliveryRecord) {
	if (record.template_version === "pro-membership-v1") return { ...(await renderProMembershipEmail(z.object({ type: z.literal("pro-membership"), event: z.enum(["first-pro", "renewal", "welcome-back", "payment-ended"]), name: z.string(), existing: z.boolean().optional(), proContinues: z.boolean().optional() }).parse(record.payload))), templateVersion: "identity-security-v1" as const };
	if (record.template_version === "account-deleted-v1") return { ...(await renderAccountDeletedEmail()), templateVersion: "identity-security-v1" as const };
	if (record.template_version === "account-access-v1") return renderAccountAccessEmail(z.object({ name: z.string(), disabled: z.boolean(), automatic: z.boolean().optional(), reason: z.string().optional() }).parse(record.payload));
	if (record.template_version === "badge-v1") {
		const payload = z.object({ badge: z.enum(badgeSlugs), event: z.enum(["awarded", "removed"]) }).parse(record.payload);
		return { ...(await renderBadgeEmail({ ...badgeCatalog[payload.badge], event: payload.event })), templateVersion: "identity-security-v1" as const };
	}
	if (record.template_version === "benefit-v1") return { ...(await renderBenefitEmail(benefitPayload.parse(record.payload))), templateVersion: "identity-security-v1" as const };
	if (record.event_type === "account-lifecycle") {
		const payload = lifecyclePayload.parse(record.payload);
		return { ...(await renderAccountLifecycleEmail(payload.boundary, { effectiveAt: new Date(payload.effectiveAt), recoveryPath: payload.recoveryPath })), templateVersion: "identity-security-v1" as const };
	}
	if (record.event_type === "agency-allocation") {
		const payload = allocationPayload.parse(record.payload);
		return { ...(await renderAgencyAllocationEmail(payload.boundary, { agencyName: payload.agencyName, product: payload.product, effectiveAt: new Date(payload.effectiveAt) })), templateVersion: "identity-security-v1" as const };
	}
	if (record.template_version === "agency-owner-invitation-v1") throw new Error("INVITATION_REQUIRES_PERSISTED_LINK");
	return renderIdentitySecurityEmail(identityPayload.parse(record.payload) as IdentitySecurityTemplateInput);
}
export async function deliverDueNotifications() {
	const workerId = randomUUID();
	const now = new Date();
	const records = (await claimDatabaseNotifications({ workerId, now, leaseMs: 5 * 60_000, limit: 20 })) as unknown as DeliveryRecord[];
	await Promise.all(
		records.map(async (record) => {
			try {
				if (!(await notificationStillApplies(record, new Date()))) {
					await failDatabaseNotification({ id: record.id, workerId, permanent: true, error: "NOTIFICATION_NO_LONGER_APPLIES", now: new Date() });
					return;
				}
				if (record.template_version === "agency-owner-invitation-v1") {
					const { sendPersistedInvitationEmail } = await import("@/auth/invitations");
					const invitationId = record.dedupe_key.replace("agency-owner-invitation:", "");
					await sendPersistedInvitationEmail({ invitationId, email: record.recipient, headers: new Headers() });
					await completeDatabaseNotification({ id: record.id, workerId, providerMessageId: "persisted-invitation-delivery", now: new Date() });
				} else {
					const email = await renderQueuedEmail(record);
					const id = await new UseSendTransactionalMailAdapter().send(record.recipient, email, `outbox:${record.id}`);
					if (!id) throw new Error("MISSING_PROVIDER_MESSAGE_ID");
					await completeDatabaseNotification({ id: record.id, workerId, providerMessageId: id, now: new Date() });
				}
			} catch (error) {
				await failDatabaseNotification({ id: record.id, workerId, permanent: error instanceof z.ZodError, error: error instanceof Error ? error.message : "NOTIFICATION_DELIVERY_FAILED", now: new Date() });
			}
		}),
	);
	return { processed: records.length };
}
