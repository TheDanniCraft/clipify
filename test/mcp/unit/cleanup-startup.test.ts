/** @jest-environment node */
jest.mock("@sentry/nextjs", () => ({ captureRequestError: jest.fn() }));
jest.mock("../../../sentry.server.config", () => ({}));
jest.mock("../../../sentry.edge.config", () => ({}));
jest.mock("@lib/entitlementsScheduler", () => ({ startEntitlementsScheduler: jest.fn() }));
jest.mock("@lib/clipCacheScheduler", () => ({ startClipCacheScheduler: jest.fn() }));
jest.mock("@lib/communityScheduler", () => ({ startCommunitySnapshotScheduler: jest.fn() }));
jest.mock("@lib/runnerScheduler", () => ({ startRunnerScheduler: jest.fn() }));
jest.mock("@lib/consent/retention", () => ({ startConsentRetentionScheduler: jest.fn() }));
jest.mock("@lib/operationalHealth", () => ({ startOperationalHealthPublisher: jest.fn() }));
jest.mock("@lib/accountLifecycleScheduler", () => ({ startAccountLifecycleScheduler: jest.fn() }));
jest.mock("@/server/mcp/cleanup", () => ({ pruneMcpOperationalRecords: jest.fn().mockResolvedValue({ clients: 0, retries: 0, counters: 0 }), pruneRevokedMcpCredentials: jest.fn().mockResolvedValue({ accessTokens: 0, refreshTokens: 0, consents: 0 }), pruneMcpActivity: jest.fn().mockResolvedValue(0) }));
jest.mock("@/server/mcp/schema-readiness", () => ({ isMcpSchemaReady: jest.fn().mockResolvedValue(true) }));
import { isMcpSchemaReady } from "@/server/mcp/schema-readiness";
jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: jest.fn() }));
import { pruneMcpOperationalRecords } from "@/server/mcp/cleanup";
import { register } from "@/instrumentation";
const savedEnvironment = { ...process.env };
describe("TDD-CLEANUP-002 actual application startup", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		(isMcpSchemaReady as jest.Mock).mockReset().mockResolvedValue(true);
		process.env = { ...savedEnvironment, NODE_ENV: "production", NEXT_RUNTIME: "nodejs", MCP_ENABLED: "true", DISABLE_BACKGROUND_JOBS: "false" };
		delete process.env.NEXT_PHASE;
		const state = globalThis as any;
		delete state.__mcpCleanupSchedulerStarted;
		delete state.__mcpCleanupSchedulerRunning;
		delete state.__mcpCleanupSchedulerTimer;
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		process.env = { ...savedEnvironment };
	});
	test("starts operational cleanup in an enabled Node application", async () => {
		await register();
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(1);
	});
	test.each([{ DISABLE_BACKGROUND_JOBS: "true" }, { NEXT_RUNTIME: "edge" }])("does not start cleanup for %j", async (patch) => {
		Object.assign(process.env, patch);
		await register();
		expect(pruneMcpOperationalRecords).not.toHaveBeenCalled();
	});
	test("continues cleanup with public MCP disabled", async () => {
		process.env.MCP_ENABLED = "false";
		await register();
		expect(pruneMcpOperationalRecords).toHaveBeenCalledTimes(1);
	});
	test("does not prune business tables before source schema is ready", async () => {
		(isMcpSchemaReady as jest.Mock).mockResolvedValue(false);
		await register();
		expect(pruneMcpOperationalRecords).not.toHaveBeenCalled();
	});
});
