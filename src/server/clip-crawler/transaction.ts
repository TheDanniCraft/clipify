import "server-only";
import { sql } from "drizzle-orm";
import type { TransactionClient } from "@/db/client";

/** Bind the queue's static parameterized SQL to the caller's authorization transaction. */
export function crawlTransactionConnection(transaction: TransactionClient) {
	return {
		async query(statement: string, parameters: unknown[] = []) {
			const parts = statement.split(/\$(\d+)/g);
			const query = sql.join(
				parts.map((part, index) => (index % 2 ? sql`${parameters[Number(part) - 1]}` : sql.raw(part))),
				sql.empty(),
			);
			return transaction.execute(query);
		},
	};
}
