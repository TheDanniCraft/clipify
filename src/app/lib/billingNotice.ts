export type BillingNotice = { kind: "overdue"; period: string } | { kind: "trial"; endsAt: string };

export const OVERDUE_BILLING_STATUSES = ["past_due", "unpaid"] as const;

export function isBillingOverdue(status: string) {
	return OVERDUE_BILLING_STATUSES.some((overdue) => status === overdue);
}

export function getTrialEndingNotice(endsAt: string | Date | null | undefined, now = Date.now()): BillingNotice | null {
	if (!endsAt) return null;
	const end = new Date(endsAt);
	const remaining = end.getTime() - now;
	return remaining > 0 && remaining <= 48 * 60 * 60 * 1000 ? { kind: "trial", endsAt: end.toISOString() } : null;
}
