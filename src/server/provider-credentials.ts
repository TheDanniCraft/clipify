import "server-only";
import { observeTwitchRefresh } from "./notifications/twitch-account-access";
import { withoutDatabaseRequest } from "@/db/request-scope";

import { db, dbPool } from "@/db/client";
import { account as authAccountTable } from "@/db/auth-schema";
import { creatorIdentityLinksTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { Pool } from "pg";

type CredentialWaiter = { start: () => void; timer: ReturnType<typeof setTimeout> };
const credentialCapacity = new WeakMap<Pool, { active: number; waiters: Set<CredentialWaiter> }>();

/** Reserve storage connections while session advisory locks coordinate provider rotation. */
function takeCredentialCapacity(pool: Pool): Promise<() => void> {
	const maximum = pool.options.max ?? 10;
	if (!Number.isSafeInteger(maximum) || maximum < 2) return Promise.reject(new Error("PROVIDER_CREDENTIAL_CAPACITY_UNAVAILABLE"));
	const limit = Math.min(2, maximum - 1);
	let capacity = credentialCapacity.get(pool);
	if (!capacity) {
		capacity = { active: 0, waiters: new Set() };
		credentialCapacity.set(pool, capacity);
	}
	const state = capacity;
	return new Promise((resolve, reject) => {
		let released = false;
		const release = () => {
			if (released) return;
			released = true;
			state.active--;
			const next = state.waiters.values().next().value;
			if (next) {
				state.waiters.delete(next);
				clearTimeout(next.timer);
				next.start();
			}
		};
		const start = () => {
			state.active++;
			resolve(release);
		};
		if (state.active < limit) {
			start();
			return;
		}
		const waiter: CredentialWaiter = {
			start,
			timer: setTimeout(() => {
				state.waiters.delete(waiter);
				reject(new Error("PROVIDER_CREDENTIAL_CAPACITY_UNAVAILABLE"));
			}, 10000),
		};
		state.waiters.add(waiter);
	});
}

export async function withSerializedProviderCredential<T>(pool: Pool, accountId: string, operation: () => Promise<T>): Promise<T> {
	return withoutDatabaseRequest(async () => {
		const releaseCapacity = await takeCredentialCapacity(pool);
		try {
			const client = await pool.connect();
			try {
				await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [`clipify:twitch:${accountId}`]);
				return await operation();
			} finally {
				let discard = false;
				await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [`clipify:twitch:${accountId}`]).catch(() => {
					discard = true;
				});
				client.release(discard);
			}
		} finally {
			releaseCapacity();
		}
	});
}

export async function getBetterAuthProviderAccessToken(creatorId: string) {
	const links = await db.select({ authUserId: creatorIdentityLinksTable.authUserId }).from(creatorIdentityLinksTable).where(eq(creatorIdentityLinksTable.creatorId, creatorId)).limit(1).execute();
	const authUserId = links[0]?.authUserId;
	if (!authUserId) return null;
	const accounts = await db
		.select({ id: authAccountTable.id })
		.from(authAccountTable)
		.where(and(eq(authAccountTable.userId, authUserId), eq(authAccountTable.providerId, "twitch")))
		.limit(1)
		.execute();
	const accountId = accounts[0]?.id;
	if (!accountId) return null;

	return withSerializedProviderCredential(dbPool, accountId, async () => {
		const { auth } = await import("@/auth/config");
		return observeTwitchRefresh(creatorId, () => auth.api.getAccessToken({ body: { accountId, userId: authUserId } }));
	});
}
