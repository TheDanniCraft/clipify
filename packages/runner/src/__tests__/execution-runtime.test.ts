import type { FreeExecutionJob } from "../execution-runtime";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { ExecutionJournal, type ExecutionRecord } from "../execution-journal";

function runtimeFixture(options: { issuedAt?: number; policy?: "free_lease" | "pro_broadcast"; scheduledEnd?: number; cacheAuthorization?: true; scheduledStart?: number } = {}) {
	const initialIssuedAt = options.issuedAt ?? 1000000;
	const { privateKey, publicKey } = generateKeyPairSync("ed25519");
	const sourceId = randomUUID();
	const ownerId = "creator",
		runnerId = randomUUID(),
		sessionId = randomUUID(),
		admissionId = randomUUID(),
		generation = randomUUID(),
		leaseId = randomUUID(),
		request = { requestId: randomUUID(), sentAt: 1000 };
	const rtmpUrl = "rtmp://127.0.0.1/live",
		targetHash = createHash("sha256")
			.update(JSON.stringify([{ id: sessionId, rtmpUrl, credential: null }]))
			.digest("hex");
	const cached = options.cacheAuthorization
		? {
				cacheAuthorization: true as const,
				occurrenceId: '["event","original-anchor"]',
				scheduledStart: options.scheduledStart!,
				executionPayloadHash: createHash("sha256")
					.update(JSON.stringify({ sourceId, sourceCredential: createHash("sha256").update("fixture-source").digest("hex"), mode: "24/7", fps: 15, resolution: "720p", targetHash }))
					.digest("hex"),
			}
		: {};
	const claims = {
		...cached,
		issuer: "clipify.us",
		kind: options.cacheAuthorization ? "scheduled_execution" : "execution",
		policy: options.policy ?? "free_lease",
		...(options.scheduledEnd === undefined ? {} : { scheduledEnd: options.scheduledEnd }),
		sourceId,
		ownerId,
		runnerId,
		sessionId,
		admissionId,
		generation,
		leaseId,
		requestId: request.requestId,
		configurationRevision: 2,
		sourceRevision: 1,
		targetHash,
		issuedAt: initialIssuedAt,
		expiresAt: initialIssuedAt + (options.cacheAuthorization ? 604800000 : 300000),
	};
	const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
	const job = {
		...cached,
		id: sessionId,
		ownerId,
		runnerId,
		admissionId,
		executionGeneration: generation,
		configurationRevision: 2,
		sourceRevision: 1,
		targetHash,
		...(options.scheduledEnd === undefined ? {} : { scheduledEnd: options.scheduledEnd }),
		overlayId: sourceId,
		overlaySecret: "fixture-source",
		rtmpUrl,
		streamKey: null,
		mode: "24/7" as const,
		fps: 15,
		resolution: "720p",
		desiredState: "running" as const,
		lease: { keyId: "fixture", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") },
	};
	const renew = (nonce: string, issuedAt = 2000000, ordinary = false) => {
		const renewed = Buffer.from(JSON.stringify({ ...claims, ...(ordinary ? { kind: "execution", cacheAuthorization: undefined, occurrenceId: undefined, scheduledStart: undefined, executionPayloadHash: undefined } : {}), requestId: nonce, issuedAt, expiresAt: issuedAt + 300000 })).toString("base64url");
		return { ...job, ...(ordinary ? { cacheAuthorization: undefined, occurrenceId: undefined, scheduledStart: undefined, executionPayloadHash: undefined } : {}), lease: { keyId: "fixture", payload: renewed, signature: sign(null, Buffer.from(renewed), privateKey).toString("base64url") } };
	};
	const resignScheduledJob = (candidate: FreeExecutionJob, patch: Partial<FreeExecutionJob> = {}, claimPatch: Record<string, unknown> = {}): FreeExecutionJob => {
		const updated = { ...structuredClone(candidate), ...patch };
		const targets = updated.destinations ?? [{ id: updated.id, rtmpUrl: updated.rtmpUrl, streamKey: updated.streamKey }];
		updated.targetHash = createHash("sha256")
			.update(JSON.stringify(targets.map((target) => ({ id: target.id, rtmpUrl: target.rtmpUrl, credential: target.streamKey ? createHash("sha256").update(target.streamKey).digest("hex") : null })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))))
			.digest("hex");
		const original = JSON.parse(Buffer.from(candidate.lease.payload, "base64url").toString("utf8"));
		const updatedClaims = {
			...original,
			ownerId: updated.ownerId,
			runnerId: updated.runnerId,
			sessionId: updated.id,
			admissionId: updated.admissionId,
			generation: updated.executionGeneration,
			sourceId: updated.overlayId,
			sourceRevision: updated.sourceRevision,
			configurationRevision: updated.configurationRevision,
			targetHash: updated.targetHash,
			occurrenceId: updated.occurrenceId,
			scheduledStart: updated.scheduledStart,
			scheduledEnd: updated.scheduledEnd,
			executionPayloadHash: createHash("sha256")
				.update(JSON.stringify({ sourceId: updated.overlayId, sourceCredential: createHash("sha256").update(updated.overlaySecret).digest("hex"), mode: updated.mode === "24_7" ? "24/7" : updated.mode, fps: updated.fps, resolution: updated.resolution, targetHash: updated.targetHash }))
				.digest("hex"),
			...claimPatch,
		};
		const payload = Buffer.from(JSON.stringify(updatedClaims)).toString("base64url");
		return { ...updated, lease: { keyId: "fixture", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") } };
	};

	const adjacentScheduledJob = (matching = false) => {
		if (!options.cacheAuthorization || options.scheduledEnd === undefined) throw new Error("Adjacent fixture requires a cached scheduled end");
		const id = randomUUID(),
			admissionId = randomUUID(),
			generation = randomUUID(),
			leaseId = randomUUID();
		const nextRtmpUrl = matching ? rtmpUrl : rtmpUrl + "/following";
		const nextTargetHash = matching
			? targetHash
			: createHash("sha256")
					.update(JSON.stringify([{ id, rtmpUrl: nextRtmpUrl, credential: null }]))
					.digest("hex");
		const nextClaims = {
			...claims,
			sessionId: id,
			admissionId,
			generation,
			leaseId,
			targetHash: nextTargetHash,
			occurrenceId: '["following-event","original-anchor"]',
			scheduledStart: options.scheduledEnd,
			scheduledEnd: options.scheduledEnd + 60000,
			executionPayloadHash: createHash("sha256")
				.update(JSON.stringify({ sourceId, sourceCredential: createHash("sha256").update("fixture-source").digest("hex"), mode: "24/7", fps: 15, resolution: "720p", targetHash: nextTargetHash }))
				.digest("hex"),
		};
		const payload = Buffer.from(JSON.stringify(nextClaims)).toString("base64url");
		return { ...job, ...(matching ? { destinations: [{ id: sessionId, rtmpUrl, streamKey: null }] } : {}), id, admissionId, executionGeneration: generation, rtmpUrl: nextRtmpUrl, targetHash: nextTargetHash, occurrenceId: nextClaims.occurrenceId, scheduledStart: nextClaims.scheduledStart, scheduledEnd: nextClaims.scheduledEnd, lease: { keyId: "fixture", payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") } };
	};
	return { resignScheduledJob, adjacentScheduledJob, renew, job, request, leaseId, keys: { fixture: publicKey.export({ type: "spki", format: "pem" }).toString() }, ownerId, runnerId };
}

test("TDD-US5-CON015 U277: a captured paid window finishes its current clip at the signed scheduled end", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-scheduled-expiry-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", scheduledEnd: 1020000 });
		const journal = new ExecutionJournal(directory);
		let monotonic = 1500;
		let finishClip!: () => void;
		const clipClosed = new Promise<void>((resolve) => {
			finishClip = resolve;
		});
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn(() => clipClosed) };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 20999;
		await controller.tick();
		expect(engine.requestDrain).not.toHaveBeenCalled();
		monotonic = 21000;
		const draining = controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledWith({ deadlineMonotonic: 321000 });
		expect(engine.stop).not.toHaveBeenCalled();
		expect(controller.reports().some((report) => report.state === "stopped")).toBe(false);
		finishClip();
		await draining;
		expect(controller.reports()).toContainEqual(expect.objectContaining({ admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, state: "stopped", allOutputsClosed: true }));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: a valid fresh signed lease persists starting before opening output and active after startup", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-execution-runtime-"));
	try {
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory),
			read = () => JSON.parse(readFileSync(join(directory, "execution-journal.json"), "utf8")).executions;
		const start = jest.fn(async () => {
			expect(read()).toMatchObject([{ admissionId: fixture.job.admissionId, state: "starting" }]);
		});
		const engine = { start, stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const createEngine = jest.fn(() => engine);
		const { FreeExecutionController } = existsSync(join(__dirname, "../execution-runtime.ts")) ? await import("../execution-runtime") : { FreeExecutionController: undefined };
		const controller = FreeExecutionController ? new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine }) : undefined;
		expect(await controller?.apply(fixture.job, fixture.request)).toBe(true);
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(start).toHaveBeenCalledTimes(1);
		expect(read()).toMatchObject([{ admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, state: "active" }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: monotonic lease expiry starts bounded drain and persists closure before exposing a terminal receipt", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-expiry-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let monotonic = 1500,
			closed: (() => void) | undefined;
		const engine = {
			start: jest.fn().mockResolvedValue(undefined),
			stop: jest.fn().mockResolvedValue(undefined),
			requestDrain: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						closed = resolve;
					}),
			),
		};
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		const boundary = controller as typeof controller & { tick?: () => Promise<void> };
		monotonic = 300999;
		await boundary.tick?.();
		expect(engine.requestDrain).not.toHaveBeenCalled();
		expect(journal.get(fixture.job.admissionId)?.state).toBe("active");
		expect(controller.reports()).toMatchObject([{ state: "active" }]);
		monotonic = 301000;
		const expiring = boundary.tick?.();
		await Promise.resolve();
		expect(engine.requestDrain).toHaveBeenCalledWith({ deadlineMonotonic: 601000 });
		expect(journal.pendingTerminals()).toEqual([]);
		const current = JSON.parse(readFileSync(join(directory, "execution-journal.json"), "utf8")).executions[0];
		expect(current.state).toBe("draining");
		closed?.();
		await expiring;
		expect(new ExecutionJournal(directory).pendingTerminals()).toMatchObject([{ admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, state: "stopped", allOutputsClosed: true }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: a failed drain-intent write cannot delay closing expired output", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-drain-write-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let monotonic = 1500,
			closed: (() => void) | undefined;
		const engine = {
			start: jest.fn().mockResolvedValue(undefined),
			stop: jest.fn().mockResolvedValue(undefined),
			requestDrain: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						closed = resolve;
					}),
			),
		};
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
		await controller.apply(fixture.job, fixture.request);
		jest.spyOn(journal, "save").mockImplementationOnce(() => {
			throw new Error("controlled drain journal failure");
		});
		monotonic = 301000;
		let failure: unknown;
		const expiring = (controller as typeof controller & { tick: () => Promise<void> }).tick().catch((error) => {
			failure = error;
		});
		await Promise.resolve();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toEqual([]);
		closed?.();
		await expiring;
		expect(failure).toBeUndefined();
		expect(new ExecutionJournal(directory).pendingTerminals()).toMatchObject([{ state: "stopped", allOutputsClosed: true }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: terminal write failure keeps the receipt unavailable and retries persistence without reopening output", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-terminal-write-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let monotonic = 1500;
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
		await controller.apply(fixture.job, fixture.request);
		const save = journal.save.bind(journal),
			write = jest.spyOn(journal, "save").mockImplementation((value) => {
				if (value.state === "stopped") throw new Error("controlled terminal failure");
				save(value);
			});
		monotonic = 301000;
		await expect(controller.tick()).rejects.toThrow("controlled terminal failure");
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toEqual([]);
		write.mockRestore();
		let failure: unknown;
		await controller.tick().catch((error) => {
			failure = error;
		});
		expect(failure).toBeUndefined();
		expect(journal.pendingTerminals()).toMatchObject([{ state: "stopped", allOutputsClosed: true }]);
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(engine.start).toHaveBeenCalledTimes(1);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each([
	{ state: "draining" as const, acknowledged: false },
	{ state: "stopped" as const, acknowledged: false },
	{ state: "stopped" as const, acknowledged: true },
])("TDD-US1-DEC003: a fresh controller rejects renewed output for persisted $state (ack=$acknowledged)", async ({ state, acknowledged }) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-old-generation-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		const leaseId = JSON.parse(Buffer.from(fixture.job.lease.payload, "base64url").toString("utf8")).leaseId;
		journal.save({ ownerId: fixture.ownerId, runnerId: fixture.runnerId, sessionId: fixture.job.id, admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, leaseId, configurationRevision: 2, state, ...(state === "stopped" ? { allOutputsClosed: true as const, acknowledged } : {}), updatedAt: 1000 });
		const createEngine = jest.fn(() => ({ start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) }));
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 301000, createEngine }),
			request = { requestId: randomUUID(), sentAt: 301000 };
		let accepted: unknown;
		try {
			accepted = await controller.apply(fixture.renew(request.requestId), request);
		} catch (error) {
			accepted = error;
		}
		expect(accepted).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: startup completing after expiry closure cannot become active", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-late-start-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let monotonic = 1500,
			started: (() => void) | undefined;
		const engine = {
			start: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						started = resolve;
					}),
			),
			stop: jest.fn().mockResolvedValue(undefined),
			requestDrain: jest.fn().mockResolvedValue(undefined),
		};
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
		let result: unknown;
		const applying = controller.apply(fixture.job, fixture.request).then(
			(value) => {
				result = value;
			},
			(error) => {
				result = error;
			},
		);
		monotonic = 301000;
		await controller.tick();
		started?.();
		await applying;
		expect(result).toBe(false);
		expect(journal.pendingTerminals()).toMatchObject([{ state: "stopped", allOutputsClosed: true }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: the engine factory receives a live lease permission gate", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-output-gate-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let monotonic = 1500;
		const createEngine = jest.fn(() => ({ start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) }));
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
		await controller.apply(fixture.job, fixture.request);
		const policy = (createEngine.mock.calls[0] as unknown as [unknown, { mayOpenOutput?: () => boolean } | undefined])[1];
		expect(policy?.mayOpenOutput?.()).toBe(true);
		monotonic = 301000;
		expect(policy?.mayOpenOutput?.()).toBe(false);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: failed startup waits for output cleanup before persisting a terminal receipt", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-start-failure-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let closed: (() => void) | undefined, result: unknown;
		const engine = {
			start: jest.fn().mockRejectedValue(new Error("controlled startup failure")),
			stop: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						closed = resolve;
					}),
			),
			requestDrain: jest.fn().mockResolvedValue(undefined),
		};
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine: () => engine });
		const applying = controller.apply(fixture.job, fixture.request).then(
			(value) => {
				result = value;
			},
			(error) => {
				result = error;
			},
		);
		await Promise.resolve();
		await Promise.resolve();
		expect(engine.stop).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toEqual([]);
		closed?.();
		await applying;
		expect(result).toBe(false);
		expect(journal.pendingTerminals()).toMatchObject([{ state: "stopped", allOutputsClosed: true }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each([
	{ field: "rtmpUrl", value: "rtmp://127.0.0.1/other" },
	{ field: "streamKey", value: "other-fixture-key" },
	{ field: "overlayId", value: "88888888-8888-4888-8888-888888888888" },
])("TDD-US1-CON004: changing actual $field cannot reuse the signed assignment hash", async ({ field, value }) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-config-binding-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			createEngine = jest.fn(() => ({ start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) }));
		const controller = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => 1500, createEngine });
		expect(await controller.apply({ ...fixture.job, [field]: value }, fixture.request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: only an exact server terminal confirmation durably retires a queued receipt", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-confirm-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		const leaseId = JSON.parse(Buffer.from(fixture.job.lease.payload, "base64url").toString()).leaseId;
		journal.save({ ownerId: fixture.ownerId, runnerId: fixture.runnerId, sessionId: fixture.job.id, admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, leaseId, configurationRevision: 2, state: "stopped", allOutputsClosed: true, updatedAt: Date.now() });
		const controller = new FreeExecutionController({ ...fixture, journal, createEngine: jest.fn() });
		const confirm = (controller as unknown as { confirm?: (receipts: { admissionId: string; executionGeneration: string; state: string }[]) => void }).confirm?.bind(controller);
		confirm?.([]);
		confirm?.([{ admissionId: fixture.job.admissionId, executionGeneration: randomUUID(), state: "stopped" }]);
		confirm?.([{ admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, state: "active" }]);
		for (const binding of [{ ownerId: "foreign" }, { runnerId: randomUUID() }]) {
			const other = new FreeExecutionController({ ...fixture, ...binding, journal, createEngine: jest.fn() });
			expect(other.reports()).toEqual([]);
			other.confirm([{ admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, state: "stopped" }]);
		}
		expect(journal.pendingTerminals()).toHaveLength(1);
		confirm?.([{ admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, state: "stopped" }]);
		expect(new ExecutionJournal(directory).pendingTerminals()).toEqual([]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004: Stop commands bind the exact execution and Stop now interrupts an ongoing drain", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-stop-command-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let finish: (() => void) | undefined;
		const engine = {
			start: jest.fn().mockResolvedValue(undefined),
			requestDrain: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						finish = resolve;
					}),
			),
			stop: jest.fn(async () => {
				finish?.();
			}),
		};
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine: () => engine });
		await controller.apply(fixture.job, fixture.request);
		const stop = (controller as unknown as { stop?: (command: typeof fixture.job, immediate?: boolean) => Promise<boolean> }).stop?.bind(controller);
		for (const change of [{ executionGeneration: randomUUID() }, { ownerId: "foreign" }, { runnerId: randomUUID() }, { admissionId: randomUUID() }, { configurationRevision: 99 }, { id: randomUUID() }]) expect(await stop?.({ ...fixture.job, ...change })).toBe(false);
		expect(engine.requestDrain).not.toHaveBeenCalled();
		const draining = stop?.(fixture.job);
		await Promise.resolve();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toEqual([]);
		expect(await controller.apply(fixture.renew(randomUUID()), { requestId: randomUUID(), sentAt: 1000 })).toBe(false);
		expect(await stop?.(fixture.job, true)).toBe(true);
		expect(await draining).toBe(true);
		expect(engine.stop).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toMatchObject([{ executionGeneration: fixture.job.executionGeneration, allOutputsClosed: true }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001: heartbeat reports expose exact active identity and retain closed receipts until confirmed", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-reports-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine: () => engine });
		await controller.apply(fixture.job, fixture.request);
		const reports = (controller as unknown as { reports?: () => unknown[] }).reports?.bind(controller);
		const identity = { admissionId: fixture.job.admissionId, sessionId: fixture.job.id, executionGeneration: fixture.job.executionGeneration, leaseId: JSON.parse(Buffer.from(fixture.job.lease.payload, "base64url").toString()).leaseId, configurationRevision: 2 };
		expect(reports?.()).toEqual([{ ...identity, state: "active" }]);
		await controller.stop(fixture.job);
		expect(reports?.()).toEqual([{ ...identity, state: "stopped", allOutputsClosed: true }]);
		const restarted = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), createEngine: jest.fn() });
		expect((restarted as unknown as { reports?: () => unknown[] }).reports?.()).toEqual([{ ...identity, state: "stopped", allOutputsClosed: true }]);
		controller.confirm([{ ...identity, state: "stopped" }]);
		expect(reports?.()).toEqual([]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR004: local disconnect shutdown waits for every output and persists retryable terminal proof", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-disconnect-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let closed: (() => void) | undefined;
		const engine = {
			start: jest.fn().mockResolvedValue(undefined),
			stop: jest.fn().mockResolvedValue(undefined),
			requestDrain: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						closed = resolve;
					}),
			),
		};
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine: () => engine });
		await controller.apply(fixture.job, fixture.request);
		const disconnect = (controller as unknown as { stopAll?: () => Promise<void> }).stopAll?.();
		await Promise.resolve();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toEqual([]);
		closed?.();
		await disconnect;
		expect(journal.pendingTerminals()).toMatchObject([{ executionGeneration: fixture.job.executionGeneration, allOutputsClosed: true }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-DEC001 startup that consumes its lease drains before an Active report even without a watchdog tick", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-startup-elapsed-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		let clock = 1500;
		const engine = {
			start: jest.fn(async () => {
				clock = 301000;
			}),
			stop: jest.fn().mockResolvedValue(undefined),
			requestDrain: jest.fn().mockResolvedValue(undefined),
		};
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => clock, createEngine: () => engine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(false);
		expect(engine.requestDrain).toHaveBeenCalledWith({ deadlineMonotonic: 601000 });
		expect(controller.reports()).toMatchObject([{ state: "stopped", allOutputsClosed: true }]);
		expect(journal.get(fixture.job.admissionId)?.state).toBe("stopped");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["owner", "device", "stopped", "malformed"])("TDD-US1-CON004 invalid %s assignment cannot construct an output engine", async (kind) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-runtime-invalid-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory),
			createEngine = jest.fn();
		const job = { ...fixture.job, ...(kind === "owner" ? { ownerId: "foreign" } : kind === "device" ? { runnerId: randomUUID() } : kind === "stopped" ? { desiredState: "stopped" as const } : { lease: { ...fixture.job.lease, payload: "not-json" } }) };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine });
		expect(await controller.apply(job, fixture.request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
		expect(journal.get(job.admissionId)).toBeUndefined();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US1-FR023: fresh Free leases keep one execution active across a month and 24 connected hours", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-unlimited-execution-"));
	try {
		const serverBeginning = Date.UTC(2026, 9, 31, 23, 58);
		const fixture = runtimeFixture({ issuedAt: serverBeginning });
		const journal = new ExecutionJournal(directory);
		let now = fixture.request.sentAt + 500;
		let mayOpenOutput = () => false;
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const createEngine = jest.fn((_job, policy) => {
			mayOpenOutput = policy.mayOpenOutput;
			return engine;
		});
		const { FreeExecutionController } = await import("../execution-runtime");
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		const renewalStepMs = 240000;
		const renewals = 360;
		const accepted: boolean[] = [];
		for (let step = 1; step <= renewals; step++) {
			now += renewalStepMs;
			await controller.tick();
			const request = { requestId: randomUUID(), sentAt: now };
			accepted.push(await controller.apply(fixture.renew(request.requestId, serverBeginning + step * renewalStepMs), request));
		}
		expect(accepted).toHaveLength(renewals);
		expect(accepted.every(Boolean)).toBe(true);
		expect(new Date(serverBeginning).getUTCMonth()).not.toBe(new Date(serverBeginning + renewals * renewalStepMs).getUTCMonth());
		expect(mayOpenOutput()).toBe(true);
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(engine.start).toHaveBeenCalledTimes(1);
		expect(engine.requestDrain).not.toHaveBeenCalled();
		expect(engine.stop).not.toHaveBeenCalled();
		expect(journal.pendingTerminals()).toEqual([]);
		expect(controller.reports()).toMatchObject([{ state: "active", executionGeneration: fixture.job.executionGeneration, leaseId: fixture.leaseId }]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-FR012: local output consumes its bound cached authorization only inside the captured window", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cached-output-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 4600000, scheduledEnd: 8200000 });
		let elapsed = 1001;
		const journal = new ExecutionJournal(directory);
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => elapsed, createEngine: () => engine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(false);
		expect(engine.start).not.toHaveBeenCalled();
		elapsed = 3601000;
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		expect(engine.start).toHaveBeenCalledTimes(1);
		expect(new ExecutionJournal(directory).get(fixture.job.admissionId)).toMatchObject({ state: "active", occurrence: { occurrenceId: fixture.job.occurrenceId, start: 4600000, end: 8200000 } });
		elapsed = 7201000;
		await controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toEqual([expect.objectContaining({ state: "stopped", allOutputsClosed: true })]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-EC010 / TDD-US3-CON008: explicit local Stop records occurrence suppression before output drain", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cached-stop-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 4600000, scheduledEnd: 8200000 });
		const journal = new ExecutionJournal(directory);
		const pendingAdmission = randomUUID();
		const engine = {
			start: jest.fn().mockResolvedValue(undefined),
			stop: jest.fn().mockResolvedValue(undefined),
			requestDrain: jest.fn(async () => {
				expect(new ExecutionJournal(directory).get(fixture.job.admissionId)).toMatchObject({ state: "draining", occurrence: { suppressed: true } });
				expect(new ExecutionJournal(directory).get(pendingAdmission)).toMatchObject({ state: "pending", occurrence: { suppressed: true } });
			}),
		};
		const options = { ...fixture, journal, clock: () => 3601000, createEngine: () => engine };
		const controller = new FreeExecutionController(options);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		journal.save({ admissionId: pendingAdmission, ownerId: fixture.ownerId, runnerId: fixture.runnerId, sessionId: fixture.job.id, executionGeneration: randomUUID(), leaseId: randomUUID(), configurationRevision: 3, state: "pending", updatedAt: 1, occurrence: { occurrenceId: fixture.job.occurrenceId!, start: 4600000, end: 8200000 } });
		expect(await controller.stop(fixture.job)).toBe(true);
		expect(new ExecutionJournal(directory).get(fixture.job.admissionId)).toMatchObject({ state: "stopped", occurrence: { suppressed: true } });
		expect(await new FreeExecutionController(options).apply(fixture.job, fixture.request)).toBe(false);
		expect(engine.start).toHaveBeenCalledTimes(1);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each([{ overlaySecret: "altered-private-source" }, { resolution: "1080p" }, { fps: 60 }, { overlayId: "99999999-9999-4999-8999-999999999999" }, { mode: "failsafe" as const }])("TDD-US3-FR012 private-payload baseline: tampered %j cannot create output or a starting journal record", async (patch) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cached-payload-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 4600000, scheduledEnd: 8200000 });
		const journal = new ExecutionJournal(directory);
		const createEngine = jest.fn();
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 3601000, createEngine });
		expect(await controller.apply({ ...fixture.job, ...patch }, fixture.request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
		expect(journal.get(fixture.job.admissionId)).toBeUndefined();
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: a cached pending admission with durable Stop suppression cannot open output", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-suppressed-pending-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 4600000, scheduledEnd: 8200000 });
		const journal = new ExecutionJournal(directory);
		journal.save({ admissionId: fixture.job.admissionId, ownerId: fixture.ownerId, runnerId: fixture.runnerId, sessionId: fixture.job.id, executionGeneration: fixture.job.executionGeneration, leaseId: fixture.leaseId, configurationRevision: 2, updatedAt: 1, state: "pending", occurrence: { occurrenceId: fixture.job.occurrenceId!, start: 4600000, end: 8200000, suppressed: true } });
		const createEngine = jest.fn(() => ({ start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) }));
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 3601000, createEngine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
		expect(new ExecutionJournal(directory).get(fixture.job.admissionId)).toMatchObject({ state: "pending", occurrence: { suppressed: true } });
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: failure to persist occurrence suppression still drains physical outputs before retrying storage", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-stop-storage-failure-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 4600000, scheduledEnd: 8200000 });
		const journal = new ExecutionJournal(directory);
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 3601000, createEngine: () => engine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		const pendingAdmission = randomUUID();
		journal.save({ admissionId: pendingAdmission, ownerId: fixture.ownerId, runnerId: fixture.runnerId, sessionId: fixture.job.id, executionGeneration: randomUUID(), leaseId: randomUUID(), configurationRevision: 3, state: "pending", updatedAt: 1, occurrence: { occurrenceId: fixture.job.occurrenceId!, start: 4600000, end: 8200000 } });
		jest.spyOn(journal, "suppressOccurrence").mockImplementationOnce(() => {
			throw new Error("FIXTURE_STORAGE_UNAVAILABLE");
		});
		await expect(controller.stop(fixture.job)).resolves.toBe(true);
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(new ExecutionJournal(directory).get(pendingAdmission)).toMatchObject({ state: "pending", occurrence: { suppressed: true } });
		expect(new ExecutionJournal(directory).get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { suppressed: true } });
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-FR012: fresh online permission after cached-process restart preserves the original occurrence journal", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cached-online-restart-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 4600000, scheduledEnd: 8200000 });
		const journal = new ExecutionJournal(directory);
		journal.save({ admissionId: fixture.job.admissionId, ownerId: fixture.ownerId, runnerId: fixture.runnerId, sessionId: fixture.job.id, executionGeneration: fixture.job.executionGeneration, leaseId: fixture.leaseId, configurationRevision: 2, state: "active", updatedAt: 1, occurrence: { occurrenceId: fixture.job.occurrenceId!, start: 4600000, end: 8200000 } });
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1001, createEngine: () => engine });
		const request = { requestId: randomUUID(), sentAt: 1000 };
		expect(await controller.apply(fixture.renew(request.requestId, 4600001, true), request)).toBe(true);
		expect(engine.start).toHaveBeenCalledTimes(1);
		expect(new ExecutionJournal(directory).get(fixture.job.admissionId)).toMatchObject({ state: "active", occurrence: { occurrenceId: fixture.job.occurrenceId, start: 4600000, end: 8200000 } });
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-EC009: playback timeout survives journal restart and remains in the terminal receipt", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-timeout-receipt-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", scheduledEnd: 1020000 });
		const journal = new ExecutionJournal(directory);
		let monotonic = 1500;
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined), drainOutcome: "playback_timeout" as const };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 21000;
		await controller.tick();
		expect(controller.reports()).toContainEqual(expect.objectContaining({ admissionId: fixture.job.admissionId, state: "stopped", allOutputsClosed: true, playbackOutcome: "playback_timeout" }));
		const restarted = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), createEngine: () => engine });
		expect(restarted.reports()).toContainEqual(expect.objectContaining({ admissionId: fixture.job.admissionId, playbackOutcome: "playback_timeout" }));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each([
	{ policy: "pro_broadcast" as const, scheduledEnd: 1020000, expected: 21000 },
	{ policy: "free_lease" as const, scheduledEnd: undefined, expected: null },
	{ policy: "pro_broadcast" as const, scheduledEnd: undefined, expected: null },
])("TDD-US3-OPT039: only verified scheduled Pro authority supplies the player deadline ($policy/$scheduledEnd)", async ({ policy, scheduledEnd, expected }) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-player-deadline-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy, scheduledEnd });
		const createEngine = jest.fn(() => ({ start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) }));
		const controller = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => 1500, createEngine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		const parameters: unknown[] = createEngine.mock.calls[0];
		expect(parameters[1]).toMatchObject({ scheduledDeadlineMonotonic: expected });
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-FR013: finishing is reported while physical clip closure is still pending", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-finishing-report-"));
	let finishClip: (() => void) | undefined;
	let draining: Promise<void> | undefined;
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture({ policy: "pro_broadcast", scheduledEnd: 1020000 });
		let monotonic = 1500;
		const engine = {
			start: jest.fn().mockResolvedValue(undefined),
			stop: jest.fn().mockResolvedValue(undefined),
			requestDrain: jest.fn(
				() =>
					new Promise<void>((resolve) => {
						finishClip = resolve;
					}),
			),
		};
		const journal = new ExecutionJournal(directory);
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 21000;
		draining = controller.tick();
		expect(controller.reports()).toContainEqual(expect.objectContaining({ admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, state: "draining" }));
		expect(journal.pendingTerminals()).toEqual([]);
		expect(controller.reports().some((report) => "allOutputsClosed" in report)).toBe(false);
		finishClip!();
		await draining;
		expect(controller.reports()).toContainEqual(expect.objectContaining({ state: "stopped", allOutputsClosed: true }));
	} finally {
		finishClip?.();
		await draining;
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-FR014 / TDD-US3-OPT048: a distinct adjacent admission cannot start until the earlier physical closure is journaled", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-scheduled-handoff-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const journal = new ExecutionJournal(directory);
	let monotonic = 1500,
		finishClip!: () => void;
	const closure = new Promise<void>((resolve) => {
		finishClip = resolve;
	});
	const first = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn(() => closure) };
	const following = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const createEngine = jest.fn((job) => (job.admissionId === fixture.job.admissionId ? first : following));
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
	try {
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 21001;
		const draining = controller.tick();
		const next = fixture.adjacentScheduledJob();
		expect(await controller.apply(next, fixture.request)).toBe(false);
		expect(following.start).not.toHaveBeenCalled();
		expect(journal.get(next.admissionId)).toBeUndefined();
		expect(journal.pendingTerminals()).toEqual([]);
		finishClip();
		await draining;
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(await controller.apply(next, fixture.request)).toBe(true);
		expect(following.start).toHaveBeenCalledTimes(1);
		expect(journal.get(next.admissionId)).toMatchObject({ state: "active" });
	} finally {
		finishClip();
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-OPT047: a source-only change keeps its original target but waits for prior physical closure", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-source-only-handoff-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const journal = new ExecutionJournal(directory);
	let monotonic = 1500,
		finishClip!: () => void;
	const closure = new Promise<void>((resolve) => {
		finishClip = resolve;
	});
	const first = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn(() => closure) };
	const following = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const createEngine = jest.fn((job) => (job.admissionId === fixture.job.admissionId ? first : following));
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
	const next = fixture.resignScheduledJob(fixture.adjacentScheduledJob(true), { overlayId: randomUUID() });
	try {
		expect(next.targetHash).toBe(fixture.job.targetHash);
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 21001;
		const draining = controller.tick();
		expect(await controller.apply(next, fixture.request)).toBe(false);
		expect(following.start).not.toHaveBeenCalled();
		expect(journal.get(next.admissionId)).toBeUndefined();
		expect(journal.pendingTerminals()).toEqual([]);
		finishClip();
		await draining;
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(await controller.apply(next, fixture.request)).toBe(true);
		expect(following.start).toHaveBeenCalledTimes(1);
		expect(createEngine.mock.calls.at(-1)?.[0]).toMatchObject({ overlayId: next.overlayId, targetHash: fixture.job.targetHash });
		expect(journal.get(next.admissionId)).toMatchObject({ state: "active" });
	} finally {
		finishClip();
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-OPT049: a successor remains unstarted when its signed end passes before prior physical closure", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-expired-handoff-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const journal = new ExecutionJournal(directory);
	let monotonic = 1500,
		finishClip!: () => void;
	const closure = new Promise<void>((resolve) => {
		finishClip = resolve;
	});
	const first = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn(() => closure) };
	const following = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const createEngine = jest.fn((job: FreeExecutionJob) => (job.admissionId === fixture.job.admissionId ? first : following));
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
	try {
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 21001;
		const draining = controller.tick();
		const next = fixture.adjacentScheduledJob();
		expect(await controller.apply(next, fixture.request)).toBe(false);
		monotonic = 81001;
		finishClip();
		await draining;
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(await controller.apply(next, fixture.request)).toBe(false);
		expect(following.start).not.toHaveBeenCalled();
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(journal.get(next.admissionId)).toBeUndefined();
	} finally {
		finishClip();
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-OPT046 / TDD-US3-DEC010: a verified matching week-boundary continuation shares one engine and retains both original occurrence ends", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-continuous-schedule-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const sunday = Date.UTC(2027, 0, 3, 23, 59);
	const fixture = runtimeFixture({ issuedAt: sunday, policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: sunday, scheduledEnd: sunday + 60000 });
	const next = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	let monotonic = 1500;
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const createEngine = jest.fn(() => engine);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
	try {
		(controller as unknown as { prepareScheduledJobs?: (jobs: FreeExecutionJob[], request: typeof fixture.request) => boolean }).prepareScheduledJobs?.([fixture.job, next], fixture.request);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 61001;
		await controller.tick();
		expect(engine.requestDrain).not.toHaveBeenCalled();
		expect(await controller.apply(next, fixture.request)).toBe(true);
		expect(engine.start).toHaveBeenCalledTimes(1);
		expect(createEngine).toHaveBeenCalledTimes(1);
		const parameters: unknown[] = createEngine.mock.calls[0];
		expect(parameters[1]).toMatchObject({ scheduledDeadlineMonotonic: 121000 });
		expect(controller.reports()).toEqual(expect.arrayContaining([expect.objectContaining({ admissionId: fixture.job.admissionId, state: "active" }), expect.objectContaining({ admissionId: next.admissionId, state: "active" })]));
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "active", occurrence: { end: sunday + 60000 } });
		expect(journal.get(next.admissionId)).toMatchObject({ state: "active", occurrence: { start: sunday + 60000, end: sunday + 120000 } });
		monotonic = 121000;
		await controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toEqual(expect.arrayContaining([expect.objectContaining({ admissionId: fixture.job.admissionId, allOutputsClosed: true }), expect.objectContaining({ admissionId: next.admissionId, allOutputsClosed: true })]));
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-DEC010: a delayed previous-member Stop cannot terminate the current shared occurrence", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-continuity-stale-stop-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	let monotonic = 1500;
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 21001;
		await controller.tick();
		expect(await controller.stop(fixture.job)).toBe(false);
		expect(engine.requestDrain).not.toHaveBeenCalled();
		expect(journal.get(next.admissionId)).toMatchObject({ state: "active" });
		expect(journal.get(next.admissionId)?.occurrence?.suppressed).not.toBe(true);
		expect(await controller.stop(next)).toBe(true);
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(journal.get(fixture.job.admissionId)?.occurrence?.suppressed).not.toBe(true);
		expect(journal.get(next.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { suppressed: true } });
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-DEC010: stopping before a shared continuation starts leaves that distinct future occurrence startable", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-continuity-future-stop-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	let monotonic = 1500;
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const createEngine = jest.fn(() => engine);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		expect(controller.reports().map((record) => record.admissionId)).toEqual([fixture.job.admissionId]);
		expect(await controller.stop(fixture.job)).toBe(true);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { suppressed: true } });
		expect(journal.get(next.admissionId)).toMatchObject({ state: "pending" });
		expect(journal.get(next.admissionId)?.occurrence?.suppressed).not.toBe(true);
		monotonic = 21001;
		expect(await controller.apply(next, fixture.request)).toBe(true);
		expect(createEngine).toHaveBeenCalledTimes(2);
		expect(journal.get(next.admissionId)).toMatchObject({ state: "active" });
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-DEC010: failed continuation activation persistence fences output and closes only started membership", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-continuity-activation-failure-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	const save = journal.save.bind(journal);
	let failActivation = true,
		monotonic = 1500,
		finishClosure!: () => void,
		mayOpenOutput!: () => boolean;
	jest.spyOn(journal, "save").mockImplementation((record) => {
		if (record.admissionId === next.admissionId && record.state === "active" && failActivation) {
			failActivation = false;
			throw new Error("fixture continuation activation storage unavailable");
		}
		save(record);
	});
	const closure = new Promise<void>((resolve) => {
		finishClosure = resolve;
	});
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn(() => closure) };
	const controller = new FreeExecutionController({
		...fixture,
		journal,
		clock: () => monotonic,
		createEngine: (_job, policy) => {
			mayOpenOutput = policy.mayOpenOutput;
			return engine;
		},
	});
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		expect(mayOpenOutput()).toBe(true);
		monotonic = 21001;
		const draining = controller.tick();
		expect(mayOpenOutput()).toBe(false);
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(next.admissionId)).toMatchObject({ state: "pending" });
		expect(controller.reports()).not.toEqual(expect.arrayContaining([expect.objectContaining({ admissionId: next.admissionId, state: "active" })]));
		finishClosure();
		await draining;
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(journal.get(next.admissionId)).toMatchObject({ state: "pending" });
		expect(await controller.apply(next, fixture.request)).toBe(true);
	} finally {
		finishClosure();
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-DEC010: failing the first shared active receipt closes physical output before returning an unsuccessful start", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-continuity-initial-active-failure-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	const save = journal.save.bind(journal);
	let failActivation = true,
		mayOpenOutput!: () => boolean;
	jest.spyOn(journal, "save").mockImplementation((record) => {
		if (record.admissionId === fixture.job.admissionId && record.state === "active" && failActivation) {
			failActivation = false;
			throw new Error("fixture initial activation storage unavailable");
		}
		save(record);
	});
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const controller = new FreeExecutionController({
		...fixture,
		journal,
		clock: () => 1500,
		createEngine: (_job, policy) => {
			mayOpenOutput = policy.mayOpenOutput;
			return engine;
		},
	});
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		await expect(controller.apply(fixture.job, fixture.request)).resolves.toBe(false);
		expect(mayOpenOutput()).toBe(false);
		expect(engine.stop).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(journal.get(next.admissionId)).toMatchObject({ state: "pending" });
		expect(controller.reports()).not.toEqual(expect.arrayContaining([expect.objectContaining({ state: "active" })]));
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-EC010: preparing an empty replacement removes only unstarted continuity authority and preserves the current original end", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-continuity-paused-cache-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	let monotonic = 1500,
		mayOpenOutput!: () => boolean;
	const engine = { updateScheduledDeadline: jest.fn().mockResolvedValue(undefined), start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const controller = new FreeExecutionController({
		...fixture,
		journal,
		clock: () => monotonic,
		createEngine: (_job, policy) => {
			mayOpenOutput = policy.mayOpenOutput;
			return engine;
		},
	});
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 2000;
		expect(controller.prepareScheduledJobs([], fixture.request)).toBe(true);
		await controller.tick();
		expect(engine.updateScheduledDeadline).toHaveBeenCalledWith(21000);
		expect(mayOpenOutput()).toBe(true);
		expect(engine.requestDrain).not.toHaveBeenCalled();
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "active", occurrence: { end: 1020000 } });
		monotonic = 21001;
		expect(mayOpenOutput()).toBe(false);
		await controller.tick();
		expect(engine.start).toHaveBeenCalledTimes(1);
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { end: 1020000 } });
		expect(journal.get(next.admissionId)).toMatchObject({ state: "pending" });
		expect(controller.reports()).not.toEqual(expect.arrayContaining([expect.objectContaining({ admissionId: next.admissionId, state: "active" })]));
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-DEC010: retrying a partial member receipt cannot erase an already acknowledged terminal", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-continuity-receipt-retry-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	const save = journal.save.bind(journal);
	let failNextReceipt = true,
		monotonic = 1500;
	jest.spyOn(journal, "save").mockImplementation((record) => {
		if (record.admissionId === next.admissionId && record.state === "stopped" && failNextReceipt) {
			failNextReceipt = false;
			throw new Error("fixture receipt persistence unavailable");
		}
		save(record);
	});
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
	try {
		controller.prepareScheduledJobs([fixture.job, next], fixture.request);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 21001;
		await controller.tick();
		monotonic = 81000;
		await expect(controller.tick()).rejects.toThrow("fixture receipt persistence unavailable");
		expect(journal.pendingTerminals().map((record) => record.admissionId)).toEqual([fixture.job.admissionId]);
		controller.confirm([{ admissionId: fixture.job.admissionId, executionGeneration: fixture.job.executionGeneration, state: "stopped" }]);
		expect(journal.pendingTerminals()).toEqual([]);
		await controller.tick();
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, acknowledged: true });
		expect(journal.pendingTerminals().map((record) => record.admissionId)).toEqual([next.admissionId]);
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each([
	"invalid-signature",
	"unknown-key",
	"wrong-request",
	"foreign-owner",
	"foreign-runner",
	"non-pro-policy",
	"ordinary-job",
	"empty-targets",
	"changed-private-target",
	"changed-private-source",
	"changed-source-id",
	"changed-source-revision",
	"changed-fps",
	"changed-resolution",
	"one-ms-gap",
	"one-ms-overlap",
	"mismatched-signed-end",
	"journal-stopped",
	"journal-draining",
	"journal-suppressed",
	"journal-wrong-lease",
	"duplicate-admission",
	"ambiguous-following-window",
	"expires-at-start",
	"malformed-payload",
	"future-request-clock",
])("TDD-US3-DEC010: %s cannot widen the captured current window", async (kind) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-continuity-authority-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	let next: FreeExecutionJob = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	const claims = JSON.parse(Buffer.from(next.lease.payload, "base64url").toString("utf8"));
	const futureRecord: ExecutionRecord = { ownerId: next.ownerId, runnerId: next.runnerId, sessionId: next.id, admissionId: next.admissionId, executionGeneration: next.executionGeneration, configurationRevision: next.configurationRevision, leaseId: claims.leaseId, state: "pending", updatedAt: 1, occurrence: { occurrenceId: next.occurrenceId!, start: next.scheduledStart!, end: next.scheduledEnd! } };
	let request = fixture.request;
	const extra: FreeExecutionJob[] = [];
	switch (kind) {
		case "invalid-signature":
			next = { ...next, lease: { ...next.lease, signature: "invalid-signature" } };
			break;
		case "unknown-key":
			next = { ...next, lease: { ...next.lease, keyId: "unknown" } };
			break;
		case "wrong-request":
			next = fixture.resignScheduledJob(next, {}, { requestId: randomUUID() });
			break;
		case "foreign-owner":
			next = fixture.resignScheduledJob(next, { ownerId: "another-creator" });
			break;
		case "foreign-runner":
			next = fixture.resignScheduledJob(next, { runnerId: randomUUID() });
			break;
		case "non-pro-policy":
			next = fixture.resignScheduledJob(next, {}, { policy: "free_lease" });
			break;
		case "ordinary-job":
			next = { ...next, cacheAuthorization: undefined };
			break;
		case "empty-targets":
			next = { ...next, destinations: [] };
			break;
		case "changed-private-target":
			next = { ...next, destinations: next.destinations!.map((target) => ({ ...target, rtmpUrl: target.rtmpUrl + "/tampered" })) };
			break;
		case "changed-private-source":
			next = { ...next, overlaySecret: "tampered-secret" };
			break;
		case "changed-source-id":
			next = fixture.resignScheduledJob(next, { overlayId: randomUUID() });
			break;
		case "changed-source-revision":
			next = fixture.resignScheduledJob(next, { sourceRevision: 2 });
			break;
		case "changed-fps":
			next = fixture.resignScheduledJob(next, { fps: 30 });
			break;
		case "changed-resolution":
			next = fixture.resignScheduledJob(next, { resolution: "1080p" });
			break;
		case "one-ms-gap":
			next = fixture.resignScheduledJob(next, { scheduledStart: next.scheduledStart! + 1 });
			break;
		case "one-ms-overlap":
			next = fixture.resignScheduledJob(next, { scheduledStart: next.scheduledStart! - 1 });
			break;
		case "mismatched-signed-end":
			next = { ...next, scheduledEnd: next.scheduledEnd! + 1 };
			break;
		case "journal-stopped":
			journal.save({ ...futureRecord, state: "stopped", allOutputsClosed: true });
			break;
		case "journal-draining":
			journal.save({ ...futureRecord, state: "draining" });
			break;
		case "journal-suppressed":
			journal.save({ ...futureRecord, occurrence: { ...futureRecord.occurrence!, suppressed: true } });
			break;
		case "journal-wrong-lease":
			journal.save({ ...futureRecord, leaseId: randomUUID() });
			break;
		case "duplicate-admission":
			extra.push(next);
			break;
		case "ambiguous-following-window":
			extra.push(fixture.resignScheduledJob(next, { id: randomUUID(), admissionId: randomUUID(), executionGeneration: randomUUID(), occurrenceId: '["competing-event","original-anchor"]' }, { leaseId: randomUUID() }));
			break;
		case "expires-at-start":
			next = fixture.resignScheduledJob(next, {}, { expiresAt: next.scheduledStart });
			break;
		case "malformed-payload":
			next = { ...next, lease: { ...next.lease, payload: Buffer.from("{").toString("base64url") } };
			break;
		case "future-request-clock":
			request = { ...request, sentAt: 1501 };
			break;
	}
	let monotonic = 1500;
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const createEngine = jest.fn(() => engine);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
	try {
		controller.prepareScheduledJobs([fixture.job, next, ...extra], request);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		const parameters: unknown[] = createEngine.mock.calls[0];
		expect(parameters[1]).toMatchObject({ scheduledDeadlineMonotonic: 21000 });
		expect(createEngine).toHaveBeenCalledTimes(1);
		monotonic = 21001;
		await controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { end: 1020000 } });
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-EC010: a stalled renderer deadline update cannot block the original native end or output closure", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-paused-deadline-stall-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	const journal = new ExecutionJournal(directory);
	let monotonic = 1500,
		release!: () => void;
	const propagation = new Promise<void>((resolve) => {
		release = resolve;
	});
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined), updateScheduledDeadline: jest.fn(() => propagation) };
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine: () => engine });
	let firstTick: Promise<void> | undefined, endTick: Promise<void> | undefined;
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		monotonic = 2000;
		expect(controller.prepareScheduledJobs([], fixture.request)).toBe(true);
		firstTick = controller.tick();
		await Promise.resolve();
		expect(engine.updateScheduledDeadline).toHaveBeenCalledWith(21000);
		expect(engine.requestDrain).not.toHaveBeenCalled();
		monotonic = 21000;
		endTick = controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		await endTick;
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(journal.get(next.admissionId)?.state).toBe("pending");
	} finally {
		release();
		await Promise.all([firstTick, endTick]);
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each([2, 3])("TDD-US3-EC010: durable logical Stop blocks an unseen admission at configuration revision %i after restart", async (configurationRevision) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-logical-stop-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const original = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => 1500, createEngine: () => engine });
	let restarted: InstanceType<typeof FreeExecutionController> | undefined;
	try {
		expect(await original.apply(fixture.job, fixture.request)).toBe(true);
		expect(await original.stop(fixture.job)).toBe(true);
		const alias = fixture.resignScheduledJob(fixture.job, { admissionId: randomUUID(), executionGeneration: randomUUID(), configurationRevision }, { leaseId: randomUUID() });
		const journal = new ExecutionJournal(directory);
		const createEngine = jest.fn(() => engine);
		restarted = new FreeExecutionController({ ...fixture, journal, clock: () => 2000, createEngine });
		expect(await restarted.apply(alias, fixture.request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
		expect(journal.get(alias.admissionId)).toBeUndefined();
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { suppressed: true } });
	} finally {
		await original.stopAll();
		await restarted?.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-FR015 / TDD-US3-OPT045: restored active identity starts once with only its original remaining window", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-remaining-window-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	let monotonic = 1500;
	const oldEngine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const original = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => monotonic, createEngine: () => oldEngine });
	let restarted: InstanceType<typeof FreeExecutionController> | undefined;
	try {
		expect(await original.apply(fixture.job, fixture.request)).toBe(true);
		await oldEngine.stop(); // Process loss leaves the durable active record, without Stop intent.
		monotonic = 15000;
		const journal = new ExecutionJournal(directory);
		const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const createEngine = jest.fn(() => engine);
		restarted = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
		expect(restarted.prepareScheduledJobs([fixture.job], fixture.request)).toBe(true);
		expect(await restarted.apply(fixture.job, fixture.request)).toBe(true);
		expect(await restarted.apply(fixture.job, fixture.request)).toBe(true);
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(engine.start).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "active", executionGeneration: fixture.job.executionGeneration, occurrence: { start: 1000000, end: 1020000 } });
		expect(journal.get(fixture.job.admissionId)?.occurrence?.suppressed).not.toBe(true);
		monotonic = 20999;
		await restarted.tick();
		expect(engine.requestDrain).not.toHaveBeenCalled();
		monotonic = 21000;
		await restarted.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { end: 1020000 } });
	} finally {
		await restarted?.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-OPT042 / TDD-US3-OPT089 / TDD-US3-CON011: suppression of one weekly occurrence preserves a later offline window's original bounds and single start", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-weekly-return-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	const original = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => 1500, createEngine: () => engine });
	let returned: InstanceType<typeof FreeExecutionController> | undefined;
	try {
		expect(await original.apply(fixture.job, fixture.request)).toBe(true);
		expect(await original.stop(fixture.job)).toBe(true);
		const request = { requestId: randomUUID(), sentAt: 1000 };
		const issuedAt = 1000000 + 604800000 - 10000;
		const next = fixture.resignScheduledJob(fixture.job, { admissionId: randomUUID(), executionGeneration: randomUUID(), occurrenceId: JSON.stringify([JSON.parse(fixture.job.occurrenceId!)[0], "following-week"]), scheduledStart: 1000000 + 604800000, scheduledEnd: 1020000 + 604800000 }, { leaseId: randomUUID(), requestId: request.requestId, issuedAt, expiresAt: issuedAt + 604800000 });
		const journal = new ExecutionJournal(directory);
		const nextEngine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const createEngine = jest.fn(() => nextEngine);
		let monotonic = 15000;
		returned = new FreeExecutionController({ ...fixture, journal, clock: () => monotonic, createEngine });
		expect(journal.get(next.admissionId)).toBeUndefined();
		expect(returned.prepareScheduledJobs([next], request)).toBe(true);
		expect(await returned.apply(next, request)).toBe(true);
		expect(await returned.apply(next, request)).toBe(true);
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(nextEngine.start).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", occurrence: { suppressed: true } });
		expect(journal.get(next.admissionId)).toMatchObject({ state: "active", occurrence: { occurrenceId: next.occurrenceId, start: next.scheduledStart, end: next.scheduledEnd } });
		expect(journal.get(next.admissionId)?.occurrence?.suppressed).not.toBe(true);
		monotonic = 31000;
		await returned.tick();
		expect(nextEngine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(next.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { end: next.scheduledEnd } });
	} finally {
		await returned?.stopAll();
		await original.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-EC010: explicit signed owner Resume persists its occurrence control revision for a later cached cold restart", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-owner-resume-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	let now = 1500;
	const original = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => now, createEngine: () => engine });
	let restarted: InstanceType<typeof FreeExecutionController> | undefined;
	try {
		expect(await original.apply(fixture.job, fixture.request)).toBe(true);
		expect(await original.stop(fixture.job)).toBe(true);
		const resumeRequest = { requestId: randomUUID(), sentAt: 2000 };
		now = 2500;
		const resumed = fixture.resignScheduledJob(fixture.job, { cacheAuthorization: undefined, admissionId: randomUUID(), executionGeneration: randomUUID(), configurationRevision: 4 }, { kind: "execution", cacheAuthorization: undefined, executionPayloadHash: undefined, leaseId: randomUUID(), requestId: resumeRequest.requestId, issuedAt: 1001000, expiresAt: 1301000 });
		expect(await original.apply(resumed, resumeRequest)).toBe(true);
		const durable = new ExecutionJournal(directory).get(resumed.admissionId);
		expect(durable).toMatchObject({ state: "active", configurationRevision: 4, occurrence: { occurrenceId: fixture.job.occurrenceId, start: 1000000, end: 1020000, explicitResume: true } });
		await engine.stop(); // Simulated process loss must not create another owner Stop.
		const cacheRequest = { requestId: randomUUID(), sentAt: 3000 };
		const cached = fixture.resignScheduledJob(resumed, { cacheAuthorization: true }, { kind: "scheduled_execution", cacheAuthorization: true, requestId: cacheRequest.requestId, issuedAt: 1002000, expiresAt: 1002000 + 604800000 });
		now = 3500;
		const coldEngine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const createEngine = jest.fn(() => coldEngine);
		restarted = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => now, createEngine });
		expect(restarted.prepareScheduledJobs([cached], cacheRequest)).toBe(true);
		expect(await restarted.apply(cached, cacheRequest)).toBe(true);
		expect(await restarted.apply(cached, cacheRequest)).toBe(true);
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(coldEngine.start).toHaveBeenCalledTimes(1);
		expect(new ExecutionJournal(directory).get(resumed.admissionId)).toMatchObject({ state: "active", configurationRevision: 4, occurrence: { explicitResume: true, end: 1020000 } });
	} finally {
		await restarted?.stopAll();
		await original.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["occurrenceId", "scheduledStart", "scheduledEnd"] as const)("TDD-US3-EC010: ordinary owner Resume rejects a job with unsigned %s", async (field) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-resume-binding-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const request = { requestId: randomUUID(), sentAt: 2000 };
	const resumed = fixture.resignScheduledJob(fixture.job, { cacheAuthorization: undefined, admissionId: randomUUID(), executionGeneration: randomUUID(), configurationRevision: 4 }, { kind: "execution", cacheAuthorization: undefined, executionPayloadHash: undefined, leaseId: randomUUID(), requestId: request.requestId, issuedAt: 1001000, expiresAt: 1301000 });
	const tampered = { ...resumed, [field]: field === "occurrenceId" ? "another-occurrence" : Number(resumed[field]) + 1 };
	const createEngine = jest.fn(() => ({ start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) }));
	const journal = new ExecutionJournal(directory);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 2500, createEngine });
	try {
		expect(await controller.apply(tampered, request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
		expect(journal.get(resumed.admissionId)).toBeUndefined();
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["older_cache_after_resume", "newer_cache_after_second_stop"])("TDD-US3-EC010: durable owner control ordering rejects %s after process reconstruction", async (scenario) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-resume-ordering-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	let now = 1500;
	const original = new FreeExecutionController({ ...fixture, journal: new ExecutionJournal(directory), clock: () => now, createEngine: () => engine });
	let restarted: InstanceType<typeof FreeExecutionController> | undefined;
	try {
		expect(await original.apply(fixture.job, fixture.request)).toBe(true);
		expect(await original.stop(fixture.job)).toBe(true);
		const resumeRequest = { requestId: randomUUID(), sentAt: 2000 };
		now = 2500;
		const resumed = fixture.resignScheduledJob(fixture.job, { cacheAuthorization: undefined, admissionId: randomUUID(), executionGeneration: randomUUID(), configurationRevision: 4 }, { kind: "execution", cacheAuthorization: undefined, executionPayloadHash: undefined, leaseId: randomUUID(), requestId: resumeRequest.requestId, issuedAt: 1001000, expiresAt: 1301000 });
		expect(await original.apply(resumed, resumeRequest)).toBe(true);
		if (scenario === "newer_cache_after_second_stop") expect(await original.stop(resumed)).toBe(true);
		else await engine.stop();
		const request = { requestId: randomUUID(), sentAt: 3000 };
		now = 3500;
		const replay = fixture.resignScheduledJob(fixture.job, { admissionId: randomUUID(), executionGeneration: randomUUID(), configurationRevision: scenario === "older_cache_after_resume" ? 3 : 5 }, { leaseId: randomUUID(), requestId: request.requestId, issuedAt: 1002000, expiresAt: 1002000 + 604800000 });
		const journal = new ExecutionJournal(directory),
			createEngine = jest.fn(() => engine);
		restarted = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine });
		expect(journal.isOccurrenceSuppressed({ ownerId: fixture.ownerId, runnerId: fixture.runnerId, occurrenceId: fixture.job.occurrenceId! })).toBe(scenario === "newer_cache_after_second_stop");
		expect(restarted.prepareScheduledJobs([replay], request)).toBe(true);
		expect(await restarted.apply(replay, request)).toBe(false);
		expect(createEngine).not.toHaveBeenCalled();
		expect(journal.get(replay.admissionId)).toBeUndefined();
		expect(journal.get(resumed.admissionId)).toMatchObject({ configurationRevision: 4, occurrence: { explicitResume: true, end: 1020000 } });
	} finally {
		await restarted?.stopAll();
		await original.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["cached_start", "ordinary_owner_start"])("TDD-US3-EC010 / TDD-US3-OPT046: fresh adjacent authority joins %s without replacing its accepted capture", async (initialKind) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-late-continuity-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const first = initialKind === "cached_start" ? fixture.job : fixture.resignScheduledJob(fixture.job, { cacheAuthorization: undefined }, { kind: "execution", cacheAuthorization: undefined, executionPayloadHash: undefined, expiresAt: 1300000 });
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined), updateScheduledDeadline: jest.fn().mockResolvedValue(undefined) };
	let now = 1500;
	const journal = new ExecutionJournal(directory),
		createEngine = jest.fn(() => engine);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine });
	try {
		if (initialKind === "cached_start") expect(controller.prepareScheduledJobs([first], fixture.request)).toBe(true);
		expect(await controller.apply(first, fixture.request)).toBe(true);
		const request = { requestId: randomUUID(), sentAt: 2000 };
		now = 2500;
		const claims = { requestId: request.requestId, issuedAt: 1001000 };
		const refreshed = fixture.resignScheduledJob(fixture.job, {}, claims);
		const next = fixture.resignScheduledJob(fixture.adjacentScheduledJob(true), { id: first.id }, claims);
		expect(controller.prepareScheduledJobs([refreshed, next], request)).toBe(true);
		await controller.tick();
		expect(journal.get(next.admissionId)).toMatchObject({ state: "pending", occurrence: { start: 1020000, end: 1080000 } });
		expect(engine.updateScheduledDeadline).toHaveBeenCalledWith(81000);
		expect(createEngine).toHaveBeenCalledTimes(1);
		now = 21001;
		await controller.tick();
		expect(engine.requestDrain).not.toHaveBeenCalled();
		expect(controller.reports().filter((row) => row.state === "active")).toHaveLength(2);
		expect(journal.get(first.admissionId)?.occurrence?.end).toBe(1020000);
		now = 81000;
		await controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(first.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(journal.get(next.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-EC010 / TDD-US3-OPT088: Pause removes future authority while the first capture is still starting", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-starting-pause-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	let release!: () => void;
	const pending = new Promise<void>((resolve) => {
		release = resolve;
	});
	const engine = { start: jest.fn(() => pending), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined), updateScheduledDeadline: jest.fn().mockResolvedValue(undefined) };
	const journal = new ExecutionJournal(directory);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine: () => engine });
	let started: Promise<boolean> | undefined;
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		started = controller.apply(fixture.job, fixture.request);
		expect(journal.get(fixture.job.admissionId)?.state).toBe("starting");
		expect(controller.prepareScheduledJobs([fixture.job], fixture.request)).toBe(true);
		await controller.tick();
		expect(engine.updateScheduledDeadline).toHaveBeenCalledWith(21000);
		release();
		expect(await started).toBe(true);
		expect(journal.get(next.admissionId)?.state).toBe("pending");
	} finally {
		release();
		await started;
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-EC010 / TDD-US3-OPT046: a stalled extension cannot activate the future member or revive capture after its original end", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-stalled-extension-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 });
	const next = fixture.adjacentScheduledJob(true);
	let resolveUpdate!: () => void;
	const propagation = new Promise<void>((resolve) => {
		resolveUpdate = resolve;
	});
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined), updateScheduledDeadline: jest.fn(() => propagation) };
	let now = 1500;
	const journal = new ExecutionJournal(directory),
		createEngine = jest.fn(() => engine);
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine });
	try {
		expect(controller.prepareScheduledJobs([fixture.job], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		await controller.tick();
		expect(engine.updateScheduledDeadline).toHaveBeenCalledWith(81000);
		now = 21000;
		await controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(journal.get(next.admissionId)?.state).toBe("pending");
		resolveUpdate();
		await Promise.resolve();
		await Promise.resolve();
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(controller.reports().filter((row) => row.state === "active")).toEqual([]);
		expect(journal.get(fixture.job.admissionId)?.state).toBe("stopped");
		expect(await controller.apply(next, fixture.request)).toBe(true);
		expect(createEngine).toHaveBeenCalledTimes(2);
	} finally {
		resolveUpdate();
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each([21000, 21001])("TDD-US3-OPT088: Pause at %i preserves the adjacent window that already began before the next watchdog tick", async (boundary) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-pause-current-window-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 }),
		next = fixture.adjacentScheduledJob(true);
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined), updateScheduledDeadline: jest.fn().mockResolvedValue(undefined) };
	let now = 1500;
	const journal = new ExecutionJournal(directory),
		controller = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine: () => engine });
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		now = boundary;
		expect(controller.prepareScheduledJobs([], fixture.request)).toBe(true);
		await controller.tick();
		expect(journal.get(next.admissionId)).toMatchObject({ state: "active", occurrence: { end: 1080000 } });
		expect(engine.updateScheduledDeadline).not.toHaveBeenCalled();
		expect(engine.requestDrain).not.toHaveBeenCalled();
		now = 81000;
		await controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});
test("TDD-US3-CON011: a nonfinite clock fences capture without consuming its unstarted adjacent permission", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-invalid-continuity-clock-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 }),
		next = fixture.adjacentScheduledJob(true);
	const engine = { start: jest.fn().mockResolvedValue(undefined), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
	let now = 1500;
	const journal = new ExecutionJournal(directory),
		controller = new FreeExecutionController({ ...fixture, journal, clock: () => now, createEngine: () => engine });
	try {
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		now = NaN;
		await controller.tick();
		expect(engine.requestDrain).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true });
		expect(journal.get(next.admissionId)?.state).toBe("pending");
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["journal_failure", "renderer_failure"])("TDD-US3-EC010 / TDD-US3-OPT046: %s cannot extend or reopen a playing capture", async (fault) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-extension-failure-"));
	const { FreeExecutionController } = await import("../execution-runtime");
	const fixture = runtimeFixture({ policy: "pro_broadcast", cacheAuthorization: true, scheduledStart: 1000000, scheduledEnd: 1020000 }),
		next = fixture.adjacentScheduledJob(true);
	const engine = {
		start: jest.fn().mockResolvedValue(undefined),
		stop: jest.fn().mockResolvedValue(undefined),
		requestDrain: jest.fn().mockResolvedValue(undefined),
		updateScheduledDeadline: jest.fn().mockImplementation(async () => {
			if (fault === "renderer_failure") throw new Error("fixture renderer unavailable");
		}),
	};
	const journal = new ExecutionJournal(directory);
	let permission = () => false;
	const createEngine = jest.fn((_job, policy) => {
		permission = policy.mayOpenOutput;
		return engine;
	});
	const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine });
	try {
		expect(controller.prepareScheduledJobs([fixture.job], fixture.request)).toBe(true);
		expect(await controller.apply(fixture.job, fixture.request)).toBe(true);
		if (fault === "journal_failure") {
			const save = journal.save.bind(journal);
			jest.spyOn(journal, "save").mockImplementation((record) => {
				if (record.admissionId === next.admissionId && record.state === "pending") throw new Error("fixture pending storage unavailable");
				save(record);
			});
		}
		expect(controller.prepareScheduledJobs([fixture.job, next], fixture.request)).toBe(fault !== "journal_failure");
		await new Promise<void>((resolve) => setImmediate(resolve));
		await controller.tick();
		expect(permission()).toBe(false);
		expect(engine.stop).toHaveBeenCalledTimes(1);
		expect(engine.requestDrain).not.toHaveBeenCalled();
		expect(createEngine).toHaveBeenCalledTimes(1);
		expect(journal.get(fixture.job.admissionId)).toMatchObject({ state: "stopped", allOutputsClosed: true, occurrence: { end: 1020000 } });
		if (fault === "journal_failure") {
			expect(engine.updateScheduledDeadline).not.toHaveBeenCalled();
			expect(journal.get(next.admissionId)).toBeUndefined();
		} else {
			expect(engine.updateScheduledDeadline).toHaveBeenCalledWith(81000);
			expect(journal.get(next.admissionId)?.state).toBe("pending");
		}
	} finally {
		await controller.stopAll();
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US4-CON012: presentation refusal returns a stopped receipt instead of claiming an active broadcast", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-presentation-refused-"));
	try {
		const { FreeExecutionController } = await import("../execution-runtime");
		const fixture = runtimeFixture(),
			journal = new ExecutionJournal(directory);
		const engine = { start: jest.fn().mockResolvedValue(false), stop: jest.fn().mockResolvedValue(undefined), requestDrain: jest.fn().mockResolvedValue(undefined) };
		const controller = new FreeExecutionController({ ...fixture, journal, clock: () => 1500, createEngine: () => engine });
		expect(await controller.apply(fixture.job, fixture.request)).toBe(false);
		expect(engine.stop).toHaveBeenCalledTimes(1);
		expect(journal.pendingTerminals()).toMatchObject([{ state: "stopped", allOutputsClosed: true }]);
		expect(journal.get(fixture.job.admissionId)?.state).toBe("stopped");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
