/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/db/client", () => ({ db: { execute: jest.fn() } }));
jest.mock("@/server/resources/overlay-effects", () => ({ runOverlayRewardEffects: jest.fn(), subscribeOverlayReward: jest.fn() }));
jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: jest.fn() }));
import { db } from "@/db/client";
import { runOverlayRewardEffects, subscribeOverlayReward } from "@/server/resources/overlay-effects";
import { captureUnexpectedError } from "@lib/sentryServer";
let scheduler: any;
try {
	scheduler = require("@/server/resources/overlay-effect-scheduler");
} catch {}
const savedEnvironment = { ...process.env };
const state = globalThis as any;
describe("TDD-OVERLAY-EFFECT-007 private reward scheduler", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		(db.execute as jest.Mock).mockReset().mockResolvedValue({ rows: [{ present: true }] });
		(runOverlayRewardEffects as jest.Mock).mockReset().mockResolvedValue(0);
		process.env = { ...savedEnvironment, NODE_ENV: "production" };
		delete process.env.DISABLE_BACKGROUND_JOBS;
		delete process.env.NEXT_PHASE;
		delete state.__overlayEffectSchedulerStarted;
		delete state.__overlayEffectSchedulerRunning;
		delete state.__overlayEffectSchedulerTimer;
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		process.env = { ...savedEnvironment };
	});
	test.each([{ NODE_ENV: "test" }, { NEXT_PHASE: "phase-production-build" }, { DISABLE_BACKGROUND_JOBS: "true" }])("disabled %j performs no schema or provider work", async (patch) => {
		expect(scheduler?.startOverlayEffectScheduler).toEqual(expect.any(Function));
		Object.assign(process.env, patch);
		scheduler.startOverlayEffectScheduler();
		await jest.advanceTimersByTimeAsync(60000);
		expect(db.execute).not.toHaveBeenCalled();
		expect(runOverlayRewardEffects).not.toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
	});
	test("runs independently of public MCP and only starts once", async () => {
		expect(scheduler?.startOverlayEffectScheduler).toEqual(expect.any(Function));
		scheduler.startOverlayEffectScheduler();
		scheduler.startOverlayEffectScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(runOverlayRewardEffects).toHaveBeenCalledTimes(1);
		expect(runOverlayRewardEffects).toHaveBeenCalledWith({ batchSize: 20, sendReward: subscribeOverlayReward });
		await jest.advanceTimersByTimeAsync(30000);
		expect(runOverlayRewardEffects).toHaveBeenCalledTimes(2);
		expect(jest.getTimerCount()).toBe(1);
	});
	test("missing source schema is read-only and retried later", async () => {
		expect(scheduler?.startOverlayEffectScheduler).toEqual(expect.any(Function));
		(db.execute as jest.Mock).mockResolvedValueOnce({ rows: [{ present: false }] });
		scheduler.startOverlayEffectScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(runOverlayRewardEffects).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(30000);
		expect(runOverlayRewardEffects).toHaveBeenCalledTimes(1);
	});
	test("never overlaps a sweep and resumes after it completes", async () => {
		expect(scheduler?.startOverlayEffectScheduler).toEqual(expect.any(Function));
		let release!: () => void;
		(runOverlayRewardEffects as jest.Mock).mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);
		scheduler.startOverlayEffectScheduler();
		await jest.advanceTimersByTimeAsync(90000);
		expect(runOverlayRewardEffects).toHaveBeenCalledTimes(1);
		release();
		await jest.advanceTimersByTimeAsync(30000);
		expect(runOverlayRewardEffects).toHaveBeenCalledTimes(2);
	});
	test.each(["schema", "worker"])("%s error is reported and does not disable later retry", async (where) => {
		expect(scheduler?.startOverlayEffectScheduler).toEqual(expect.any(Function));
		const error = new Error("controlled scheduler failure");
		((where === "schema" ? db.execute : runOverlayRewardEffects) as jest.Mock).mockRejectedValueOnce(error);
		scheduler.startOverlayEffectScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(captureUnexpectedError).toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(30000);
		expect(runOverlayRewardEffects).toHaveBeenCalledTimes(where === "schema" ? 1 : 2);
	});
});
