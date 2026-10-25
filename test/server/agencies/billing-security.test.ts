/** @jest-environment node */
export {};

const requireAgencyMember = jest.fn();
const getStripe = jest.fn();
const select = jest.fn();
const update = jest.fn();
const customersList = jest.fn();
const customersCreate = jest.fn();
const customersUpdate = jest.fn();
const customersRetrieve = jest.fn();
const portalCreate = jest.fn();

jest.mock("@/server/agencies/database", () => ({ requireAgencyMember: (...args: unknown[]) => requireAgencyMember(...args) }));
jest.mock("@/server/stripe", () => ({ getStripe: (...args: unknown[]) => getStripe(...args) }));
jest.mock("@/db/client", () => ({ db: { select: (...args: unknown[]) => select(...args), update: (...args: unknown[]) => update(...args) } }));

describe("agency Stripe customer ownership", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		requireAgencyMember.mockResolvedValue({ account: { organizationId: "org-1" } });
		const billing = { organizationId: "org-1", billingEmail: "shared@example.test", stripeCustomerId: null };
		select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [billing] }) }) });
		update.mockReturnValue({ set: () => ({ where: async () => undefined }) });
		getStripe.mockReturnValue({
			customers: { list: customersList, create: customersCreate, update: customersUpdate, retrieve: customersRetrieve },
			billingPortal: { sessions: { create: portalCreate } },
		});
		portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/portal" });
		customersCreate.mockResolvedValue({ id: "cus_new" });
	});

	it("creates a separate customer when an email matches another organization", async () => {
		customersList.mockResolvedValue({ data: [{ id: "cus_other", deleted: false, metadata: { clipifyAgencyOrganizationId: "org-other" } }] });
		const { createAgencyBillingPortal } = await import("@/server/agencies/billing");

		await expect(createAgencyBillingPortal()).resolves.toEqual({ kind: "portal", url: "https://billing.stripe.test/portal" });
		expect(customersCreate).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ clipifyAgencyOrganizationId: "org-1" }) }), expect.any(Object));
		expect(customersUpdate).not.toHaveBeenCalled();
		expect(portalCreate).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_new" }));
	});

	it("refuses a stored customer bound to another organization", async () => {
		select.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ organizationId: "org-1", billingEmail: "shared@example.test", stripeCustomerId: "cus_other" }] }) }) });
		customersRetrieve.mockResolvedValue({ id: "cus_other", deleted: false, metadata: { clipifyAgencyOrganizationId: "org-other" } });
		const { createAgencyBillingPortal } = await import("@/server/agencies/billing");

		await expect(createAgencyBillingPortal()).rejects.toThrow("AGENCY_STRIPE_CUSTOMER_MISMATCH");
		expect(portalCreate).not.toHaveBeenCalled();
	});
});
