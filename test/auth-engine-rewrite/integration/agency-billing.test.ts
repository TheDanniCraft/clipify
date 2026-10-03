import { agencyIncreasePaymentBehavior, decideAgencySeatChange, resolveAgencyCapacitySnapshot, resolveWebhookCapacity, shouldApplyAgencyStripeSnapshot } from "@/server/agencies/billing-policy";

describe("TDD-US4-004 agency billing capacity", () => {
	it("invoices an increase immediately and leaves activation pending payment", () => {
		expect(decideAgencySeatChange({ currentQuantity: 50, requestedQuantity: 60, minimumQuantity: 50, occupiedQuantity: 42 })).toEqual({
			kind: "increase",
			quantity: 60,
			prorationBehavior: "always_invoice",
			paymentBehavior: "pending_if_incomplete",
		});
	});

	it("schedules a permitted decrease at the next billing boundary", () => {
		expect(decideAgencySeatChange({ currentQuantity: 60, requestedQuantity: 55, minimumQuantity: 50, occupiedQuantity: 53 })).toEqual({
			kind: "decrease",
			quantity: 55,
			effective: "next_period",
		});
	});

	it.each([
		{ requestedQuantity: 49, minimumQuantity: 50, occupiedQuantity: 20, error: "AGENCY_SEAT_MINIMUM_REQUIRED" },
		{ requestedQuantity: 54, minimumQuantity: 50, occupiedQuantity: 55, error: "AGENCY_OCCUPIED_SEATS_REQUIRED" },
		{ requestedQuantity: -1, minimumQuantity: 0, occupiedQuantity: 0, error: "INVALID_AGENCY_SEAT_QUANTITY" },
	])("rejects an invalid reduction before mutating Stripe: $error", ({ requestedQuantity, minimumQuantity, occupiedQuantity, error }) => {
		expect(() => decideAgencySeatChange({ currentQuantity: 60, requestedQuantity, minimumQuantity, occupiedQuantity })).toThrow(error);
	});

	it("does not grant an increase while Stripe still has a pending update", () => {
		expect(resolveWebhookCapacity({ previousQuantity: 50, stripeQuantity: 60, subscriptionStatus: "active", hasPendingUpdate: true })).toBe(50);
	});

	it("accepts the Stripe quantity only after the paid update is authoritative", () => {
		expect(resolveWebhookCapacity({ previousQuantity: 50, stripeQuantity: 60, subscriptionStatus: "active", hasPendingUpdate: false })).toBe(60);
	});

	it.each(["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"])("does not grant capacity from a %s subscription", (subscriptionStatus) => {
		expect(resolveWebhookCapacity({ previousQuantity: 50, stripeQuantity: 60, subscriptionStatus, hasPendingUpdate: false })).toBe(50);
	});

	it("holds invoice-billed capacity until the invoice is paid", () => {
		expect(resolveAgencyCapacitySnapshot({ previousQuantity: 50, stripeQuantity: 60, subscriptionStatus: "active", hasPendingUpdate: false, collectionMethod: "send_invoice", invoicePaymentConfirmed: false })).toBe(50);
		expect(resolveAgencyCapacitySnapshot({ previousQuantity: 50, stripeQuantity: 60, subscriptionStatus: "active", hasPendingUpdate: false, collectionMethod: "send_invoice", invoicePaymentConfirmed: true })).toBe(60);
	});

	it("changes seats for both collection methods while only card collection uses pending payment updates", () => {
		expect(agencyIncreasePaymentBehavior("charge_automatically")).toBe("pending_if_incomplete");
		expect(agencyIncreasePaymentBehavior("send_invoice")).toBeUndefined();
	});

	it("does not activate an initial invoice subscription before its first payment", () => {
		expect(resolveAgencyCapacitySnapshot({ previousQuantity: 0, stripeQuantity: 20, subscriptionStatus: "active", hasPendingUpdate: false, collectionMethod: "send_invoice", invoicePaymentConfirmed: false })).toBe(0);
		expect(resolveAgencyCapacitySnapshot({ previousQuantity: 0, stripeQuantity: 20, subscriptionStatus: "active", hasPendingUpdate: false, collectionMethod: "send_invoice", invoicePaymentConfirmed: true })).toBe(20);
	});

	it("revokes cached capacity when Stripe reports a terminal subscription", () => {
		expect(resolveAgencyCapacitySnapshot({ previousQuantity: 50, stripeQuantity: 50, subscriptionStatus: "canceled", hasPendingUpdate: false, collectionMethod: "charge_automatically", invoicePaymentConfirmed: false })).toBe(0);
	});

	it("ignores older snapshots while accepting a canonical refresh created in the same second", () => {
		expect(shouldApplyAgencyStripeSnapshot(101, 100)).toBe(false);
		expect(shouldApplyAgencyStripeSnapshot(101, 101)).toBe(true);
		expect(shouldApplyAgencyStripeSnapshot(101, 102)).toBe(true);
	});
});
