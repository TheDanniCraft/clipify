import { createHmac } from "node:crypto";

export interface StripeSubscriptionFixture {
	id: string;
	customerId: string;
	status: "active" | "trialing" | "past_due" | "canceled";
	currentPeriodEnd: number;
	cancelAtPeriodEnd: boolean;
	created: number;
}

export interface StripeWebhookFixture {
	id: string;
	type: string;
	created: number;
	data: { object: StripeSubscriptionFixture };
}

export function stripeSubscriptionFixture(overrides: Partial<StripeSubscriptionFixture> = {}): StripeSubscriptionFixture {
	return {
		id: "sub_fixture_0001",
		customerId: "cus_fixture_0001",
		status: "active",
		currentPeriodEnd: 1_801_046_400,
		cancelAtPeriodEnd: false,
		created: 1_798_454_400,
		...overrides,
	};
}

export function stripeWebhookFixture(sequence = 1, overrides: Partial<StripeWebhookFixture> = {}): StripeWebhookFixture {
	return {
		id: `evt_fixture_${String(sequence).padStart(4, "0")}`,
		type: "customer.subscription.updated",
		created: 1_798_454_400 + sequence,
		data: { object: stripeSubscriptionFixture() },
		...overrides,
	};
}

export function reorderedStripeWebhooks(): StripeWebhookFixture[] {
	return [stripeWebhookFixture(3), stripeWebhookFixture(1), stripeWebhookFixture(2)];
}

export function signStripePayload(payload: string, secret = "whsec_fixture_only", timestamp = 1_798_454_400): string {
	const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
	return `t=${timestamp},v1=${signature}`;
}
