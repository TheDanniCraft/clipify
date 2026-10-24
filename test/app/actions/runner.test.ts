/** @jest-environment node */

import { StreamMode, StreamState } from "@/app/lib/types";

const mockValidateAuth = jest.fn();
const mockHasActiveEntitlement = jest.fn();
const mockRevalidatePath = jest.fn();
const mockOwnerFindFirst = jest.fn();
const mockStreamSessionFindFirst = jest.fn();
const mockCaptureUnexpectedError = jest.fn();
const mockListAuthorizedCreatorOperations = jest.fn();
const mockRedirect = jest.fn((url: string) => {
	const error = new Error(`NEXT_REDIRECT:${url}`);
	(error as Error & { digest?: string }).digest = "NEXT_REDIRECT";
	throw error;
});
const mockControlStreamSession = jest.fn();
const mockRunnerFindFirst = jest.fn();
const mockRunnerFindMany = jest.fn();
const mockOverlayFindFirst = jest.fn();
const mockUpdateReturning = jest.fn();
const mockAuthorizeCreatorOperation = jest.fn(async ({ creatorId }: { creatorId: string }) => {
	const actor = await mockValidateAuth();
	if (!actor) return { allowed: false, code: "AUTHENTICATION_REQUIRED" };
	const allowed = actor.id === creatorId;
	return allowed ? { allowed: true, accessPath: actor.id === creatorId ? "owner" : "direct", creator: { id: creatorId }, authUserId: actor.id, sessionId: "test", creatorOrganizationId: `org:${creatorId}` } : { allowed: false, code: "ACCESS_PATH_REQUIRED" };
});

const mockUpdateBuilder = {
	set: jest.fn(),
	where: jest.fn(),
	returning: jest.fn(),
};

mockUpdateBuilder.set.mockReturnValue(mockUpdateBuilder);
mockUpdateBuilder.where.mockReturnValue(mockUpdateBuilder);
mockUpdateBuilder.returning.mockImplementation((...args: unknown[]) => mockUpdateReturning(...args));

const mockInsertReturning = jest.fn();
const mockInsertValues = jest.fn(() => ({ returning: (...args: unknown[]) => mockInsertReturning(...args) }));
const mockInsert = jest.fn(() => ({ values: mockInsertValues }));
const mockDb = {
	transaction: jest.fn(async (operation: (tx: unknown) => Promise<unknown>): Promise<unknown> => operation(mockDb)),
	query: {
		usersTable: { findFirst: (...args: unknown[]) => mockOwnerFindFirst(...args) },
		streamSessionsTable: { findFirst: (...args: unknown[]) => mockStreamSessionFindFirst(...args) },
		runnersTable: { findFirst: (...args: unknown[]) => mockRunnerFindFirst(...args), findMany: (...args: unknown[]) => mockRunnerFindMany(...args) },
		overlaysTable: { findFirst: (...args: unknown[]) => mockOverlayFindFirst(...args) },
	},
	update: jest.fn(() => mockUpdateBuilder),
	insert: mockInsert,
};

// The action unit owns projection/CAS behavior. Real authorization, encryption and
// transaction rollback remain exercised by the disposable PostgreSQL destination owner.
jest.mock("@/auth/session-principal", () => ({
	getVerifiedSessionPrincipal: async () => {
		const actor = await mockValidateAuth();
		return actor ? { kind: "session", authUserId: actor.id, sessionId: "test", organizationId: "test-org" } : null;
	},
}));
jest.mock("@/server/resources/mutation", () => ({ authorizeLockedMutation: jest.fn(async () => ({ assertAuthorityCurrent() {} })) }));
jest.mock("@/server/resources/runners", () => ({ controlStreamSession: (...args: unknown[]) => mockControlStreamSession(...args) }));
jest.mock("@/server/runner/destinations", () => ({ normalizeLegacySessionDestination: jest.fn(async () => undefined) }));

jest.mock("@/db/client", () => ({
	db: mockDb,
}));

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

jest.mock("@lib/entitlements", () => ({
	hasActiveEntitlement: (...args: unknown[]) => mockHasActiveEntitlement(...args),
	hasActiveRunnerAccess: (...args: unknown[]) => mockHasActiveEntitlement(...args),
}));

jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: (...args: unknown[]) => mockCaptureUnexpectedError(...args) }));

jest.mock("@lib/runnerArtifacts", () => ({
	getRunnerVersionInfo: jest.fn(),
}));

jest.mock("next/cache", () => ({
	revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));
jest.mock("@/auth/authorize-operation", () => ({ authorizeCreatorOperation: (input: { creatorId: string }) => mockAuthorizeCreatorOperation(input), listAuthorizedCreatorOperations: (...args: unknown[]) => mockListAuthorizedCreatorOperations(...args) }));
jest.mock("next/navigation", () => ({
	redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
	unstable_rethrow: (error: Error & { digest?: string }) => {
		if (error.digest === "NEXT_REDIRECT") throw error;
	},
}));

describe("actions/runner", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockValidateAuth.mockResolvedValue({ id: "owner-1" });
		mockOwnerFindFirst.mockResolvedValue({ id: "owner-1" });
		mockStreamSessionFindFirst.mockResolvedValue({ runnerId: "runner-1", overlayId: "overlay-1", controlMode: "manual", configurationRevision: 1, rtmpUrl: "rtmp://custom.example/live" });
		mockHasActiveEntitlement.mockResolvedValue(true);
		mockRunnerFindFirst.mockResolvedValue({ id: "runner-1", ownerId: "owner-1" });
		mockOverlayFindFirst.mockResolvedValue({ id: "overlay-1", ownerId: "owner-1" });
		mockListAuthorizedCreatorOperations.mockResolvedValue([]);
	});

	it("preserves the framework redirect when no owned creator can enroll a Runner", async () => {
		const { createOwnRunner } = await import("@/app/actions/runner");
		await expect(createOwnRunner("Bedroom PC")).rejects.toThrow("NEXT_REDIRECT:/auth?returnUrl=%2Frunner%2Fenroll");
		expect(mockRedirect).toHaveBeenCalledWith("/auth?returnUrl=%2Frunner%2Fenroll");
		expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
	});

	it("updates an existing stream session for the authorized owner", async () => {
		mockUpdateReturning.mockResolvedValue([{ id: "session-1" }]);
		const { upsertStreamSession } = await import("@/app/actions/runner");

		const result = await upsertStreamSession({
			id: "session-1",
			ownerId: "owner-1",
			runnerId: "runner-1",
			overlayId: "overlay-1",
			mode: StreamMode.AlwaysOn,
			streamKey: "",
			rtmpUrl: "rtmp://custom.example/live",
		});

		expect(result).toEqual({ success: true });
		expect(mockUpdateReturning).toHaveBeenCalledWith({ id: expect.anything() });
		expect(mockRevalidatePath).toHaveBeenCalledWith("/dashboard/runners");
	});

	it("does not update a stream session when the id is not owned by the authorized owner", async () => {
		mockStreamSessionFindFirst.mockResolvedValue(undefined);
		mockUpdateReturning.mockResolvedValue([]);
		const { upsertStreamSession } = await import("@/app/actions/runner");

		const result = await upsertStreamSession({
			id: "session-owned-by-someone-else",
			ownerId: "owner-1",
			runnerId: "runner-1",
			overlayId: "overlay-1",
			mode: StreamMode.AlwaysOn,
			streamKey: "",
			rtmpUrl: "rtmp://custom.example/live",
		});

		expect(result).toEqual({ success: false, error: "Stream session not found", code: "NOT_FOUND" });
		expect(mockRevalidatePath).not.toHaveBeenCalled();
	});

	it("projects runner reads without bearer tokens", async () => {
		mockRunnerFindMany.mockResolvedValue([]);
		const { getAllRunners, getRunner } = await import("@/app/actions/runner");

		await getAllRunners("owner-1");
		await getRunner("runner-1", "owner-1");

		for (const call of [mockRunnerFindMany.mock.calls[0][0], mockRunnerFindFirst.mock.calls.at(-1)?.[0]]) {
			expect(call.columns).toEqual(expect.objectContaining({ id: true, ownerId: true, name: true, status: true }));
			expect(call.columns).not.toHaveProperty("token");
		}
	});

	it("only selects the bearer token through the explicit token action", async () => {
		mockRunnerFindFirst.mockResolvedValue({ token: "cl_run_secret" });
		const { getRunnerToken } = await import("@/app/actions/runner");

		await expect(getRunnerToken("runner-1", "owner-1")).resolves.toEqual({ success: true, token: "cl_run_secret" });
		expect(mockRunnerFindFirst.mock.calls.at(-1)?.[0].columns).toEqual({ token: true });
	});

	it("TDD-US1-FR001 dashboard: an authorized Free owner registers two devices without a paid grant", async () => {
		mockHasActiveEntitlement.mockResolvedValue(false);
		mockInsertReturning.mockResolvedValueOnce([{ id: "free-device-one", ownerId: "owner-1", name: "First device" }]).mockResolvedValueOnce([{ id: "free-device-two", ownerId: "owner-1", name: "Second device" }]);
		const { createRunner } = await import("@/app/actions/runner");
		const first = await createRunner("owner-1", "First device");
		const second = await createRunner("owner-1", "Second device");
		expect(first).toMatchObject({ success: true, runner: { id: "free-device-one" } });
		expect(second).toMatchObject({ success: true, runner: { id: "free-device-two" } });
		expect(mockInsert).toHaveBeenCalledTimes(2);
		for (const [selection] of mockInsertReturning.mock.calls) expect(selection).not.toHaveProperty("token");
	});

	it("TDD-US1-FR001 authorization: Free access never permits registration for an unauthorized owner", async () => {
		mockInsertReturning.mockResolvedValue([{ id: "foreign-device", ownerId: "foreign-owner", name: "Denied" }]);
		const { createRunner } = await import("@/app/actions/runner");
		expect(await createRunner("foreign-owner", "Denied")).toEqual({ success: false, error: "Unauthorized" });
		expect(mockInsert).not.toHaveBeenCalled();
	});

	it("TDD-US1-FR005: omitted Manual fallback edits capture a revision even for an older caller", async () => {
		mockStreamSessionFindFirst.mockResolvedValue({ runnerId: "runner-1", overlayId: "overlay-1", controlMode: "manual", configurationRevision: 7 });
		mockUpdateReturning.mockResolvedValue([{ id: "session-1" }]);
		const { upsertStreamSession } = await import("@/app/actions/runner");
		const result = await upsertStreamSession({ id: "session-1", ownerId: "owner-1", runnerId: "runner-1", overlayId: "overlay-1", mode: StreamMode.Failsafe, streamKey: "", rtmpUrl: "rtmp://custom.example/live" });
		expect(result).toEqual({ success: true });
		const { PgDialect } = await import("drizzle-orm/pg-core");
		const query = new PgDialect().sqlToQuery(mockUpdateBuilder.where.mock.calls.at(-1)![0]);
		expect(query.sql).toContain('"stream_sessions"."configuration_revision"');
		expect(query.params).toContain(7);
		expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
	});

	it("TDD-US1-FR005: a concurrent change after an omitted-control read returns a conflict without reporting it", async () => {
		mockStreamSessionFindFirst.mockResolvedValue({ runnerId: "runner-1", overlayId: "overlay-1", controlMode: "manual", configurationRevision: 7 });
		mockUpdateReturning.mockResolvedValue([]);
		const { upsertStreamSession } = await import("@/app/actions/runner");
		const result = await upsertStreamSession({ id: "session-1", ownerId: "owner-1", runnerId: "runner-1", overlayId: "overlay-1", mode: StreamMode.Failsafe, streamKey: "", rtmpUrl: "rtmp://custom.example/live" });
		expect(result).toMatchObject({ success: false, code: "REVISION_CONFLICT" });
		expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
	});

	it("TDD-US1-FR005: a missing session in effective-mode validation returns a safe not-found result", async () => {
		mockStreamSessionFindFirst.mockResolvedValue(undefined);
		const { upsertStreamSession } = await import("@/app/actions/runner");
		const result = await upsertStreamSession({ id: "session-1", ownerId: "owner-1", runnerId: "runner-1", overlayId: "overlay-1", mode: StreamMode.Failsafe, streamKey: "", rtmpUrl: "rtmp://custom.example/live" });
		expect(result).toMatchObject({ success: false, code: "NOT_FOUND" });
		expect(mockDb.update).not.toHaveBeenCalled();
		expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
	});
	it("TDD-US2-FR006: expected broadcast limits return a normal result without console or Sentry reporting", async () => {
		mockStreamSessionFindFirst.mockResolvedValue({ id: "session-1", ownerId: "owner-1", configurationRevision: 1, rtmpUrl: "rtmp://custom.example/live" });
		mockControlStreamSession.mockRejectedValueOnce(new Error("RUNNER_CONCURRENCY_LIMIT"));
		const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const { setStreamDesiredState } = await import("@/app/actions/runner");
			const result = await setStreamDesiredState("session-1", StreamState.Running, 1);
			expect(result).toMatchObject({ success: false, code: "RUNNER_CONCURRENCY_LIMIT" });
			expect(log).not.toHaveBeenCalled();
			expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
		} finally {
			log.mockRestore();
		}
	});
	it("TDD-US2-CON005: unexpected control failures remain reportable without forwarding private database details", async () => {
		mockStreamSessionFindFirst.mockResolvedValue({ id: "session-1", ownerId: "owner-1", configurationRevision: 1, rtmpUrl: "rtmp://custom.example/live" });
		mockControlStreamSession.mockRejectedValueOnce(new Error("database failed with private-database-key"));
		const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
		try {
			const { setStreamDesiredState } = await import("@/app/actions/runner");
			expect(await setStreamDesiredState("session-1", StreamState.Running, 1)).toMatchObject({ success: false, code: "SERVICE_UNAVAILABLE" });
			expect(mockCaptureUnexpectedError).toHaveBeenCalledTimes(1);
			expect(mockCaptureUnexpectedError.mock.calls[0][0].message).not.toContain("private-database-key");
			expect(log).not.toHaveBeenCalled();
		} finally {
			log.mockRestore();
		}
	});
	it("returns a cached preview only after owner read authorization", async () => {
		const id = "cb892e15-7654-43a2-8eee-bbfda1db885b";
		const { runnerPreviewCache } = await import("@/app/lib/runnerPreviewCache");
		const { getRunnerLivePreview } = await import("@/app/actions/runner");
		mockRunnerFindFirst.mockResolvedValue({ id, ownerId: "owner-1" });
		runnerPreviewCache.set(id, "data:image/jpeg;base64,cHJldmlldw==");
		await expect(getRunnerLivePreview(id, "owner-1")).resolves.toEqual({ success: true, image: "data:image/jpeg;base64,cHJldmlldw==" });
	});
	it("returns preview denials locally without querying a runner or reporting an incident", async () => {
		const { getRunnerLivePreview } = await import("@/app/actions/runner");
		mockValidateAuth.mockResolvedValue({ id: "another-owner" });
		await expect(getRunnerLivePreview("cb892e15-7654-43a2-8eee-bbfda1db885b", "owner-1")).resolves.toMatchObject({ success: false, code: "ACCESS_DENIED" });
		expect(mockRunnerFindFirst).not.toHaveBeenCalled();
		expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
	});
	it("does not expose a cached frame when the runner is absent from the authorized owner", async () => {
		const id = "cb892e15-7654-43a2-8eee-bbfda1db885b";
		const { getRunnerLivePreview } = await import("@/app/actions/runner");
		mockRunnerFindFirst.mockResolvedValue(undefined);
		await expect(getRunnerLivePreview(id, "owner-1")).resolves.toMatchObject({ success: false, code: "RESOURCE_UNAVAILABLE" });
		expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
	});
	it("returns invalid preview IDs as expected input failures", async () => {
		const { getRunnerLivePreview } = await import("@/app/actions/runner");
		await expect(getRunnerLivePreview("bad-id", "owner-1")).resolves.toMatchObject({ success: false, code: "INVALID_INPUT" });
		expect(mockCaptureUnexpectedError).not.toHaveBeenCalled();
	});
});
