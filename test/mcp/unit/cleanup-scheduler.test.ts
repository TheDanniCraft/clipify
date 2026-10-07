/** @jest-environment node */
jest.mock("server-only", () => ({}));
jest.mock("@/server/mcp/cleanup", () => ({ pruneMcpOperationalRecords: jest.fn(), pruneRevokedMcpCredentials: jest.fn(), pruneMcpActivity: jest.fn() }));
jest.mock("@/server/mcp/schema-readiness", () => ({ isMcpSchemaReady: jest.fn().mockResolvedValue(true) }));
import { isMcpSchemaReady } from "@/server/mcp/schema-readiness";
jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: jest.fn() }));
import { pruneMcpOperationalRecords, pruneRevokedMcpCredentials, pruneMcpActivity } from "@/server/mcp/cleanup";
import { captureUnexpectedError } from "@lib/sentryServer";
let scheduler: any;
try {
	scheduler = require("@/server/mcp/cleanup-scheduler");
} catch {}
const savedEnvironment = { ...process.env };
const state = globalThis as any;
describe("TDD-CLEANUP-002 operational cleanup job lifecycle", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		(isMcpSchemaReady as jest.Mock).mockReset().mockResolvedValue(true);
		process.env = { ...savedEnvironment, NODE_ENV: "production", MCP_ENABLED: "true" };
		delete process.env.NEXT_PHASE;
		delete process.env.DISABLE_BACKGROUND_JOBS;
		delete state.__mcpCleanupSchedulerStarted;
		delete state.__mcpCleanupSchedulerRunning;
		delete state.__mcpCleanupSchedulerTimer;
		(pruneRevokedMcpCredentials as jest.Mock).mockReset().mockResolvedValue({ accessTokens: 0, refreshTokens: 0, consents: 0 });
		(pruneMcpActivity as jest.Mock).mockReset().mockResolvedValue(0);
		(pruneMcpOperationalRecords as jest.Mock).mockResolvedValue({ clients: 0, retries: 0, counters: 0 });
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		process.env = { ...savedEnvironment };
	});
	test.each([{ NODE_ENV: "test" }, { NEXT_PHASE: "phase-production-build" }, { DISABLE_BACKGROUND_JOBS: "true" }])("does not access the database when disabled by %j", async (patch) => {
		expect(scheduler?.startMcpCleanupScheduler).toEqual(expect.any(Function));
		Object.assign(process.env, patch);
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(60000);
		expect(pruneMcpOperationalRecords).not.toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
	});
	test("runs bounded cleanup immediately and periodically, once per process", async () => {
		expect(scheduler?.startMcpCleanupScheduler).toEqual(expect.any(Function));
		scheduler.startMcpCleanupScheduler();
		scheduler.startMcpCleanupScheduler();
		await Promise.resolve();
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(1);
		expect(pruneMcpOperationalRecords).toHaveBeenCalledWith({ batchSize: 500 });
		await jest.advanceTimersByTimeAsync(30000);
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(2);
		expect(jest.getTimerCount()).toBe(1);
	});
	test("does not overlap a running sweep and resumes after it finishes", async () => {
		expect(scheduler?.startMcpCleanupScheduler).toEqual(expect.any(Function));
		let resolve!: () => void;
		(pruneMcpOperationalRecords as jest.Mock).mockImplementationOnce(
			() =>
				new Promise<void>((done) => {
					resolve = done;
				}),
		);
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(90000);
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(1);
		resolve();
		await Promise.resolve();
		await jest.advanceTimersByTimeAsync(30000);
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(2);
	});
	test("reports a failed sweep and retries on the next interval", async () => {
		expect(scheduler?.startMcpCleanupScheduler).toEqual(expect.any(Function));
		const failure = new Error("isolated cleanup failure");
		(pruneMcpOperationalRecords as jest.Mock).mockRejectedValueOnce(failure);
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(30000);
		expect(captureUnexpectedError).toHaveBeenCalledWith(failure, "mcp-cleanup-scheduler", "prune-operational-records");
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(2);
	});
	test("starts and periodically retries revoked credential cleanup", async () => {
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(pruneRevokedMcpCredentials).toHaveBeenCalledWith({ batchSize: 500 });
		await jest.advanceTimersByTimeAsync(30000);
		expect(pruneRevokedMcpCredentials).toHaveBeenCalledTimes(2);
	});
	test("operational cleanup failure does not starve revoked credential retries", async () => {
		(pruneMcpOperationalRecords as jest.Mock).mockRejectedValueOnce(new Error("fixture failure"));
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(pruneRevokedMcpCredentials).toHaveBeenCalledTimes(1);
		await jest.advanceTimersByTimeAsync(30000);
		expect(pruneRevokedMcpCredentials).toHaveBeenCalledTimes(2);
	});
	test("revoked cleanup failure is reported and retried on the next interval", async () => {
		const error = new Error("fixture credential cleanup failure");
		(pruneRevokedMcpCredentials as jest.Mock).mockRejectedValueOnce(error);
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(captureUnexpectedError).toHaveBeenCalledWith(error, "mcp-cleanup-scheduler", "prune-revoked-credentials");
		await jest.advanceTimersByTimeAsync(30000);
		expect(pruneRevokedMcpCredentials).toHaveBeenCalledTimes(2);
	});
	test("starts bounded activity retention and retries on every interval", async () => {
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(pruneMcpActivity).toHaveBeenCalledWith({ batchSize: 500 });
		await jest.advanceTimersByTimeAsync(30000);
		expect(pruneMcpActivity).toHaveBeenCalledTimes(2);
	});
	test("independent failures do not starve activity retention", async () => {
		(pruneMcpOperationalRecords as jest.Mock).mockRejectedValueOnce(new Error("operational unavailable"));
		(pruneRevokedMcpCredentials as jest.Mock).mockRejectedValueOnce(new Error("credential cleanup unavailable"));
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(pruneMcpActivity).toHaveBeenCalledTimes(1);
	});
	test("activity failure is reported and does not prevent later cleanup passes", async () => {
		const error = new Error("activity unavailable");
		(pruneMcpActivity as jest.Mock).mockRejectedValueOnce(error);
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(30000);
		expect(captureUnexpectedError).toHaveBeenCalledWith(error, "mcp-cleanup-scheduler", "prune-activity");
		expect(pruneMcpActivity).toHaveBeenCalledTimes(2);
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(2);
	});
	test("continues cleanup with public MCP disabled", async () => {
		process.env.MCP_ENABLED = "false";
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(1);
	});
	test("does not prune business tables before source schema is ready", async () => {
		(isMcpSchemaReady as jest.Mock).mockResolvedValue(false);
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(pruneMcpOperationalRecords).not.toHaveBeenCalled();
	});

	test("retries readiness after schema becomes available", async () => {
		(isMcpSchemaReady as jest.Mock).mockResolvedValueOnce(false).mockResolvedValue(true);
		scheduler.startMcpCleanupScheduler();
		await jest.advanceTimersByTimeAsync(0);
		expect(pruneMcpOperationalRecords).not.toHaveBeenCalled();
		await jest.advanceTimersByTimeAsync(30000);
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(1);
	});
});
