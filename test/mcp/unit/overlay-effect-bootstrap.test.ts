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
jest.mock("@/server/mcp/cleanup-scheduler", () => ({ startMcpCleanupScheduler: jest.fn() }));
jest.mock("@/server/resources/overlay-effect-scheduler", () => ({ startOverlayEffectScheduler: jest.fn() }));
import { register } from "@/instrumentation";
import { startOverlayEffectScheduler } from "@/server/resources/overlay-effect-scheduler";
import { startMcpCleanupScheduler } from "@/server/mcp/cleanup-scheduler";
const original = { ...process.env };
beforeEach(() => {
	jest.clearAllMocks();
	process.env = { ...original };
});
afterEach(() => {
	process.env = { ...original };
});
test("TDD-OVERLAY-EFFECT-009 Node bootstrap starts private effects even with public MCP disabled", async () => {
	process.env.NEXT_RUNTIME = "nodejs";
	process.env.MCP_ENABLED = "false";
	delete process.env.DISABLE_BACKGROUND_JOBS;
	await register();
	expect(startOverlayEffectScheduler).toHaveBeenCalledTimes(1);
	expect(startMcpCleanupScheduler).toHaveBeenCalledTimes(1);
});
test.each(["edge", "unspecified", "disabled"])("private effects are not started for %s bootstrap", async (mode) => {
	if (mode === "edge") process.env.NEXT_RUNTIME = "edge";
	if (mode === "unspecified") delete process.env.NEXT_RUNTIME;
	if (mode === "disabled") {
		process.env.NEXT_RUNTIME = "nodejs";
		process.env.DISABLE_BACKGROUND_JOBS = "true";
	}
	await register();
	expect(startOverlayEffectScheduler).not.toHaveBeenCalled();
	expect(startMcpCleanupScheduler).not.toHaveBeenCalled();
});
