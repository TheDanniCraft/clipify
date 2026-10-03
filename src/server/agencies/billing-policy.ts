export type AgencySeatChange = { kind: "unchanged"; quantity: number } | { kind: "increase"; quantity: number; prorationBehavior: "always_invoice"; paymentBehavior: "pending_if_incomplete" } | { kind: "decrease"; quantity: number; effective: "next_period" };

export function agencyIncreasePaymentBehavior(collectionMethod: "charge_automatically" | "send_invoice") {
	return collectionMethod === "charge_automatically" ? ("pending_if_incomplete" as const) : undefined;
}

function assertQuantity(value: number) {
	if (!Number.isSafeInteger(value) || value < 0) throw new Error("INVALID_AGENCY_SEAT_QUANTITY");
}

export function decideAgencySeatChange(input: { currentQuantity: number; requestedQuantity: number; minimumQuantity: number; occupiedQuantity: number }): AgencySeatChange {
	assertQuantity(input.currentQuantity);
	assertQuantity(input.requestedQuantity);
	assertQuantity(input.minimumQuantity);
	assertQuantity(input.occupiedQuantity);

	if (input.requestedQuantity < input.minimumQuantity) throw new Error("AGENCY_SEAT_MINIMUM_REQUIRED");
	if (input.requestedQuantity < input.occupiedQuantity) throw new Error("AGENCY_OCCUPIED_SEATS_REQUIRED");
	if (input.requestedQuantity === input.currentQuantity) return { kind: "unchanged", quantity: input.currentQuantity };
	if (input.requestedQuantity > input.currentQuantity) {
		return {
			kind: "increase",
			quantity: input.requestedQuantity,
			prorationBehavior: "always_invoice",
			paymentBehavior: "pending_if_incomplete",
		};
	}
	return { kind: "decrease", quantity: input.requestedQuantity, effective: "next_period" };
}

const CAPACITY_BEARING_STATUSES = new Set(["active", "trialing"]);

/**
 * Stripe is authoritative only after a subscription update has fully applied.
 * A pending update means the attempted increase has not been paid yet.
 */
export function resolveWebhookCapacity(input: { previousQuantity: number; stripeQuantity: number; subscriptionStatus: string; hasPendingUpdate: boolean }) {
	assertQuantity(input.previousQuantity);
	assertQuantity(input.stripeQuantity);
	if (!CAPACITY_BEARING_STATUSES.has(input.subscriptionStatus) || input.hasPendingUpdate) return input.previousQuantity;
	return input.stripeQuantity;
}

export function resolveAgencyCapacitySnapshot(input: { previousQuantity: number; stripeQuantity: number; subscriptionStatus: string; hasPendingUpdate: boolean; collectionMethod: "charge_automatically" | "send_invoice"; invoicePaymentConfirmed: boolean }) {
	if (input.subscriptionStatus === "canceled" || input.subscriptionStatus === "incomplete_expired") return 0;
	if (input.collectionMethod === "send_invoice" && !input.invoicePaymentConfirmed && input.stripeQuantity > input.previousQuantity) return input.previousQuantity;
	return resolveWebhookCapacity(input);
}

/** Webhook event IDs are globally deduplicated; equal timestamps are valid canonical refreshes. */
export function shouldApplyAgencyStripeSnapshot(latestAppliedCreated: number, incomingCreated: number) {
	return incomingCreated >= latestAppliedCreated;
}
