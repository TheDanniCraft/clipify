"use server";

import { createMollieClient, SequenceType } from "@mollie/api-client";
import { AuthenticatedUser } from "@types";
import { checkSubscriptionStatus, getSubscriptionData, setSubscriptionData } from "@actions/database";
import { validateAuth } from "@actions/auth";

const mollieClient = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY || "" });

export async function getPayment(paymentId: string) {
	const payment = await mollieClient.payments.get(paymentId);

	if (!payment) {
		throw new Error("Payment not found");
	}

	return payment;
}

export async function getSubscription(subscriptionsId: string, customerId: string) {
	const subscription = await mollieClient.customerSubscriptions.get(subscriptionsId, {
		customerId,
	});

	return subscription;
}

async function getCustomer(user: AuthenticatedUser) {
	try {
		const subscriptionData = await getSubscriptionData(user.id);

		if (!subscriptionData || !subscriptionData.customerId) {
			const customer = await mollieClient.customers.create({
				name: user.id,
				email: user.email,
			});

			await setSubscriptionData(user.id, customer);

			return customer;
		}

		const customer = await mollieClient.customers.get(subscriptionData.customerId);

		return customer;
	} catch (error) {
		console.error("Error fetching customer:", error);
		throw new Error("Failed to fetch customer");
	}
}

export async function initSubscription(user: AuthenticatedUser) {
	try {
		const isAuthenticated = await validateAuth(true);
		if (!isAuthenticated || isAuthenticated.id !== user.id) {
			console.warn(`Unauthenticated "createSubscription" API request for user id: ${user.id}`);
			return null;
		}

		const customer = await getCustomer(user);

		if (!customer) {
			throw new Error("Customer not found");
		}

		const existingSubscription = await checkSubscriptionStatus(user.id);

		if (existingSubscription == "free") {
			const firstPayment = await mollieClient.payments.create({
				amount: {
					currency: "EUR",
					value: "0.00",
				},
				sequenceType: SequenceType.first,
				description: "Upgrade to Pro Plan",
				customerId: customer.id,
				redirectUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/payments/success`,
				cancelUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/payments/cancel`,
				webhookUrl: process.env.MOLLIE_WEBHOOK_URL,
				metadata: {
					userId: user.id,
				},
			});

			return { ...firstPayment };
		}

		return;
	} catch (error) {
		console.error("Error creating subscription:", error);
		throw new Error("Failed to create subscription");
	}
}

export async function createSubscription(user: AuthenticatedUser) {
	const customer = await getCustomer(user);

	if (!customer) {
		throw new Error("Customer not found");
	}

	const subscription = await mollieClient.customerSubscriptions.create({
		customerId: customer.id,
		amount: {
			currency: "EUR",
			value: "1.00",
		},
		description: "Monthly Pro Plan Subscription",
		interval: "1 month",
		webhookUrl: process.env.MOLLIE_WEBHOOK_URL,
	});

	await setSubscriptionData(user.id, customer, subscription);

	return subscription;
}
