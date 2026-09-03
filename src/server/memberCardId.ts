import "server-only";

import { createHash } from "node:crypto";
import { sql, type SQLWrapper } from "drizzle-orm";

// Public, permanent namespace: changing this would change every shared URL.
// This is an opaque identifier, not a secret or an authorization mechanism.
const namespace = "clipify:member-card:v1:";

/** Deterministic UUIDv8: first 128 SHA-256 bits, with UUID version/variant bits. */
export function memberCardIdForUser(userId: string): string {
	const bytes = createHash("sha256")
		.update(namespace + userId, "utf8")
		.digest()
		.subarray(0, 16);
	bytes[6] = (bytes[6] & 0x0f) | 0x80;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = bytes.toString("hex");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Same derivation with PostgreSQL 11+'s core sha256(bytea); no pgcrypto extension, stored column or backfill. */
export function memberCardIdExpression(userId: SQLWrapper) {
	const digest = sql`substring(sha256(convert_to(${namespace} || ${userId}, 'UTF8')) from 1 for 16)`;
	return sql<string>`encode(set_byte(set_byte(${digest}, 6, (get_byte(${digest}, 6) & 15) | 128), 8, (get_byte(${digest}, 8) & 63) | 128), 'hex')::uuid`;
}
