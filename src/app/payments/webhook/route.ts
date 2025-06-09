import { getSubscriptionUser } from "@/app/actions/database";
import { createSubscription, getPayment } from "@/app/actions/payments";

export async function POST(request: Request) {
	const res = await request.formData();

	const paymentId = res.get("id") as string;

	if (!paymentId) {
		return new Response("Subscription ID is required", { status: 400 });
	}

	const payment = await getPayment(paymentId);

	if (!payment) {
		return new Response("Payment not found", { status: 404 });
	}

	if (payment.status == "paid") {
		if (payment.sequenceType === "first") {
			const { userId } = payment.metadata as { userId: string };

			const user = await getSubscriptionUser(userId);

			if (!user) {
				return new Response("User not found", { status: 404 });
			}

			await createSubscription(user);
		}
	}

	return new Response(null, { status: 200 });
}
