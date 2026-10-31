/** @jest-environment node */
const access = jest.fn();
const record = jest.fn();
const transaction = {};
jest.mock("@/server/overlays", () => ({ getOverlayRuntimeAccessInternal: (...args: unknown[]) => access(...args) }));
jest.mock("@/server/product-outcomes", () => ({ recordProductOutcome: (...args: unknown[]) => record(...args) }));
jest.mock("@/db/client", () => ({ db: { transaction: async (fn: (tx: unknown) => Promise<void>) => fn(transaction) } }));
import { recordOverlayPlayback } from "@/app/actions/productPlayback";
beforeEach(() => {
	jest.clearAllMocks();
	record.mockResolvedValue(undefined);
});
it("rejects invalid, demo, and unauthorized reports before recording", async () => {
	process.env.DEMO_OVERLAY_ID = "demo";
	await expect(recordOverlayPlayback("demo", "secret")).resolves.toEqual({ recorded: false });
	await expect(recordOverlayPlayback("overlay", "")).resolves.toEqual({ recorded: false });
	await expect(recordOverlayPlayback("x".repeat(101), "secret")).resolves.toEqual({ recorded: false });
	await expect(recordOverlayPlayback("overlay", "x".repeat(201))).resolves.toEqual({ recorded: false });
	expect(access).not.toHaveBeenCalled();
	access.mockResolvedValue({ allowed: false });
	await expect(recordOverlayPlayback("overlay", "bad")).resolves.toEqual({ recorded: false });
	expect(record).not.toHaveBeenCalled();
});
it("records activation and one UTC playback day for the authorized owner in one transaction", async () => {
	access.mockResolvedValue({ allowed: true, overlay: { ownerId: "owner" } });
	await expect(recordOverlayPlayback("overlay", "secret")).resolves.toEqual({ recorded: true });
	expect(access).toHaveBeenCalledWith("overlay", "websocket", "secret");
	expect(record).toHaveBeenNthCalledWith(1, expect.objectContaining({ outcome: "first_playback", creatorId: "owner", key: "first" }), transaction);
	expect(record).toHaveBeenNthCalledWith(2, expect.objectContaining({ outcome: "playback_day", creatorId: "owner", key: new Date().toISOString().slice(0, 10) }), transaction);
});
it("allows retry after persistence fails instead of reporting a successful outcome", async () => {
	access.mockResolvedValue({ allowed: true, overlay: { ownerId: "owner" } });
	record.mockRejectedValueOnce(new Error("unavailable"));
	await expect(recordOverlayPlayback("overlay", "secret")).rejects.toThrow("unavailable");
});
