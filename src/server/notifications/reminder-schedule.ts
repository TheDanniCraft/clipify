/** All expiring access uses the same cadence; short lifecycles skip early points. */
export const EXPIRY_REMINDER_DAYS = [30, 7, 3, 1] as const;
export const DAY_MS = 86400000;
export function reminderIsCurrent(endsAt: Date, now: Date, days: number): boolean {
	const remaining = endsAt.getTime() - now.getTime();
	return remaining <= days * DAY_MS && remaining > (days - 1) * DAY_MS;
}
