/** @jest-environment node */
import { recordProductOutcome } from "@/server/product-outcomes";
import type { QueryClient } from "@/db/client";

const values = jest.fn();
const conflict = jest.fn().mockResolvedValue(undefined);
const client = {
	insert: jest.fn(() => ({
		values: (input: unknown) => {
			values(input);
			return { onConflictDoNothing: conflict };
		},
	})),
} as unknown as QueryClient;
const original = process.env.NEXT_PUBLIC_BASE_URL;
afterEach(() => {
	if (original === undefined) delete process.env.NEXT_PUBLIC_BASE_URL;
	else process.env.NEXT_PUBLIC_BASE_URL = original;
	jest.clearAllMocks();
});
it("deduplicates replayed outcomes without conflating invoices, creators, or deployments", async () => {
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	const event = { outcome: "payment_verified" as const, creatorId: "creator", key: "invoice-1", metadata: { amountMinor: 200, currency: "eur" } };
	await recordProductOutcome(event, client);
	await recordProductOutcome(event, client);
	await recordProductOutcome({ ...event, key: "invoice-2" }, client);
	await recordProductOutcome({ ...event, creatorId: "other" }, client);
	process.env.NEXT_PUBLIC_BASE_URL = "https://beta.clipify.us";
	await recordProductOutcome(event, client);
	const rows = values.mock.calls.map(([row]) => row);
	expect(rows[0].id).toBe(rows[1].id);
	expect(new Set(rows.map((row) => row.id)).size).toBe(4);
	expect(rows[0]).toMatchObject({ action: "product:payment_verified", outcome: "success", targetId: "creator", metadata: { deployment: "https://clipify.us", amountMinor: 200 } });
	expect(rows[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
	expect(conflict).toHaveBeenCalledTimes(5);
});
it("propagates persistence failure so its owner can retry", async () => {
	conflict.mockRejectedValueOnce(new Error("database unavailable"));
	await expect(recordProductOutcome({ outcome: "creator_created", creatorId: "creator", key: "signup" }, client)).rejects.toThrow("database unavailable");
});
