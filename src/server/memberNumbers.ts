import "server-only";

import { db, type QueryClient } from "@/db/client";
import { count, max, sql } from "drizzle-orm";
import { memberNumberAllocatorTable, usersTable } from "@/db/schema";

// ON CONFLICT increments the persisted row, not the proposed population seed.
// This single statement serializes allocations even on concurrent first signups.
// Keep the row forever; gaps from failed signups are safer than recycling numbers.
export async function allocateMemberNumber(client: QueryClient = db): Promise<number> {
	const seed = client
		.select({ baseline: sql<number>`greatest(${count()}, coalesce(${max(usersTable.memberNumber)}, 0))::integer`.as("baseline") })
		.from(usersTable)
		.as("seed");
	const [result] = await client
		.insert(memberNumberAllocatorTable)
		.select(
			client
				.select({ id: sql<number>`1`.as("id"), legacyReservedThrough: seed.baseline, lastAllocated: sql<number>`${seed.baseline} + 1`.as("last_allocated") })
				.from(seed)
				// Disambiguate PostgreSQL INSERT SELECT ... ON CONFLICT parsing.
				.where(sql`true`),
		)
		.onConflictDoUpdate({ target: memberNumberAllocatorTable.id, set: { lastAllocated: sql`${memberNumberAllocatorTable.lastAllocated} + 1` } })
		.returning({ memberNumber: memberNumberAllocatorTable.lastAllocated });
	const memberNumber = result?.memberNumber;
	if (!Number.isSafeInteger(memberNumber) || memberNumber <= 0) throw new Error("Could not allocate member number");
	return memberNumber;
}
