/** @jest-environment node */

const headersMock = jest.fn();
const getStripe = jest.fn();
const getPlans = jest.fn();
const downgradeUserPlan = jest.fn();
const getUserByCustomerId = jest.fn();
const updateUserSubscription = jest.fn();

jest.mock("next/headers", () => ({
	headers: () => headersMock(),
}));

jest.mock("@actions/subscription", () => ({
	getStripe: () => getStripe(),
	getPlans: () => getPlans(),
}));

jest.mock("@actions/database", () => ({
	downgradeUserPlan: (...args: unknown[]) => downgradeUserPlan(...args),
	getUserByCustomerId: (...args: unknown[]) => getUserByCustomerId(...args),
	updateUserSubscription: (...args: unknown[]) => updateUserSubscription(...args),
}));

async function loadRoute(secret = "whsec_test") {
	jest.resetModules();
	process.env.STRIPE_WEBHOOK_KEY = secret;
	return import("@/app/payment/webhook/route");
}

describe("app/payment/webhook route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		headersMock.mockResolvedValue({
			get: () => "sig_header",
		});
	});

	it("returns 400 when stripe signature verification fails", async () => {
		const stripe = {
			webhooks: {
				constructEvent: jest.fn(() => {
					throw new Error("bad signature");
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toMatchObject({ error: "bad signature" });
	});

	it("returns empty JSON for unhandled events", async () => {
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "customer.created",
					data: { object: {} },
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));

		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({});
	});

	it("handles checkout.session.completed happy path", async () => {
		getPlans.mockResolvedValue({ proMonthly: "price_pro" });
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "checkout.session.completed",
					data: {
						object: { id: "cs_123" },
					},
				}),
			},
			checkout: {
				sessions: {
					retrieve: jest.fn().mockResolvedValue({
						id: "cs_123",
						customer: "cus_123",
						client_reference_id: "user_1",
						line_items: {
							data: [{ price: { id: "price_pro" } }],
						},
					}),
				},
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));

		expect(res.status).toBe(200);
		expect(updateUserSubscription).toHaveBeenCalledWith("user_1", "cus_123", "pro");
	});

	it("handles customer.subscription.deleted and downgrades", async () => {
		getUserByCustomerId.mockResolvedValue({ id: "user_2" });
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "customer.subscription.deleted",
					data: {
						object: {
							customer: "cus_2",
							status: "canceled",
						},
					},
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		expect(updateUserSubscription).toHaveBeenCalledWith("user_2", "cus_2", "free");
		expect(downgradeUserPlan).toHaveBeenCalledWith("user_2");
	});

	it("handles customer.subscription.updated for active status", async () => {
		getUserByCustomerId.mockResolvedValue({ id: "user_3" });
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "customer.subscription.updated",
					data: {
						object: {
							customer: "cus_3",
							status: "active",
						},
					},
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		expect(updateUserSubscription).toHaveBeenCalledWith("user_3", "cus_3", "pro");
		expect(downgradeUserPlan).not.toHaveBeenCalled();
	});

	it("returns error for checkout session with missing price id", async () => {
		getPlans.mockResolvedValue({ proMonthly: "price_pro" });
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "checkout.session.completed",
					data: {
						object: { id: "cs_124" },
					},
				}),
			},
			checkout: {
				sessions: {
					retrieve: jest.fn().mockResolvedValue({
						id: "cs_124",
						customer: "cus_124",
						client_reference_id: "user_124",
						line_items: {
							data: [{ price: null }],
						},
					}),
				},
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ error: "No price ID found in session" });
	});

	it("returns error for checkout session with unknown price plan", async () => {
		getPlans.mockResolvedValue({ proMonthly: "price_pro" });
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "checkout.session.completed",
					data: {
						object: { id: "cs_unknown" },
					},
				}),
			},
			checkout: {
				sessions: {
					retrieve: jest.fn().mockResolvedValue({
						id: "cs_unknown",
						customer: "cus_unknown",
						client_reference_id: "user_unknown",
						line_items: {
							data: [{ price: { id: "price_other" } }],
						},
					}),
				},
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ error: "No plan found for this price" });
	});

	it("returns error for checkout session with missing reference id", async () => {
		getPlans.mockResolvedValue({ proMonthly: "price_pro" });
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "checkout.session.completed",
					data: {
						object: { id: "cs_missing_ref" },
					},
				}),
			},
			checkout: {
				sessions: {
					retrieve: jest.fn().mockResolvedValue({
						id: "cs_missing_ref",
						customer: "cus_missing_ref",
						client_reference_id: null,
						line_items: {
							data: [{ price: { id: "price_pro" } }],
						},
					}),
				},
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ error: "No reference ID found in session metadata" });
	});

	it("returns error for missing checkout session during retrieval", async () => {
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "checkout.session.completed",
					data: { object: { id: "cs_missing" } },
				}),
			},
			checkout: {
				sessions: {
					retrieve: jest.fn().mockResolvedValue(null),
				},
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ error: "No session found" });
	});

	it("returns error for non-string customer ID in checkout session", async () => {
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "checkout.session.completed",
					data: { object: { id: "cs_bad_cus" } },
				}),
			},
			checkout: {
				sessions: {
					retrieve: jest.fn().mockResolvedValue({
						id: "cs_bad_cus",
						customer: { id: "obj_cus" }, // object instead of string
					}),
				},
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ error: "Invalid customer ID" });
	});

	it("handles customer as object in subscription events", async () => {
		getUserByCustomerId.mockResolvedValue({ id: "user_obj" });
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "customer.subscription.deleted",
					data: {
						object: {
							customer: { id: "cus_obj" },
							status: "canceled",
						},
					},
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		expect(updateUserSubscription).toHaveBeenCalledWith("user_obj", "cus_obj", "free");
	});

	it("returns error for missing subscription object in events", async () => {
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "customer.subscription.deleted",
					data: { object: null },
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ error: "No subscription found" });
	});

	it("returns error for invalid/null customer in subscription object", async () => {
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "customer.subscription.updated",
					data: {
						object: { customer: null },
					},
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ error: "Invalid customer ID in subscription" });
	});

	it("returns error when deleted subscription customer does not map to a user", async () => {
		getUserByCustomerId.mockResolvedValue(null);
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "customer.subscription.deleted",
					data: {
						object: {
							customer: "cus_missing",
							status: "canceled",
						},
					},
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ error: "No user found for this subscription" });
		expect(updateUserSubscription).not.toHaveBeenCalled();
		expect(downgradeUserPlan).not.toHaveBeenCalled();
	});

	it("downgrades user on subscription.updated when status is inactive", async () => {
		getUserByCustomerId.mockResolvedValue({ id: "user_4" });
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "customer.subscription.updated",
					data: {
						object: {
							customer: "cus_4",
							status: "canceled",
						},
					},
				}),
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(200);
		expect(updateUserSubscription).toHaveBeenCalledWith("user_4", "cus_4", "free");
		expect(downgradeUserPlan).toHaveBeenCalledWith("user_4");
	});

	it("returns 400 when webhook event processing throws downstream errors", async () => {
		getPlans.mockResolvedValue({ proMonthly: "price_pro" });
		updateUserSubscription.mockRejectedValue(new Error("db write failed"));
		const stripe = {
			webhooks: {
				constructEvent: jest.fn().mockReturnValue({
					type: "checkout.session.completed",
					data: {
						object: { id: "cs_500" },
					},
				}),
			},
			checkout: {
				sessions: {
					retrieve: jest.fn().mockResolvedValue({
						id: "cs_500",
						customer: "cus_500",
						client_reference_id: "user_500",
						line_items: {
							data: [{ price: { id: "price_pro" } }],
						},
					}),
				},
			},
		};
		getStripe.mockResolvedValue(stripe);

		const { POST } = await loadRoute("whsec_test");
		const res = await POST(new Request("http://localhost/payment/webhook", { method: "POST", body: "payload" }));
		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({ error: "db write failed" });
	});
});
