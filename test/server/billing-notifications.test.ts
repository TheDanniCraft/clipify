/** @jest-environment node */
const recoveryEnded = jest.fn();
jest.mock("@/server/notifications/pro-events", () => ({ queuePaymentRecoveryEnded: (...args: unknown[]) => recoveryEnded(...args) }));
const reminders = jest.fn();
const queue = jest.fn(),
	reconcile = jest.fn();
let previous: unknown = null,
	applied = true;
const chain = (result: unknown = []) => {
	const q: any = {};
	for (const method of ["from", "where", "limit", "for", "values", "onConflictDoUpdate", "innerJoin", "set"]) q[method] = () => q;
	q.returning = () => q;
	q.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
	return q;
};
jest.mock("@/db/client", () => ({ db: { transaction: async (operation: any) => operation({ select: () => chain(previous ? [previous] : []), insert: () => chain(applied ? [{ id: "sub-1" }] : []), delete: () => chain() }), select: () => chain([]), update: () => chain(), insert: () => chain(), query: { usersTable: { findFirst: async () => ({ id: "alex" }) } } } }));
jest.mock("@/server/billingCatalog", () => ({ resolveBillingProductForPrice: async (price: any) => price.metadata.key }));
jest.mock("@lib/entitlements", () => ({ reconcileUserEntitlements: (...args: unknown[]) => reconcile(...args) }));
jest.mock("@/server/notifications/benefit-events", () => ({ queueCancellationEmail: (...args: unknown[]) => queue(...args), queueSubscriptionCancellationReminders: (...args: unknown[]) => reminders(...args) }));
import { syncStripeSubscription } from "@/server/billing";
import { BillingProduct } from "@types";
const subscription = (product = BillingProduct.Pro, cancel = true, status = "active"): any => ({ id: "sub-1", customer: "cus-1", metadata: { userId: "alex" }, created: 100, status, cancel_at_period_end: cancel, canceled_at: null, items: { data: [{ id: "item-1", current_period_start: 100, current_period_end: 200, price: { id: "price-1", product: "product-1", recurring: { interval: "month" }, currency: "eur", unit_amount: 1000, metadata: { key: product } } }] } });
beforeEach(() => {
	jest.clearAllMocks();
	previous = { status: "active", cancelAtPeriodEnd: false };
	applied = true;
});
test("a confirmed cancellation queues the correct product after the state update", async () => {
	await syncStripeSubscription(subscription(BillingProduct.RunnerSelfHosted), null, 123);
	expect(queue).toHaveBeenCalledWith(expect.objectContaining({ subscriptionId: "sub-1", eventCreated: 123, benefit: "runner", endsAt: new Date(200000) }), expect.anything());
});
test("repeat cancellation snapshots do not enqueue another email", async () => {
	previous = { status: "active", cancelAtPeriodEnd: true };
	await syncStripeSubscription(subscription());
	expect(queue).not.toHaveBeenCalled();
});
test("stale webhooks and resumed subscriptions never send cancellation notices", async () => {
	applied = false;
	await syncStripeSubscription(subscription());
	expect(queue).not.toHaveBeenCalled();
	applied = true;
	await syncStripeSubscription(subscription(BillingProduct.Pro, false));
	expect(queue).not.toHaveBeenCalled();
});
test("immediate cancellation states that access ended, without promising an additional period", async () => {
	await syncStripeSubscription(subscription(BillingProduct.Pro, false, "canceled"));
	expect(queue).toHaveBeenCalledWith(expect.objectContaining({ benefit: "pro", endsAt: null }), expect.anything());
});

test("recovery exhaustion queues one access notice, not another failed-payment reminder", async () => {
	previous = { status: "past_due", cancelAtPeriodEnd: false };
	await syncStripeSubscription(subscription(BillingProduct.Pro, false, "unpaid"), null, 125);
	expect(recoveryEnded).toHaveBeenCalledWith(expect.objectContaining({ userId: "alex", subscriptionId: "sub-1", eventCreated: 125 }), expect.anything());
	expect(queue).not.toHaveBeenCalled();
});
test("payment failure during retries keeps access and sends no Clipify dunning", async () => {
	await syncStripeSubscription(subscription(BillingProduct.Pro, false, "past_due"), null, 125);
	expect(recoveryEnded).not.toHaveBeenCalled();
	expect(queue).not.toHaveBeenCalled();
});

test("a customer can cancel renewal while a payment is past due and still receive confirmation", async () => {
	previous = { status: "past_due", cancelAtPeriodEnd: false };
	await syncStripeSubscription(subscription(BillingProduct.Pro, true, "past_due"), null, 126);
	expect(recoveryEnded).not.toHaveBeenCalled();
	expect(queue).toHaveBeenCalledWith(expect.objectContaining({ benefit: "pro", endsAt: new Date(200000) }), expect.anything());
});

test("Stripe-synced Pro cancellation schedules reminders even on repeated snapshots", async () => {
	previous = { status: "active", cancelAtPeriodEnd: true };
	await syncStripeSubscription(subscription());
	expect(reminders).toHaveBeenCalledWith({ userId: "alex", subscriptionId: "sub-1", endsAt: new Date(200000) }, expect.anything());
	reminders.mockClear();
	await syncStripeSubscription(subscription(BillingProduct.Pro, false));
	expect(reminders).not.toHaveBeenCalled();
});

test("final Pro cancellation notice is queued only after Stripe confirms the planned cancellation", async () => {
	previous = { status: "active", cancelAtPeriodEnd: true };
	await syncStripeSubscription(subscription(BillingProduct.Pro, false, "canceled"));
	expect(reminders).toHaveBeenCalledWith(expect.objectContaining({ ended: true, subscriptionId: "sub-1" }), expect.anything());
	reminders.mockClear();
	previous = { status: "past_due", cancelAtPeriodEnd: true };
	const failed = subscription(BillingProduct.Pro, false, "canceled");
	failed.cancellation_details = { reason: "payment_failed" };
	await syncStripeSubscription(failed);
	expect(reminders).not.toHaveBeenCalled();
});
