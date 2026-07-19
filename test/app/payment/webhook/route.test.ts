/** @jest-environment node */

const headersMock = jest.fn();
const getStripe = jest.fn();
const syncStripeSubscription = jest.fn();
const findEvent = jest.fn();
const insertValues = jest.fn();
const insertReturning = jest.fn();
const updateWhere = jest.fn();

const updateBuilder = {
	set: jest.fn(),
	where: () => updateBuilder,
	returning: () => updateWhere(),
};
type InsertBuilder = {
	values: (...args: unknown[]) => InsertBuilder;
	onConflictDoNothing: jest.Mock;
	returning: () => unknown;
};
const insertBuilder: InsertBuilder = {
	values: (...args: unknown[]) => {
		insertValues(...args);
		return insertBuilder;
	},
	onConflictDoNothing: jest.fn(() => insertBuilder),
	returning: () => insertReturning(),
};
updateBuilder.set.mockImplementation(() => updateBuilder);

jest.mock("next/headers", () => ({ headers: () => headersMock() }));
jest.mock("@actions/subscription", () => ({ getStripe: () => getStripe() }));
jest.mock("@/server/billing", () => ({ syncStripeSubscription: (...args: unknown[]) => syncStripeSubscription(...args) }));
jest.mock("@/db/client", () => ({
	db: {
		query: { billingWebhookEventsTable: { findFirst: (...args: unknown[]) => findEvent(...args) } },
		insert: jest.fn(() => insertBuilder),
		update: jest.fn(() => updateBuilder),
	},
}));

async function loadRoute(secret = "whsec_test") {
	jest.resetModules();
	process.env.STRIPE_WEBHOOK_KEY = secret;
	return import("@/app/payment/webhook/route");
}

describe("app/payment/webhook route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		headersMock.mockResolvedValue({ get: () => "sig_header" });
		findEvent.mockResolvedValue(undefined);
		insertValues.mockResolvedValue(undefined);
		insertReturning.mockResolvedValue([{ id: "claimed" }]);
		updateWhere.mockResolvedValue([{ id: "claimed" }]);
		syncStripeSubscription.mockResolvedValue(undefined);
	});

	it("rejects invalid Stripe signatures", async () => {
		getStripe.mockResolvedValue({
			webhooks: {
				constructEvent: jest.fn(() => {
					throw new Error("bad signature");
				}),
			},
		});
		const { POST } = await loadRoute();
		const response = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(response.status).toBe(400);
	});

	it("ignores unhandled events without recording them", async () => {
		getStripe.mockResolvedValue({ webhooks: { constructEvent: jest.fn(() => ({ id: "evt_1", type: "customer.created", data: { object: {} } })) } });
		const { POST } = await loadRoute();
		const response = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(response.status).toBe(200);
		expect(findEvent).not.toHaveBeenCalled();
	});

	it("retrieves and synchronizes the canonical checkout subscription", async () => {
		const subscription = { id: "sub_1", customer: "cus_1", items: { data: [] } };
		const stripe = {
			webhooks: { constructEvent: jest.fn(() => ({ id: "evt_2", type: "checkout.session.completed", data: { object: { id: "cs_1" } } })) },
			checkout: { sessions: { retrieve: jest.fn().mockResolvedValue({ id: "cs_1", client_reference_id: "user_1", subscription: "sub_1" }) } },
			subscriptions: { retrieve: jest.fn().mockResolvedValue(subscription) },
		};
		getStripe.mockResolvedValue(stripe);
		const { POST } = await loadRoute();
		const response = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(response.status).toBe(200);
		expect(syncStripeSubscription).toHaveBeenCalledWith(subscription, "user_1");
	});

	it("skips already processed event ids", async () => {
		findEvent.mockResolvedValue({ id: "evt_3", status: "processed" });
		getStripe.mockResolvedValue({ webhooks: { constructEvent: jest.fn(() => ({ id: "evt_3", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } })) } });
		const { POST } = await loadRoute();
		const response = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		await expect(response.json()).resolves.toEqual({ duplicate: true });
		expect(syncStripeSubscription).not.toHaveBeenCalled();
	});

	it("returns a retryable response while another worker holds a fresh processing lease", async () => {
		findEvent.mockResolvedValue({ id: "evt_busy", status: "processing", processingStartedAt: new Date(), retryCount: 0 });
		getStripe.mockResolvedValue({ webhooks: { constructEvent: jest.fn(() => ({ id: "evt_busy", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } })) } });
		const { POST } = await loadRoute();

		const response = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));

		expect(response.status).toBe(503);
		expect(response.headers.get("Retry-After")).toBe("30");
		expect(syncStripeSubscription).not.toHaveBeenCalled();
	});

	it("reclaims a stale processing lease and finishes the event", async () => {
		const subscription = { id: "sub_1", customer: "cus_1", items: { data: [] } };
		findEvent.mockResolvedValue({ id: "evt_stale", status: "processing", processingStartedAt: new Date(Date.now() - 10 * 60 * 1000), retryCount: 0 });
		getStripe.mockResolvedValue({
			webhooks: { constructEvent: jest.fn(() => ({ id: "evt_stale", type: "customer.subscription.updated", data: { object: { id: "sub_1" } } })) },
			subscriptions: { retrieve: jest.fn().mockResolvedValue(subscription) },
		});
		const { POST } = await loadRoute();

		const response = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));

		expect(response.status).toBe(200);
		expect(updateWhere).toHaveBeenCalled();
		expect(syncStripeSubscription).toHaveBeenCalledWith(subscription);
	});
});
