/** @jest-environment node */
import { trackCommittedCreatorOutcome } from "@/server/umami";
jest.mock("@/server/umami", () => ({ trackCommittedCreatorOutcome: jest.fn() }));
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
const original = process.env;
beforeEach(() => {
	process.env = { ...original };
	delete process.env.COOLIFY_URL;
	delete process.env.COOLIFY_RESOURCE_UUID;
	delete process.env.COOLIFY_CONTAINER_NAME;
});
afterEach(() => {
	process.env = original;
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

it("uses the established runtime deployment URL even when the public build URL names production", async () => {
	process.env.NEXT_PUBLIC_BASE_URL = "https://clipify.us";
	process.env.COOLIFY_RESOURCE_UUID = "fixture-preview";
	process.env.COOLIFY_URL = "http://beta-533.clipify.cloud.thedannicraft.de,http://secondary.invalid";
	await recordProductOutcome({ outcome: "creator_created", creatorId: "creator", key: "signup" }, client);
	expect(values.mock.calls[0][0].metadata.deployment).toBe("https://beta-533.clipify.cloud.thedannicraft.de");
});

it("separates first paid activation from revenue and deduplicates webhook retries", async () => {
	conflict.mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({ rowCount: 0 });
	const input = { outcome: "payment_verified" as const, creatorId: "creator", key: "first-invoice", metadata: { amountMinor: 2000, currency: "eur", billingReason: "subscription_create", feature: "theme_studio" } };
	await recordProductOutcome(input, client);
	await recordProductOutcome(input, client);
	expect(trackCommittedCreatorOutcome).toHaveBeenCalledTimes(2);
	expect(trackCommittedCreatorOutcome).toHaveBeenCalledWith("creator", expect.any(String), "payment_verified", expect.objectContaining({ revenue: 20, currency: "EUR" }));
	expect(trackCommittedCreatorOutcome).toHaveBeenCalledWith("creator", expect.any(String), "pro_activated", { plan: "pro", access_source: "billing", is_paying: true, feature: "theme_studio" });
});

it("records renewal revenue without counting another new paid activation", async () => {
	conflict.mockResolvedValueOnce({ rowCount: 1 });
	await recordProductOutcome({ outcome: "payment_verified", creatorId: "creator", key: "renewal", metadata: { amountMinor: 200, currency: "eur", billingReason: "subscription_cycle" } }, client);
	expect(trackCommittedCreatorOutcome).toHaveBeenCalledTimes(1);
	expect(trackCommittedCreatorOutcome).toHaveBeenCalledWith("creator", expect.any(String), "payment_verified", expect.objectContaining({ revenue: 2 }));
});
