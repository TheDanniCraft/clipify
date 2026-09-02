import "server-only";

import { db } from "@/db/client";
import { sql } from "drizzle-orm";

// ON CONFLICT increments the persisted row, not the proposed population seed.
// This single statement serializes allocations even on concurrent first signups.
// Keep the row forever; gaps from failed signups are safer than recycling numbers.
export const memberNumberAllocationQuery = sql`
	INSERT INTO member_number_allocator (id, legacy_reserved_through, last_allocated)
	SELECT 1, baseline, baseline + 1
	FROM (SELECT GREATEST(COUNT(*), COALESCE(MAX(member_number), 0))::integer AS baseline FROM users) AS seed
	ON CONFLICT (id) DO UPDATE
	SET last_allocated = member_number_allocator.last_allocated + 1
	RETURNING last_allocated AS "memberNumber"
`;

export async function allocateMemberNumber(): Promise<number> {
	const result = await db.execute<{ memberNumber: number }>(memberNumberAllocationQuery);
	const memberNumber = result.rows[0]?.memberNumber;
	if (!Number.isSafeInteger(memberNumber) || memberNumber <= 0) throw new Error("Could not allocate member number");
	return memberNumber;
}
