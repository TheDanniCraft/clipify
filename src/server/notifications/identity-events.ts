import { enqueueDatabaseNotification } from "./outbox";
import type { IdentitySecurityTemplateInput } from "./templates/identity-security";

export async function queueIdentityEmail(recipient: string, input: Exclude<IdentitySecurityTemplateInput, { type: "account-data-export" }>, dedupeKey: string) {
	await enqueueDatabaseNotification({ eventType: input.type === "organization-membership" ? "agency-access" : input.type, recipient, templateVersion: "identity-security-v1", locale: "en", payload: input, scheduledAt: new Date(), dedupeKey });
}
