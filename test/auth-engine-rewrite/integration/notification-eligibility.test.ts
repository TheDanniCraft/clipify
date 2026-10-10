/** @jest-environment node */
const continuingPro = jest.fn();
jest.mock("@/server/notifications/access-context", () => ({ hasContinuingPro: (...args: unknown[]) => continuingPro(...args), hasContinuingBenefit: (_benefit: string, ...args: unknown[]) => continuingPro(...args) }));
let row: Record<string, unknown> | undefined;
jest.mock("@/db/client", () => ({
	db: {
		select: () => {
			const chain: any = { from: () => chain, where: () => chain, limit: async () => (row ? [row] : []) };
			return chain;
		},
	},
}));
import { notificationStillApplies } from "@/server/notifications/eligibility";
import type { DeliveryRecord } from "@/server/notifications/delivery";
const now = new Date("2030-01-01T12:00:00Z");
const record = (boundary: string): DeliveryRecord => ({ id: "notice", event_type: "account-lifecycle", recipient: "alex@example.test", template_version: "account-deletion-v1", payload: { boundary }, dedupe_key: `account-deletion:request:${boundary}` });
beforeEach(() => {
	continuingPro.mockReset().mockResolvedValue(false);
	row = { status: "suspended", requestedAt: now, suspensionAt: now, purgeEligibleAt: new Date(now.getTime() + 30 * 86400000) };
});
test("immediate deletion sends one initial message and suppresses the duplicate 30-day notice", async () => {
	expect(await notificationStillApplies(record("request"), now)).toBe(true);
	expect(await notificationStillApplies(record("suspension"), now)).toBe(false);
});
test("recovery suppresses countdowns but allows its own confirmation", async () => {
	row!.status = "recovered";
	expect(await notificationStillApplies(record("7d"), now)).toBe(false);
	expect(await notificationStillApplies(record("recovery"), now)).toBe(true);
});
test("expired recovery links and obsolete countdowns are never delivered", async () => {
	row!.purgeEligibleAt = new Date(now.getTime() + 2 * 86400000);
	expect(await notificationStillApplies(record("7d"), now)).toBe(false);
	expect(await notificationStillApplies(record("3d"), now)).toBe(false);
	row!.purgeEligibleAt = now;
	expect(await notificationStillApplies(record("0d"), now)).toBe(false);
});
test("a missing deletion request never produces a reminder", async () => {
	row = undefined;
	expect(await notificationStillApplies(record("7d"), now)).toBe(false);
});

const benefitRecord = (event: string): DeliveryRecord => ({ ...record(event), event_type: "entitlement", template_version: "benefit-v1", payload: { grantId: "grant", event, trial: true, endsAt: new Date(now.getTime() + 3 * 86400000).toISOString() } });
test("a revoked or extended grant cannot deliver stale trial notices", async () => {
	row = { revokedAt: now, endsAt: new Date(now.getTime() + 3 * 86400000) };
	expect(await notificationStillApplies(benefitRecord("trial-1d"), now)).toBe(false);
	row = { revokedAt: null, endsAt: new Date(now.getTime() + 10 * 86400000) };
	expect(await notificationStillApplies(benefitRecord("trial-1d"), now)).toBe(false);
});
test("a paid upgrade suppresses trial sales reminders", async () => {
	row = { revokedAt: null, endsAt: new Date(now.getTime() + 3 * 86400000), id: "f1535b41-5946-49aa-bf79-7457cda6cb8c", userId: "alex", entitlement: "pro_access", source: "reverse_trial", plan: "pro" };
	continuingPro.mockResolvedValue(true);
	expect(await notificationStillApplies(benefitRecord("trial-3d"), now)).toBe(false);
});
test("resuming a subscription suppresses a queued cancellation notice", async () => {
	row = { status: "active", cancelAtPeriodEnd: false };
	expect(await notificationStillApplies({ ...record("cancellation"), event_type: "billing", payload: { subscriptionId: "sub" } }, now)).toBe(false);
});

test.each(["badge", "account-access"])("queued %s notices are suppressed after account deletion", async (event_type) => {
	row = undefined;
	expect(await notificationStillApplies({ ...record("request"), event_type, payload: { userId: "alex" } }, now)).toBe(false);
});

test.each(["partner", "agency", "paid plan"])("continuing %s access suppresses trial sales reminders", async () => {
	row = { id: "f1535b41-5946-49aa-bf79-7457cda6cb8c", userId: "alex", entitlement: "pro_access", source: "reverse_trial", startsAt: new Date(now.getTime() - 5 * 86400000), endsAt: new Date(now.getTime() + 3 * 86400000), revokedAt: null };
	continuingPro.mockResolvedValue(true);
	expect(await notificationStillApplies(benefitRecord("trial-3d"), now)).toBe(false);
	expect(continuingPro).toHaveBeenCalledWith("alex", row.endsAt, row.id);
});
test("a Partner badge ending starts grace, and the Pro expiry notice waits seven days", async () => {
	row = { id: "f1535b41-5946-49aa-bf79-7457cda6cb8c", userId: "alex", entitlement: "pro_access", source: "partner", startsAt: new Date(now.getTime() - 10 * 86400000), endsAt: now, revokedAt: null };
	const notice = (event: string): DeliveryRecord => ({ ...benefitRecord(event), payload: { grantId: row!.id, event, endsAt: now.toISOString() } });
	expect(await notificationStillApplies(notice("partner-ended"), now)).toBe(true);
	expect(await notificationStillApplies(notice("ended"), now)).toBe(false);
	const end = notice("ended");
	continuingPro.mockResolvedValue(true);
	expect(await notificationStillApplies(end, new Date(now.getTime() + 7 * 86400000))).toBe(true);
	expect(end.payload.proContinues).toBe(true);
});

test("changing a trial into Partner access suppresses its old trial reminders", async () => {
	row = { id: "f1535b41-5946-49aa-bf79-7457cda6cb8c", userId: "alex", source: "partner", entitlement: "pro_access", startsAt: new Date(now.getTime() - 5 * 86400000), endsAt: new Date(now.getTime() + 3 * 86400000), revokedAt: null };
	expect(await notificationStillApplies(benefitRecord("trial-3d"), now)).toBe(false);
});

const paymentEndedRecord = (): DeliveryRecord => ({ ...record("payment-ended"), event_type: "pro-membership", payload: { event: "payment-ended", userId: "alex", subscriptionId: "sub" } });
test.each(["Partner", "agency", "another subscription", "complimentary Pro"])("subscription end does not email users who still have %s access", async () => {
	row = { id: "alex", status: "canceled" };
	continuingPro.mockResolvedValue(true);
	expect(await notificationStillApplies(paymentEndedRecord(), now)).toBe(false);
	expect(continuingPro).toHaveBeenCalledWith("alex", now);
});
test("subscription end emails only after Pro access actually ends", async () => {
	row = { id: "alex", status: "unpaid" };
	expect(await notificationStillApplies(paymentEndedRecord(), now)).toBe(true);
	row.status = "active";
	expect(await notificationStillApplies(paymentEndedRecord(), now)).toBe(false);
});

test("a queued welcome-back email is skipped when Pro has already ended", async () => {
	row = { id: "alex", plan: "free" };
	const notice = { ...paymentEndedRecord(), payload: { event: "welcome-back", userId: "alex", subscriptionId: "sub" } };
	expect(await notificationStillApplies(notice, now)).toBe(false);
	continuingPro.mockResolvedValue(true);
	expect(await notificationStillApplies(notice, now)).toBe(true);
});

test("paid Pro countdown checks the current Stripe end date, renewal and other access", async () => {
	const endsAt = new Date(now.getTime() + 3 * 86400000);
	row = { userId: "alex", cancelAtPeriodEnd: true, status: "active", currentPeriodEnd: endsAt };
	const notice: DeliveryRecord = { ...record("reminder"), event_type: "billing", payload: { event: "cancellation-3d", subscriptionId: "sub", endsAt: endsAt.toISOString() } };
	expect(await notificationStillApplies(notice, now)).toBe(true);
	continuingPro.mockResolvedValue(true);
	expect(await notificationStillApplies(notice, now)).toBe(false);
	continuingPro.mockResolvedValue(false);
	row.cancelAtPeriodEnd = false;
	expect(await notificationStillApplies(notice, now)).toBe(false);
	row.cancelAtPeriodEnd = true;
	row.currentPeriodEnd = new Date(now.getTime() + 10 * 86400000);
	expect(await notificationStillApplies(notice, now)).toBe(false);
	row.currentPeriodEnd = endsAt;
	expect(await notificationStillApplies(notice, endsAt)).toBe(false);
});

test("final paid cancellation email waits for Stripe confirmation and actual Pro loss", async () => {
	row = { userId: "alex", cancelAtPeriodEnd: true, status: "active" };
	const notice: DeliveryRecord = { ...record("ended"), event_type: "billing", payload: { event: "cancellation-0d", subscriptionId: "sub" } };
	expect(await notificationStillApplies(notice, now)).toBe(false);
	row.status = "canceled";
	expect(await notificationStillApplies(notice, now)).toBe(true);
	continuingPro.mockResolvedValue(true);
	expect(await notificationStillApplies(notice, now)).toBe(false);
});

test.each([30, 7, 3, 1])("Partner %s-day reminders use the partnership end, not the Pro grace deadline", async (days) => {
	const end = new Date(now.getTime() + days * 86400000);
	row = { id: "grant", userId: "alex", source: "partner", entitlement: "pro_access", startsAt: new Date(now.getTime() - 60 * 86400000), endsAt: end, revokedAt: null };
	const notice: DeliveryRecord = { ...benefitRecord("partner"), payload: { event: `partner-ending-${days}d`, grantId: "grant", endsAt: end.toISOString(), partner: true } };
	expect(await notificationStillApplies(notice, now)).toBe(true);
	expect(await notificationStillApplies(notice, end)).toBe(false);
	row.endsAt = null;
	expect(await notificationStillApplies(notice, now)).toBe(false);
});

test("Runner countdowns and expiry honor other Runner access without referring to Pro", async () => {
	row = { userId: "alex", status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: new Date(now.getTime() + 7 * 86400000) };
	const reminder: DeliveryRecord = { ...record("runner"), event_type: "billing", payload: { event: "cancellation-7d", benefit: "runner", subscriptionId: "runner", endsAt: (row.currentPeriodEnd as Date).toISOString() } };
	expect(await notificationStillApplies(reminder, now)).toBe(true);
	continuingPro.mockResolvedValue(true);
	expect(await notificationStillApplies(reminder, now)).toBe(false);
	row = { id: "grant", userId: "alex", entitlement: "runner_access", source: "support", revokedAt: null, startsAt: new Date(now.getTime() - 86400000), endsAt: now };
	const ended: DeliveryRecord = { ...benefitRecord("ended"), payload: { event: "ended", benefit: "runner", grantId: "grant", endsAt: now.toISOString() } };
	expect(await notificationStillApplies(ended, now)).toBe(true);
	expect(ended.payload.runnerContinues).toBe(true);
});
