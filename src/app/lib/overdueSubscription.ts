import "server-only";

import { db } from "@/db/client";
import { billingSubscriptionItemsTable, billingSubscriptionsTable } from "@/db/schema";
import { OVERDUE_BILLING_STATUSES } from "@lib/billingNotice";
import { BillingProduct } from "@types";
import { and, desc, eq, inArray } from "drizzle-orm";

export async function findOverdueProSubscription(userId: string, customerId: string) {
	const [subscription] = await db
		.select({ id: billingSubscriptionsTable.id, period: billingSubscriptionsTable.currentPeriodStart, createdAt: billingSubscriptionsTable.createdAt })
		.from(billingSubscriptionsTable)
		.innerJoin(billingSubscriptionItemsTable, eq(billingSubscriptionItemsTable.subscriptionId, billingSubscriptionsTable.id))
		.where(and(eq(billingSubscriptionsTable.userId, userId), eq(billingSubscriptionsTable.stripeCustomerId, customerId), eq(billingSubscriptionItemsTable.productKey, BillingProduct.Pro), inArray(billingSubscriptionsTable.status, OVERDUE_BILLING_STATUSES)))
		.orderBy(desc(billingSubscriptionsTable.currentPeriodStart), desc(billingSubscriptionsTable.createdAt))
		.limit(1);
	return subscription;
}
