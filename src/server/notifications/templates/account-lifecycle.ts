export type DeletionNotificationBoundary = "request" | "suspension" | "7d" | "3d" | "1d" | "0d" | "recovery";

export interface AccountLifecycleNotificationIntent {
	boundary: DeletionNotificationBoundary;
	recipient: string;
	templateVersion: "account-deletion-v1" | "account-recovery-v1";
	scheduledAt: Date;
	dedupeKey: string;
	payload: { effectiveAt: string; recoveryPath: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECOVERY_PATH = "/dashboard/settings/account/recovery";

export function buildDeletionNotificationIntents(input: { requestId: string; recipient: string; requestedAt: Date; suspensionAt: Date; purgeEligibleAt: Date }): AccountLifecycleNotificationIntent[] {
	const boundaries: Array<{ boundary: Exclude<DeletionNotificationBoundary, "recovery">; scheduledAt: Date }> = [
		{ boundary: "request", scheduledAt: input.requestedAt },
		{ boundary: "suspension", scheduledAt: input.suspensionAt },
		{ boundary: "7d", scheduledAt: new Date(input.purgeEligibleAt.getTime() - 7 * DAY_MS) },
		{ boundary: "3d", scheduledAt: new Date(input.purgeEligibleAt.getTime() - 3 * DAY_MS) },
		{ boundary: "1d", scheduledAt: new Date(input.purgeEligibleAt.getTime() - DAY_MS) },
		{ boundary: "0d", scheduledAt: input.purgeEligibleAt },
	];
	return boundaries.map(({ boundary, scheduledAt }) => ({
		boundary,
		recipient: input.recipient,
		templateVersion: "account-deletion-v1",
		scheduledAt,
		dedupeKey: `account-deletion:${input.requestId}:${boundary}`,
		payload: { effectiveAt: input.purgeEligibleAt.toISOString(), recoveryPath: RECOVERY_PATH },
	}));
}

export function buildRecoveryNotificationIntent(input: { requestId: string; recipient: string; recoveredAt: Date }): AccountLifecycleNotificationIntent {
	return {
		boundary: "recovery",
		recipient: input.recipient,
		templateVersion: "account-recovery-v1",
		scheduledAt: input.recoveredAt,
		dedupeKey: `account-deletion:${input.requestId}:recovery`,
		payload: { effectiveAt: input.recoveredAt.toISOString(), recoveryPath: RECOVERY_PATH },
	};
}

export function renderAccountLifecycleNotification(boundary: DeletionNotificationBoundary, input: { effectiveAt: Date; recoveryPath: string }) {
	if (boundary === "recovery") {
		return { subject: "Your Clipify account was recovered", body: `Your account access has been restored. Billing and agency allocations were not restarted. Review your account after you sign in at ${input.recoveryPath}.` };
	}
	const remaining = boundary === "suspension" ? "30 days" : boundary === "0d" ? "today" : boundary === "request" ? "as scheduled" : boundary.replace("d", " days");
	return {
		subject: boundary === "request" ? "Your Clipify account deletion was scheduled" : `Clipify account deletion: ${remaining} remaining`,
		body: `Your account is scheduled to become eligible for permanent data deletion on ${input.effectiveAt.toISOString()}. Paid-feature access and data deletion are separate. To cancel deletion, sign in normally and continue at ${input.recoveryPath}.`,
	};
}
