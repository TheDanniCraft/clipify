import { executionNow } from "./execution-clock";
import { FreeExecutionLease, ProExecutionPermit, hashExecutionTargets, hashScheduledExecutionPayload, verifyExecutionBundle, type ExecutionIdentity, type LeaseRequestContext, type SignedExecutionBundle } from "./protocol";
import { ExecutionJournal, type ExecutionRecord } from "./execution-journal";
import type { RunnerOutputState } from "./output";

export type FreeExecutionJob = {
	id: string;
	ownerId: string;
	runnerId: string;
	admissionId: string;
	executionGeneration: string;
	configurationRevision: number;
	sourceRevision: number;
	targetHash: string;
	overlayId: string;
	overlaySecret: string;
	rtmpUrl: string;
	streamKey: string | null;
	mode: "24/7" | "24_7" | "failsafe";
	fps: number;
	resolution: string;
	desiredState: "running" | "stopped";
	lease: SignedExecutionBundle;
	scheduledEnd?: number | null;
	cacheAuthorization?: true;
	occurrenceId?: string;
	scheduledStart?: number;
	destinations?: { id: string; name?: string; provider?: string; rtmpUrl: string; streamKey: string | null }[];
};
export type ExecutionEngine = { updateScheduledDeadline?: (deadlineMonotonic: number) => Promise<void>; drainOutcome?: "clip_completed" | "playback_timeout" | null; start: () => Promise<void | boolean>; stop: () => Promise<void>; requestDrain: (options?: { deadlineMonotonic?: number }) => Promise<void>; outputStates?: () => { id: string; state: RunnerOutputState }[] };
type PreparedScheduledWindow = { job: FreeExecutionJob; record: ExecutionRecord; mediaHash: string; startMonotonic: number; endMonotonic: number };
type ActiveExecution = { capture: { mediaHash: string; sourceRevision: number }; deadlineUpdate?: Promise<void>; continuity?: { members: PreparedScheduledWindow[]; deadlineMonotonic: number }; guard: FreeExecutionLease | ProExecutionPermit; engine: ExecutionEngine; record: ExecutionRecord; closing?: Promise<void>; outputsClosed?: boolean; outputGate: { permitted: boolean }; closeImmediately?: boolean };
type ExecutionOptions = { ownerId: string; runnerId: string; keys: Readonly<Record<string, string>>; journal: ExecutionJournal; clock?: () => number; createEngine: (job: FreeExecutionJob, policy: { mayOpenOutput: () => boolean; scheduledDeadlineMonotonic: number | null }) => ExecutionEngine };

/** Admission identity is learned only from a fresh, nonce-bound verified response. */
export class FreeExecutionController {
	private readonly active = new Map<string, ActiveExecution>();
	private preparedSchedules = new Map<string, PreparedScheduledWindow>();
	/** Prepare only separately signed, nonce-bound windows; no future engine starts here. */
	prepareScheduledJobs(jobs: readonly FreeExecutionJob[], request: LeaseRequestContext): boolean {
		const now = (this.options.clock ?? executionNow)();
		if (!Array.isArray(jobs) || jobs.length > 1024 || !Number.isFinite(now) || !Number.isFinite(request.sentAt) || request.sentAt > now) return false;
		const prepared = new Map<string, PreparedScheduledWindow>(),
			occurrences = new Set<string>();
		for (const job of jobs) {
			const window = this.verifyScheduledWindow(job, request);
			if (!window || prepared.has(job.admissionId) || occurrences.has(job.occurrenceId!)) return false;
			prepared.set(job.admissionId, window);
			occurrences.add(job.occurrenceId!);
		}
		this.preparedSchedules = prepared;
		for (const execution of this.physicalExecutions()) {
			this.refreshContinuity(execution);
			if (execution.closing || execution.outputsClosed || !["starting", "active"].includes(execution.record.state) || this.executionState(execution) !== "active") continue;
			if (!this.refreshPreparedContinuity(execution, prepared, now)) return false;
		}
		return true;
	}
	private refreshPreparedContinuity(execution: ActiveExecution, prepared: Map<string, PreparedScheduledWindow>, now: number): boolean {
		const previous = execution.continuity;
		const retained = this.retainedScheduleMembers(execution, prepared, now);
		if (!retained?.length) return true;
		this.extendAdjacentWindows(execution, prepared, retained);
		if (!previous && retained.length === 1) return true;
		const originalDeadline = previous?.deadlineMonotonic ?? execution.guard.deadlineMonotonic!;
		const desiredDeadline = retained.at(-1)!.endMonotonic;
		try {
			for (const member of retained) if (member.record.state === "pending" && !previous?.members.some((existing) => existing.record.admissionId === member.record.admissionId)) this.options.journal.save(member.record);
		} catch {
			execution.outputGate.permitted = false;
			execution.closeImmediately = true;
			execution.record.state = "draining";
			return false;
		}
		// Shorter authority fences immediately. Longer authority waits for the
		// renderer acknowledgement and cannot revive an expired capture.
		const continuity = { members: retained, deadlineMonotonic: Math.min(originalDeadline, desiredDeadline) };
		execution.continuity = continuity;
		if (desiredDeadline !== originalDeadline && execution.engine.updateScheduledDeadline) {
			execution.deadlineUpdate = (execution.deadlineUpdate ?? Promise.resolve())
				.then(() => this.acknowledgeContinuityDeadline(execution, continuity, desiredDeadline, originalDeadline))
				.catch(() => {
					execution.outputGate.permitted = false;
					execution.closeImmediately = true;
					execution.record.state = "draining";
				});
		}
		return true;
	}
	private async acknowledgeContinuityDeadline(execution: ActiveExecution, continuity: NonNullable<ActiveExecution["continuity"]>, desiredDeadline: number, originalDeadline: number) {
		if (execution.continuity !== continuity || execution.closing || execution.outputsClosed || !["starting", "active"].includes(execution.record.state)) return;
		await execution.engine.updateScheduledDeadline!(desiredDeadline);
		if (execution.continuity !== continuity || execution.closing || execution.outputsClosed || !["starting", "active"].includes(execution.record.state)) return;
		const current = (this.options.clock ?? executionNow)();
		if (desiredDeadline > originalDeadline && (!Number.isFinite(current) || current >= originalDeadline)) {
			execution.outputGate.permitted = false;
			execution.record.state = "draining";
			return;
		}
		continuity.deadlineMonotonic = desiredDeadline;
	}
	private extendAdjacentWindows(execution: ActiveExecution, prepared: Map<string, PreparedScheduledWindow>, retained: PreparedScheduledWindow[]) {
		const anchor = retained[0];
		while (true) {
			const last = retained.at(-1)!;
			const following = Array.from(prepared.values()).filter((candidate) => candidate.job.scheduledStart === last.job.scheduledEnd && candidate.mediaHash === execution.capture.mediaHash && candidate.job.sourceRevision === execution.capture.sourceRevision && candidate.record.state === "pending" && !candidate.record.occurrence?.suppressed && !retained.some((member) => member.record.admissionId === candidate.record.admissionId));
			if (following.length !== 1) break;
			const next = following[0];
			const endMonotonic = Math.min(next.endMonotonic, anchor.endMonotonic + next.job.scheduledEnd! - anchor.job.scheduledEnd!);
			retained.push({ ...next, endMonotonic, startMonotonic: last.endMonotonic });
		}
	}
	private retainedScheduleMembers(execution: ActiveExecution, prepared: Map<string, PreparedScheduledWindow>, now: number) {
		const previous = execution.continuity;
		const retained: PreparedScheduledWindow[] = [];
		if (previous) {
			for (const member of previous.members) {
				if (member.record.state === "pending") {
					const fresh = prepared.get(member.job.admissionId);
					if (
						!fresh ||
						fresh.record.state !== "pending" ||
						fresh.record.occurrence?.suppressed ||
						fresh.job.executionGeneration !== member.job.executionGeneration ||
						fresh.job.configurationRevision !== member.job.configurationRevision ||
						fresh.record.leaseId !== member.record.leaseId ||
						fresh.mediaHash !== member.mediaHash ||
						fresh.job.sourceRevision !== member.job.sourceRevision ||
						fresh.job.scheduledStart !== member.job.scheduledStart ||
						fresh.job.scheduledEnd !== member.job.scheduledEnd ||
						retained.at(-1)?.job.scheduledEnd !== member.job.scheduledStart
					)
						break;
				}
				retained.push(member);
			}
		} else {
			const fresh = prepared.get(execution.record.admissionId);
			const originalEnd = execution.guard.deadlineMonotonic;
			if (!fresh || fresh.record.state !== "active" || fresh.record.occurrence?.suppressed || fresh.mediaHash !== execution.capture.mediaHash || fresh.job.sourceRevision !== execution.capture.sourceRevision || originalEnd === null || fresh.endMonotonic < now) return null;
			const endMonotonic = Math.min(originalEnd, fresh.endMonotonic);
			retained.push({ ...fresh, record: execution.record, endMonotonic, startMonotonic: endMonotonic - (fresh.job.scheduledEnd! - fresh.job.scheduledStart!) });
		}
		return retained;
	}
	private verifyScheduledWindow(job: FreeExecutionJob, request: LeaseRequestContext): PreparedScheduledWindow | null {
		try {
			if (!job || job.ownerId !== this.options.ownerId || job.runnerId !== this.options.runnerId || job.cacheAuthorization !== true || job.desiredState !== "running" || !["24/7", "24_7"].includes(job.mode)) return null;
			const targets = job.destinations ?? [{ id: job.id, rtmpUrl: job.rtmpUrl, streamKey: job.streamKey }];
			if (!targets.length || new Set(targets.map((target) => target.id)).size !== targets.length || hashExecutionTargets(targets) !== job.targetHash) return null;
			const raw = JSON.parse(Buffer.from(job.lease.payload, "base64url").toString("utf8"));
			const claims = verifyExecutionBundle(job.lease, this.options.keys, { ...job, sourceId: job.overlayId, sessionId: job.id, generation: job.executionGeneration, leaseId: raw.leaseId, requestId: request.requestId, executionPayloadHash: hashScheduledExecutionPayload(job) }, raw.issuedAt);
			const now = (this.options.clock ?? executionNow)();
			if (!claims || claims.policy !== "pro_broadcast" || !Number.isFinite(now) || !Number.isFinite(request.sentAt) || request.sentAt > now || now >= request.sentAt + claims.expiresAt - claims.issuedAt) return null;
			const existing = this.options.journal.get(job.admissionId);
			if (existing && (existing.executionGeneration !== job.executionGeneration || existing.leaseId !== claims.leaseId || existing.configurationRevision !== job.configurationRevision || !existing.occurrence || existing.occurrence.occurrenceId !== job.occurrenceId || existing.occurrence.end !== job.scheduledEnd || existing.occurrence.start !== job.scheduledStart)) return null;
			const record: ExecutionRecord = existing ?? { ownerId: job.ownerId, runnerId: job.runnerId, sessionId: job.id, admissionId: job.admissionId, executionGeneration: job.executionGeneration, leaseId: claims.leaseId!, configurationRevision: job.configurationRevision, state: "pending", updatedAt: Date.now(), occurrence: { occurrenceId: job.occurrenceId!, start: job.scheduledStart!, end: job.scheduledEnd! } };
			if (record.occurrence && this.options.journal.isOccurrenceSuppressed({ ownerId: job.ownerId, runnerId: job.runnerId, occurrenceId: job.occurrenceId! })) record.occurrence = { ...record.occurrence, suppressed: true };
			return { job: structuredClone(job), record, mediaHash: hashScheduledExecutionPayload(job), startMonotonic: request.sentAt + job.scheduledStart! - claims.issuedAt, endMonotonic: request.sentAt + job.scheduledEnd! - claims.issuedAt };
		} catch {
			return null;
		}
	}
	private scheduledContinuity(job: FreeExecutionJob): ActiveExecution["continuity"] {
		const first = this.preparedSchedules.get(job.admissionId);
		if (!first || first.job.lease.payload !== job.lease.payload || first.job.executionGeneration !== job.executionGeneration) return undefined;
		const members = [first];
		while (true) {
			const previous = members.at(-1)!;
			const following = Array.from(this.preparedSchedules.values()).filter((candidate) => candidate.job.scheduledStart === previous.job.scheduledEnd && candidate.mediaHash === first.mediaHash && candidate.job.sourceRevision === first.job.sourceRevision && !members.includes(candidate) && !candidate.record.occurrence?.suppressed && candidate.record.state === "pending");
			if (following.length !== 1) break;
			members.push(following[0]);
		}
		return members.length > 1 ? { members, deadlineMonotonic: members.at(-1)!.endMonotonic } : undefined;
	}
	private executionState(execution: ActiveExecution) {
		if (!execution.continuity) return execution.guard.state;
		if (execution.record.state === "draining" || execution.record.state === "stopped") return "draining";
		const now = (this.options.clock ?? executionNow)();
		return Number.isFinite(now) && now >= execution.continuity.members[0].startMonotonic && now < execution.continuity.deadlineMonotonic ? "active" : "draining";
	}
	private refreshContinuity(execution: ActiveExecution): void {
		if (!execution.continuity || execution.record.state !== "active") return;
		const now = (this.options.clock ?? executionNow)();
		if (!Number.isFinite(now)) return;
		for (const member of execution.continuity.members) {
			if (member.record.state !== "pending" || now < member.startMonotonic || member.startMonotonic >= execution.continuity.deadlineMonotonic) continue;
			const active: ExecutionRecord = { ...member.record, state: "active", updatedAt: Date.now() };
			try {
				this.options.journal.save(active);
			} catch {
				execution.outputGate.permitted = false;
				execution.record = { ...execution.record, state: "draining" };
				return;
			}
			member.record = active;
			this.active.set(member.record.sessionId, execution);
		}
	}
	private physicalExecutions() {
		return Array.from(new Set(this.active.values()));
	}
	constructor(private readonly options: ExecutionOptions) {}
	async stopAll(): Promise<void> {
		await Promise.all(this.physicalExecutions().map((execution) => this.closeExecution(execution)));
	}
	async stop(command: Pick<FreeExecutionJob, "id" | "ownerId" | "runnerId" | "admissionId" | "executionGeneration" | "configurationRevision">, immediate = false): Promise<boolean> {
		const execution = this.active.get(command.id);
		if (!execution) return false;
		this.refreshContinuity(execution);
		const member = execution.continuity?.members.find((entry) => entry.record.admissionId === command.admissionId);
		const bound = member?.record ?? execution.record;
		const current = execution.continuity?.members.filter((entry) => entry.record.state !== "pending").at(-1);
		if (command.ownerId !== this.options.ownerId || command.runnerId !== this.options.runnerId || command.id !== bound.sessionId || command.admissionId !== bound.admissionId || command.executionGeneration !== bound.executionGeneration || command.configurationRevision !== bound.configurationRevision || (current && current.record.admissionId !== bound.admissionId)) return false;
		if (bound.occurrence) {
			try {
				this.options.journal.suppressOccurrence({ ownerId: bound.ownerId, runnerId: bound.runnerId, occurrenceId: bound.occurrence.occurrenceId });
			} catch {
				console.warn("[Runner] Cannot persist occurrence Stop intent; closing outputs before retrying storage.");
			}
			if (member) member.record = { ...bound, occurrence: { ...bound.occurrence, suppressed: true } };
			if (bound.admissionId === execution.record.admissionId) execution.record = { ...execution.record, occurrence: { ...bound.occurrence, suppressed: true } };
		}
		if (immediate && execution.closing && !execution.outputsClosed) await execution.engine.stop();
		await this.closeExecution(execution, immediate);
		return true;
	}
	reports() {
		for (const execution of this.physicalExecutions()) this.refreshContinuity(execution);
		const identity = (entry: ExecutionRecord) => ({ admissionId: entry.admissionId, sessionId: entry.sessionId, executionGeneration: entry.executionGeneration, leaseId: entry.leaseId, configurationRevision: entry.configurationRevision });
		return [
			...this.physicalExecutions().flatMap((entry) => {
				const records = entry.continuity ? entry.continuity.members.map((member) => member.record).filter((record) => record.state !== "pending") : [entry.record];
				return records
					.filter((record) => record.state === "draining" || (record.state === "active" && this.executionState(entry) === "active"))
					.map((record) => {
						if (record.state === "draining") return { ...identity(record), state: "draining" as const };
						const outputs = entry.engine.outputStates?.().map(({ id, state }) => ({ id, state }));
						return { ...identity(record), state: "active" as const, ...(outputs?.length ? { outputs } : {}) };
					});
			}),
			...this.options.journal
				.pendingTerminals()
				.filter((entry) => entry.ownerId === this.options.ownerId && entry.runnerId === this.options.runnerId)
				.map((entry) => ({ ...identity(entry), state: "stopped" as const, allOutputsClosed: true as const, ...(entry.playbackOutcome ? { playbackOutcome: entry.playbackOutcome } : {}) })),
		];
	}
	confirm(receipts: readonly { admissionId: string; executionGeneration: string; state: string }[]): void {
		for (const receipt of receipts) {
			if (receipt.state !== "stopped") continue;
			const entry = this.options.journal.get(receipt.admissionId);
			if (entry?.ownerId !== this.options.ownerId || entry.runnerId !== this.options.runnerId) continue;
			this.options.journal.acknowledge(receipt.admissionId, receipt.executionGeneration);
		}
	}
	async tick(): Promise<void> {
		const closing: Promise<void>[] = [];
		for (const execution of this.physicalExecutions()) {
			// Browser control delivery cannot delay the independent native output fence.
			this.refreshContinuity(execution);
			if (this.executionState(execution) === "draining" || execution.record.state === "draining") closing.push(this.closeExecution(execution));
		}
		await Promise.all(closing);
	}
	private closeExecution(execution: ActiveExecution, immediate = false): Promise<void> {
		if (immediate) execution.closeImmediately = true;
		if (execution.closing) return execution.closing;
		execution.outputGate.permitted = false;
		this.refreshContinuity(execution);
		const participants = execution.continuity?.members.filter((member) => member.record.state !== "pending");
		if (!execution.outputsClosed) {
			const draining: ExecutionRecord = { ...execution.record, state: "draining", updatedAt: Date.now() };
			execution.record = draining;
			try {
				this.options.journal.save(draining);
				for (const member of participants ?? []) {
					member.record = { ...member.record, state: "draining", updatedAt: Date.now() };
					this.options.journal.save(member.record);
				}
			} catch {
				console.warn("[Runner] Cannot persist drain intent; closing outputs before persisting terminal receipt.");
			}
		}
		execution.closing = (async () => {
			if (!execution.outputsClosed) {
				await (execution.closeImmediately ? execution.engine.stop() : execution.engine.requestDrain({ deadlineMonotonic: (execution.continuity?.deadlineMonotonic ?? execution.guard.deadlineMonotonic ?? this.options.clock?.() ?? executionNow()) + 300000 }));
				execution.outputsClosed = true;
			}
			if (execution.record.occurrence?.suppressed) {
				this.options.journal.suppressOccurrence({ ownerId: execution.record.ownerId, runnerId: execution.record.runnerId, occurrenceId: execution.record.occurrence.occurrenceId });
			}
			const persistTerminal = (record: ExecutionRecord): ExecutionRecord => {
				const persisted = this.options.journal.get(record.admissionId);
				if (persisted?.state === "stopped") return persisted;
				const stopped: ExecutionRecord = { ...record, ...(execution.engine.drainOutcome ? { playbackOutcome: execution.engine.drainOutcome } : {}), state: "stopped", allOutputsClosed: true, updatedAt: Date.now() };
				this.options.journal.save(stopped);
				return stopped;
			};
			execution.record = persistTerminal(execution.record);
			for (const member of participants ?? []) {
				if (member.record.occurrence?.suppressed) this.options.journal.suppressOccurrence({ ownerId: member.record.ownerId, runnerId: member.record.runnerId, occurrenceId: member.record.occurrence.occurrenceId });
				member.record = persistTerminal(member.record);
			}
			for (const [sessionId, owned] of this.active) if (owned === execution) this.active.delete(sessionId);
		})().catch((error) => {
			execution.closing = undefined;
			throw error;
		});
		return execution.closing;
	}

	private startingExecutionRecord(job: FreeExecutionJob, persisted: ExecutionRecord | undefined, leaseId: string): ExecutionRecord {
		const occurrence = job.occurrenceId !== undefined && job.scheduledStart !== undefined && job.scheduledEnd != null ? { ...persisted?.occurrence, occurrenceId: job.occurrenceId, start: job.scheduledStart, end: job.scheduledEnd, ...(job.cacheAuthorization !== true ? { explicitResume: true as const } : {}) } : persisted?.occurrence;
		return { ownerId: job.ownerId, runnerId: job.runnerId, sessionId: job.id, admissionId: job.admissionId, executionGeneration: job.executionGeneration, leaseId, configurationRevision: job.configurationRevision, state: "starting", updatedAt: Date.now(), ...(occurrence ? { occurrence } : {}) };
	}
	private executionPolicy(job: FreeExecutionJob, targetCount: number) {
		let leaseId: string;
		let policy: string;
		try {
			const untrusted = JSON.parse(Buffer.from(job.lease.payload, "base64url").toString("utf8"));
			leaseId = untrusted.leaseId;
			policy = untrusted.policy;
		} catch {
			return null;
		}
		if (policy !== "free_lease" && policy !== "pro_broadcast") return null;
		if (policy === "free_lease" && targetCount > 1) return null;
		if (job.cacheAuthorization === true && (policy !== "pro_broadcast" || !["24/7", "24_7"].includes(job.mode) || typeof job.overlaySecret !== "string")) return null;
		return { leaseId, policy };
	}
	private persistedExecutionBlocks(job: FreeExecutionJob, persisted: ExecutionRecord | undefined) {
		if (persisted && (persisted.state === "draining" || persisted.state === "stopped" || persisted.occurrence?.suppressed === true)) return true;
		if (persisted?.occurrence && job.scheduledEnd !== persisted.occurrence.end) return true;
		return false;
	}
	private occurrenceAllowsCommand(job: FreeExecutionJob, persisted: ExecutionRecord | undefined) {
		if (job.occurrenceId) {
			const control = this.options.journal.occurrenceControl({ ownerId: job.ownerId, runnerId: job.runnerId, occurrenceId: job.occurrenceId });
			if (job.configurationRevision < control.revision || (job.cacheAuthorization !== true && control.revision > 0 && job.configurationRevision === control.revision && persisted?.occurrence?.explicitResume !== true)) return false;
		}
		return true;
	}
	private async startExecution(job: FreeExecutionJob, persisted: ExecutionRecord | undefined, leaseId: string, policy: string, guard: FreeExecutionLease | ProExecutionPermit): Promise<boolean> {
		const record = this.startingExecutionRecord(job, persisted, leaseId);
		this.options.journal.save(record);
		const outputGate = { permitted: true };
		const continuity = job.cacheAuthorization === true ? this.scheduledContinuity(job) : undefined;
		if (continuity) {
			continuity.members[0].record = record;
			for (const member of continuity.members.slice(1)) this.options.journal.save(member.record);
		}
		const captured: { execution?: ActiveExecution } = {};
		const engine = this.options.createEngine(job, { mayOpenOutput: () => outputGate.permitted && (captured.execution ? this.executionState(captured.execution) : guard.state) === "active", scheduledDeadlineMonotonic: policy === "pro_broadcast" ? (continuity?.deadlineMonotonic ?? guard.deadlineMonotonic) : null });
		const execution: ActiveExecution = { capture: { mediaHash: hashScheduledExecutionPayload(job), sourceRevision: job.sourceRevision }, guard, engine, record, outputGate, ...(continuity ? { continuity } : {}) };
		captured.execution = execution;
		this.active.set(job.id, execution);
		try {
			if ((await engine.start()) === false) {
				await this.closeExecution(execution, true);
				return false;
			}
		} catch {
			await this.closeExecution(execution, true);
			return false;
		}
		if (this.active.get(job.id) !== execution || execution.record.state !== "starting") return false;
		if (this.executionState(execution) !== "active") {
			await this.closeExecution(execution);
			return false;
		}
		const active: ExecutionRecord = { ...record, state: "active", updatedAt: Date.now() };
		try {
			this.options.journal.save(active);
		} catch {
			await this.closeExecution(execution, true);
			return false;
		}
		execution.record = active;
		if (execution.continuity) execution.continuity.members[0].record = active;
		this.refreshContinuity(execution);
		return true;
	}
	private acceptsContinuityJob(existing: ActiveExecution, job: FreeExecutionJob, request: LeaseRequestContext) {
		this.refreshContinuity(existing);
		const member = existing.continuity!.members.find((entry) => entry.record.admissionId === job.admissionId);
		const verified = member ? this.verifyScheduledWindow(job, request) : null;
		return !!member && !!verified && member.record.state === "active" && member.mediaHash === verified.mediaHash && member.record.executionGeneration === job.executionGeneration && member.record.configurationRevision === job.configurationRevision && member.record.occurrence?.end === job.scheduledEnd && this.executionState(existing) === "active";
	}
	private prepareExecutionIdentity(job: FreeExecutionJob) {
		if (job.desiredState !== "running" || job.ownerId !== this.options.ownerId || job.runnerId !== this.options.runnerId) return null;
		if (job.cacheAuthorization === true && job.occurrenceId && this.options.journal.isOccurrenceSuppressed({ ownerId: job.ownerId, runnerId: job.runnerId, occurrenceId: job.occurrenceId })) return null;
		const persisted = this.options.journal.get(job.admissionId);
		if (this.persistedExecutionBlocks(job, persisted)) return null;
		const targets = job.destinations ?? [{ id: job.id, rtmpUrl: job.rtmpUrl, streamKey: job.streamKey }];
		if (!targets.length || new Set(targets.map((target) => target.id)).size !== targets.length) return null;
		const targetHash = hashExecutionTargets(targets);
		if (targetHash !== job.targetHash) return null;
		const policyBinding = this.executionPolicy(job, targets.length);
		if (!policyBinding) return null;
		const { leaseId, policy } = policyBinding;
		return { persisted, targetHash, leaseId, policy };
	}
	private cachedExecutionIdentity(job: FreeExecutionJob) {
		return { ...(job.occurrenceId !== undefined || job.scheduledStart !== undefined ? { occurrenceId: job.occurrenceId, scheduledStart: job.scheduledStart } : {}), ...(job.cacheAuthorization === true ? { cacheAuthorization: true as const, executionPayloadHash: hashScheduledExecutionPayload(job) } : {}) };
	}
	private createExecutionGuard(job: FreeExecutionJob, cachedIdentity: Pick<ExecutionIdentity, "occurrenceId" | "scheduledStart" | "cacheAuthorization" | "executionPayloadHash">, targetHash: string, leaseId: string, policy: string) {
		return new (policy === "pro_broadcast" ? ProExecutionPermit : FreeExecutionLease)({ ...cachedIdentity, ownerId: job.ownerId, runnerId: job.runnerId, sessionId: job.id, generation: job.executionGeneration, targetHash, sourceId: job.overlayId, configurationRevision: job.configurationRevision, sourceRevision: job.sourceRevision, admissionId: job.admissionId, leaseId, ...(job.scheduledEnd === undefined ? {} : { scheduledEnd: job.scheduledEnd }) }, this.options.keys, this.options.clock);
	}
	async apply(job: FreeExecutionJob, request: LeaseRequestContext): Promise<boolean> {
		const identity = this.prepareExecutionIdentity(job);
		if (!identity) return false;
		const { persisted, targetHash, leaseId, policy } = identity;
		const cachedIdentity = this.cachedExecutionIdentity(job);
		const existing = this.active.get(job.id);
		if (existing?.continuity) return this.acceptsContinuityJob(existing, job, request);
		if (existing && existing.record.executionGeneration !== job.executionGeneration) return false;
		const guard = existing?.guard ?? this.createExecutionGuard(job, cachedIdentity, targetHash, leaseId, policy);
		if (!guard.beginRenewal(request) || !guard.accept(job.lease)) return false;
		if (!this.occurrenceAllowsCommand(job, persisted)) return false;

		// Adjacent cached windows share one physical schedule lane on this Runner.
		// A following authorization cannot replace a clip that is still finishing;
		// the watchdog retries it after durable closure, while its window is active.
		if (!existing && job.cacheAuthorization === true && Array.from(this.active.values()).some((execution) => execution.record.occurrence !== undefined)) return false;
		if (existing) return true;
		return this.startExecution(job, persisted, leaseId, policy, guard);
	}
}
