import "server-only";

import { db } from "@/db/client";
import { usersTable } from "@/db/schema";
import { Plan } from "@types";
import { eq } from "drizzle-orm";

export async function updateUserSubscriptionFromStripeWebhookInternal(userId: string, customerId: string, plan: Plan): Promise<void> {
	await db
		.update(usersTable)
		.set({
			plan,
			stripeCustomerId: customerId,
			updatedAt: new Date(),
		})
		.where(eq(usersTable.id, userId))
		.execute();
}
