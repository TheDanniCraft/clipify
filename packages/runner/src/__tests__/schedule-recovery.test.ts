import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { scheduleAuthorizationFixture } from "../../test/support/schedule-fixture";
import { ExecutionJournal } from "../execution-journal";
import { FreeExecutionController } from "../execution-runtime";
import { RunnerScheduleCache } from "../schedule-cache";

test("TDD-US4-OPT094 U134: empty standby cannot construct an engine before its original signed start", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-empty-before-window-"));
	const fixture = scheduleAuthorizationFixture();
	const request = { requestId: randomUUID(), sentAt: 1000 };
	const job = fixture.response(request.requestId).scheduleCache.entries[0].job;
	const journal = new ExecutionJournal(directory);
	const emptyStandby = { clips: [], start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const createEngine = jest.fn(() => emptyStandby);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1000, createEngine });
	try {
		expect(controller.prepareScheduledJobs([job], request)).toBe(true);
		expect(await controller.apply(job, request)).toBe(false);
		await controller.tick();
		expect(createEngine).not.toHaveBeenCalled();
		expect(emptyStandby.start).not.toHaveBeenCalled();
		expect(journal.get(job.admissionId)).toBeUndefined();
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each([21000, 21001])("TDD-US3-OPT043 / TDD-US3-CON011: a clock jump to elapsed %i cannot start an ended window under otherwise valid cached authority", async (boundary) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-ended-window-"));
	const fixture = scheduleAuthorizationFixture();
	const request = { requestId: randomUUID(), sentAt: 1000 };
	const job = fixture.response(request.requestId).scheduleCache.entries[0].job;
	const journal = new ExecutionJournal(directory);
	const createEngine = jest.fn(() => ({ start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) }));
	let now = 1000;
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine });
	try {
		expect(controller.prepareScheduledJobs([job], request)).toBe(true);
		now = boundary;
		expect(await controller.apply(job, request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
		expect(journal.get(job.admissionId)).toBeUndefined();
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["before", "at"] as const)("TDD-US3-CON011: new start %s the signed cache horizon has the required synchronization boundary", async (boundary) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-horizon-"));
	const fixture = scheduleAuthorizationFixture();
	const request = { requestId: randomUUID(), sentAt: 1000 };
	const response = fixture.response(request.requestId);
	const job = response.scheduleCache.entries[0].job;
	const claims = JSON.parse(Buffer.from(job.lease.payload, "base64url").toString("utf8"));
	claims.scheduledEnd = claims.issuedAt + 14 * 86400000;
	job.scheduledEnd = claims.scheduledEnd;
	job.lease = fixture.signed(claims);
	const manifest = JSON.parse(Buffer.from(response.scheduleCache.bundle.payload, "base64url").toString("utf8"));
	manifest.entries[0].authorizationHash = createHash("sha256").update(job.lease.payload).digest("hex");
	const values = new Map<string, string>();
	let elapsed = 1000;
	const cache = new RunnerScheduleCache({
		directory: join(directory, "cache"),
		ownerId: fixture.ownerId,
		runnerId: fixture.runnerId,
		keys: fixture.keys,
		clock: () => elapsed,
		uptime: () => elapsed + 50000,
		bootId: () => "horizon-fixture-boot",
		keyring: {
			set: async (id, value) => {
				values.set(id, value);
			},
			get: async (id) => values.get(id) ?? null,
		},
	});
	const journal = new ExecutionJournal(join(directory, "journal"));
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const createEngine = jest.fn(() => engine);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => elapsed, createEngine });
	try {
		expect(await cache.accept({ bundle: fixture.signed(manifest), entries: [{ job }] }, request)).toBe(true);
		elapsed = request.sentAt + 604800000 - (boundary === "before" ? 1 : 0);
		const restored = await cache.restore();
		if (boundary === "before") {
			expect(restored).not.toBeNull();
			expect(controller.prepareScheduledJobs(restored!.jobs, restored!.request)).toBe(true);
			expect(await controller.apply(restored!.jobs[0], restored!.request)).toBe(true);
			expect(createEngine).toHaveBeenCalledTimes(1);
			expect(engine.start).toHaveBeenCalledTimes(1);
			expect(journal.get(job.admissionId)).toMatchObject({ state: "active", occurrence: { end: claims.scheduledEnd } });
			elapsed = request.sentAt + 604800000;
			await controller.tick();
			expect(engine.requestDrain).not.toHaveBeenCalled();
		} else {
			expect(restored).toBeNull();
			expect(cache.error).toBe("sync_required");
			expect(controller.prepareScheduledJobs([job], request)).toBe(false);
			expect(await controller.apply(job, request)).toBe(false);
			expect(createEngine).not.toHaveBeenCalled();
			expect(journal.get(job.admissionId)).toBeUndefined();
		}
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON011: clock rollback cannot resurrect a durably completed occurrence after restart", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-completed-rollback-"));
	const fixture = scheduleAuthorizationFixture();
	const request = { requestId: randomUUID(), sentAt: 1000 };
	const job = fixture.response(request.requestId).scheduleCache.entries[0].job;
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	let now = 11000;
	const controller = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => now, createEngine: () => engine });
	let restarted: FreeExecutionController | undefined, wallClock: jest.SpyInstance | undefined;
	try {
		expect(await controller.apply(job, request)).toBe(true);
		now = 21000;
		await controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(new ExecutionJournal(directory).get(job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { end: job.scheduledEnd } });
		now = 15000;
		wallClock = jest.spyOn(Date, "now").mockReturnValue(0);
		const journal = new ExecutionJournal(directory);
		const createEngine = jest.fn(() => engine);
		restarted = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine });
		expect(restarted.prepareScheduledJobs([job], request)).toBe(true);
		expect(Date.now()).toBe(0);
		expect(await restarted.apply(job, request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
		expect(journal.get(job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { end: job.scheduledEnd } });
	} finally {
		wallClock?.mockRestore();
		await restarted?.stopAll();
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON011: a pending terminal receipt survives restart and duplicate acknowledgments retire only its matching generation", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-terminal-restart-"));
	const fixture = scheduleAuthorizationFixture();
	const request = { requestId: randomUUID(), sentAt: 1000 };
	const job = fixture.response(request.requestId).scheduleCache.entries[0].job;
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const journal = new ExecutionJournal(directory);
	let now = 11000;
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine: () => engine });
	let restarted: FreeExecutionController | undefined;
	try {
		expect(await controller.apply(job, request)).toBe(true);
		now = 21000;
		await controller.tick();
		const terminal = journal.get(job.admissionId)!;
		expect(terminal).toMatchObject({ state: "stopped", allOutputsClosed: true });
		const other = { ...terminal, admissionId: randomUUID(), executionGeneration: randomUUID(), leaseId: randomUUID(), occurrence: { ...terminal.occurrence!, occurrenceId: '["other-event","original"]' } };
		journal.save(other);
		const restored = new ExecutionJournal(directory);
		const createEngine = jest.fn(() => engine);
		restarted = new FreeExecutionController({ ...fixture, journal: restored, clock: () => now, createEngine });
		expect(restarted.reports().filter((receipt) => receipt.state === "stopped")).toHaveLength(2);
		restarted.confirm([{ admissionId: job.admissionId, executionGeneration: randomUUID(), state: "stopped" }]);
		expect(new ExecutionJournal(directory).pendingTerminals()).toHaveLength(2);
		const acknowledgement = { admissionId: job.admissionId, executionGeneration: job.executionGeneration, state: "stopped" };
		restarted.confirm([acknowledgement]);
		restarted.confirm([acknowledgement]);
		expect(restarted.reports()).toEqual([expect.objectContaining({ admissionId: other.admissionId, executionGeneration: other.executionGeneration, state: "stopped", allOutputsClosed: true })]);
		const final = new ExecutionJournal(directory);
		expect(final.get(job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, acknowledged: true, occurrence: { end: job.scheduledEnd } });
		expect(final.get(other.admissionId)?.acknowledged).not.toBe(true);
		expect(final.pendingTerminals()).toHaveLength(1);
		expect(createEngine).not.toHaveBeenCalled();
	} finally {
		await restarted?.stopAll();
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});
