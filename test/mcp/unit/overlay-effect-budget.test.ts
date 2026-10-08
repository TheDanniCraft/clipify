/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({ db: {} }));
import { runOverlayRewardEffects } from "@/server/resources/overlay-effects";
describe("TDD-OVERLAY-EFFECT-008 bounded job input", () => {
	test.each([0, -1, 1.5, 101, NaN, Infinity])("invalid batch %s never enters a transaction or sends", async (batchSize) => {
		const transaction = jest.fn();
		const sendReward = jest.fn();
		await expect(runOverlayRewardEffects({ client: { transaction } as any, batchSize, sendReward })).rejects.toThrow("INVALID_INPUT");
		expect(transaction).not.toHaveBeenCalled();
		expect(sendReward).not.toHaveBeenCalled();
	});
	test("invalid clock performs no work", async () => {
		const transaction = jest.fn();
		const sendReward = jest.fn();
		await expect(runOverlayRewardEffects({ client: { transaction } as any, now: new Date(NaN), sendReward })).rejects.toThrow("INVALID_INPUT");
		expect(transaction).not.toHaveBeenCalled();
		expect(sendReward).not.toHaveBeenCalled();
	});
	test.each([1, 100])("empty batch at valid bound %s sends nothing", async (batchSize) => {
		const transaction = jest.fn().mockResolvedValue([]);
		const sendReward = jest.fn();
		await expect(runOverlayRewardEffects({ client: { transaction } as any, batchSize, sendReward })).resolves.toBe(0);
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(sendReward).not.toHaveBeenCalled();
	});
});
