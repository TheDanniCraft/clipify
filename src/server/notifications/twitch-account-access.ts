import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { usersTable, overlaysTable, creatorIdentityLinksTable } from "@/db/schema";
import { StatusOptions } from "@types";
import { queueAccountAccessEmail } from "./account-access-events";
const refreshOutcome = new AsyncLocalStorage<{ invalid: boolean }>();
export function markInvalidTwitchRefresh() {
	const outcome = refreshOutcome.getStore();
	if (outcome) outcome.invalid = true;
}
/** Caller supplies a resolved creator identity while holding the provider rotation lock. */
export async function observeTwitchRefresh<T>(creatorId: string, operation: () => Promise<T>): Promise<T> {
	const outcome = { invalid: false };
	return refreshOutcome.run(outcome, async () => {
		try {
			return await operation();
		} catch (error) {
			if (outcome.invalid) await changeTwitchAccountAccess(creatorId, true);
			throw error;
		}
	});
}
async function changeTwitchAccountAccess(creatorId: string, disabled: boolean) {
	await db.transaction(async (tx) => {
		const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, creatorId)).for("update");
		if (!user || (disabled ? user.disabled : !user.disabled || user.disableType !== "automatic")) return;
		const now = new Date(),
			reason = disabled ? "Your Twitch authorization could not be refreshed. Please reconnect Twitch." : "";
		await tx
			.update(usersTable)
			.set({ disabled, disableType: disabled ? "automatic" : null, disabledAt: disabled ? now : null, disabledReason: disabled ? reason : null, updatedAt: now })
			.where(eq(usersTable.id, creatorId));
		if (disabled) await tx.update(overlaysTable).set({ status: StatusOptions.Paused, updatedAt: now }).where(eq(overlaysTable.ownerId, creatorId));
		await queueAccountAccessEmail({ userId: user.id, email: user.email, name: user.username, disabled, automatic: disabled, reason, changedAt: now }, tx);
	});
}
export async function restoreTwitchAccountAccess(authUserId: string) {
	const links = await db.select({ creatorId: creatorIdentityLinksTable.creatorId }).from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.authUserId, authUserId));
	for (const link of links) await changeTwitchAccountAccess(link.creatorId, false);
}
