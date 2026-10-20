import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, fsyncSync, closeSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type ExecutionRecord = { admissionId: string; ownerId: string; runnerId: string; sessionId: string; executionGeneration: string; leaseId: string; configurationRevision: number; state: "pending" | "starting" | "active" | "draining" | "stopped"; playbackOutcome?: "clip_completed" | "playback_timeout"; allOutputsClosed?: true; acknowledged?: boolean; updatedAt: number; occurrence?: { occurrenceId: string; start: number; end: number; suppressed?: boolean; explicitResume?: true } };
const maximumSnapshotBytes = 2 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validOwnerIdentity(ownerId: string) {
	return typeof ownerId === "string" && ownerId.length > 0 && ownerId.length <= 256;
}
function validJournalTime(value: number) {
	return Number.isSafeInteger(value) && value >= 0;
}
function validateRecordIdentity(input: ExecutionRecord) {
	for (const key of ["admissionId", "runnerId", "sessionId", "executionGeneration", "leaseId"] as const) {
		if (typeof input[key] !== "string" || !uuid.test(input[key])) throw new Error("Execution journal identity invalid");
	}
	if (!validOwnerIdentity(input.ownerId) || !Number.isSafeInteger(input.configurationRevision) || input.configurationRevision < 1 || !validJournalTime(input.updatedAt) || !["pending", "starting", "active", "draining", "stopped"].includes(input.state)) throw new Error("Execution journal record invalid");
}
function validateRecordState(input: ExecutionRecord) {
	if (input.playbackOutcome !== undefined && !["clip_completed", "playback_timeout"].includes(input.playbackOutcome)) throw new Error("Execution journal playback outcome invalid");
	if (input.state === "pending" && (!input.occurrence || input.allOutputsClosed !== undefined || input.acknowledged !== undefined)) throw new Error("Pending schedule journal record invalid");
	if (input.state === "stopped" && input.allOutputsClosed !== true) throw new Error("Execution journal requires closed output proof");
}
function validateOccurrenceWindow(occurrence: NonNullable<ExecutionRecord["occurrence"]>) {
	if (typeof occurrence.occurrenceId !== "string" || !occurrence.occurrenceId || occurrence.occurrenceId.length > 1024 || !validJournalTime(occurrence.start) || !Number.isSafeInteger(occurrence.end) || occurrence.end <= occurrence.start) throw new Error("Execution journal occurrence invalid");
}
function sanitizeOccurrence(occurrence: NonNullable<ExecutionRecord["occurrence"]>) {
	if (!occurrence || typeof occurrence !== "object" || Array.isArray(occurrence)) throw new Error("Execution journal occurrence invalid");
	validateOccurrenceWindow(occurrence);
	if ((occurrence.suppressed !== undefined && typeof occurrence.suppressed !== "boolean") || (occurrence.explicitResume !== undefined && occurrence.explicitResume !== true)) throw new Error("Execution journal occurrence invalid");
	return { occurrenceId: occurrence.occurrenceId, start: occurrence.start, end: occurrence.end, ...(occurrence.suppressed !== undefined ? { suppressed: occurrence.suppressed } : {}), ...(occurrence.explicitResume === true ? { explicitResume: true } : {}) };
}
function record(value: unknown): ExecutionRecord {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Execution journal record invalid");
	const input = value as ExecutionRecord;
	validateRecordIdentity(input);
	validateRecordState(input);
	const occurrence = input.occurrence !== undefined ? sanitizeOccurrence(input.occurrence) : undefined;
	// Credentials, URLs, signed bundles and unrelated fields never enter the journal.
	return JSON.parse(
		JSON.stringify({
			admissionId: input.admissionId,
			ownerId: input.ownerId,
			runnerId: input.runnerId,
			sessionId: input.sessionId,
			executionGeneration: input.executionGeneration,
			leaseId: input.leaseId,
			configurationRevision: input.configurationRevision,
			state: input.state,
			...(input.playbackOutcome ? { playbackOutcome: input.playbackOutcome } : {}),
			allOutputsClosed: input.allOutputsClosed === true ? true : undefined,
			acknowledged: input.acknowledged === true ? true : undefined,
			updatedAt: input.updatedAt,
			...(occurrence ? { occurrence } : {}),
		}),
	) as ExecutionRecord;
}

/** Atomic local identity/terminal state. A restarted process still needs a fresh signed lease. */
export class ExecutionJournal {
	private readonly path: string;
	private entries: ExecutionRecord[] = [];
	constructor(directory: string) {
		mkdirSync(directory, { recursive: true, mode: 0o700 });
		this.path = join(directory, "execution-journal.json");
		if (existsSync(this.path)) {
			try {
				if (statSync(this.path).size > maximumSnapshotBytes) throw new Error("Execution journal is too large");
				const snapshot = JSON.parse(readFileSync(this.path, "utf8")) as { version?: unknown; executions?: unknown };
				if (snapshot.version !== 1 || !Array.isArray(snapshot.executions)) throw new Error("Execution journal snapshot invalid");
				this.entries = snapshot.executions.map(record);
			} catch {
				throw new Error("Execution journal snapshot invalid");
			}
		}
	}
	save(value: ExecutionRecord) {
		const next = record(value);
		const previous = this.entries.find((entry) => entry.admissionId === next.admissionId);
		if (previous && (["ownerId", "runnerId", "sessionId", "executionGeneration", "leaseId", "configurationRevision"] as const).some((key) => previous[key] !== next[key])) throw new Error("Execution journal identity changed");
		if (previous) {
			const before = previous.occurrence,
				after = next.occurrence;
			if (Boolean(before) !== Boolean(after) || (before && after && (before.occurrenceId !== after.occurrenceId || before.start !== after.start || before.end !== after.end || (before.suppressed === true && after.suppressed !== true) || before.explicitResume !== after.explicitResume))) throw new Error("Execution journal identity changed");
		}
		if (previous?.state === "stopped" && next.state !== "stopped") throw new Error("Execution journal transition invalid");
		if (previous?.state === "draining" && next.state !== "draining" && next.state !== "stopped") throw new Error("Execution journal transition invalid");
		const entries = this.entries.filter((entry) => entry.admissionId !== next.admissionId).concat(next);
		this.commit(entries);
	}
	private commit(entries: ExecutionRecord[]) {
		const snapshot = JSON.stringify({ version: 1, executions: entries });
		if (Buffer.byteLength(snapshot, "utf8") > maximumSnapshotBytes) throw new Error("Execution journal is too large");
		const temporary = this.path + "." + randomUUID() + ".tmp";
		try {
			const handle = openSync(temporary, "wx", 0o600);
			try {
				writeFileSync(handle, snapshot);
				fsyncSync(handle);
			} finally {
				closeSync(handle);
			}
			renameSync(temporary, this.path);
			this.entries = entries;
		} finally {
			rmSync(temporary, { force: true });
		}
	}
	/** The newest explicit owner command wins; cached media revisions cannot clear Stop. */
	occurrenceControl(identity: { ownerId: string; runnerId: string; occurrenceId: string }) {
		const entries = this.entries.filter((entry) => entry.ownerId === identity.ownerId && entry.runnerId === identity.runnerId && entry.occurrence?.occurrenceId === identity.occurrenceId);
		const stoppedRevision = Math.max(0, ...entries.filter((entry) => entry.occurrence?.suppressed === true).map((entry) => entry.configurationRevision));
		const resumedRevision = Math.max(0, ...entries.filter((entry) => entry.occurrence?.explicitResume === true).map((entry) => entry.configurationRevision));
		return { revision: Math.max(stoppedRevision, resumedRevision), suppressed: stoppedRevision > 0 && stoppedRevision >= resumedRevision };
	}
	isOccurrenceSuppressed(identity: { ownerId: string; runnerId: string; occurrenceId: string }) {
		return this.occurrenceControl(identity).suppressed;
	}

	/** Preserve Stop intent across all already-known authorizations of one logical occurrence. */
	suppressOccurrence(identity: { ownerId: string; runnerId: string; occurrenceId: string }) {
		let changed = false;
		const entries = this.entries.map((entry) => {
			if (entry.ownerId !== identity.ownerId || entry.runnerId !== identity.runnerId || entry.occurrence?.occurrenceId !== identity.occurrenceId || entry.occurrence.suppressed === true) return entry;
			changed = true;
			return record({ ...entry, occurrence: { ...entry.occurrence, suppressed: true } });
		});
		if (changed) this.commit(entries);
		return changed;
	}

	/** Only acknowledged terminal records can age out; an active admission never does. */
	closeUnusedOccurrences(identity: { ownerId: string; runnerId: string }, trustedServerTime: number) {
		if (!Number.isFinite(trustedServerTime) || trustedServerTime < 0) throw new Error("Schedule reconciliation time invalid");
		let changed = false;
		const entries = this.entries.map((entry) => {
			if (entry.ownerId !== identity.ownerId || entry.runnerId !== identity.runnerId || entry.state !== "pending" || !entry.occurrence || (!entry.occurrence.suppressed && entry.occurrence.end > trustedServerTime)) return entry;
			changed = true;
			return record({ ...entry, state: "stopped", allOutputsClosed: true, updatedAt: Math.floor(trustedServerTime) });
		});
		if (changed) this.commit(entries);
	}

	/** Only acknowledged terminal records can age out; an active admission never does. */
	prune(now: number) {
		if (!Number.isSafeInteger(now) || now < 0) throw new Error("Execution journal cleanup time invalid");
		const cutoff = now - 604800000;
		const retained = this.entries.filter((entry) => entry.state !== "stopped" || !entry.acknowledged || Math.max(entry.updatedAt, entry.occurrence?.end ?? 0) >= cutoff);
		if (retained.length !== this.entries.length) this.commit(retained);
	}

	get(admissionId: string) {
		const entry = this.entries.find((value) => value.admissionId === admissionId);
		return entry ? structuredClone(entry) : undefined;
	}
	acknowledge(admissionId: string, executionGeneration: string) {
		const entry = this.entries.find((value) => value.admissionId === admissionId && value.executionGeneration === executionGeneration && value.state === "stopped" && value.allOutputsClosed === true);
		if (!entry) return false;
		if (!entry.acknowledged) this.save({ ...entry, acknowledged: true });
		return true;
	}
	interrupted() {
		return this.entries.filter((entry) => ["starting", "active", "draining"].includes(entry.state)).map((entry) => structuredClone(entry));
	}
	pendingTerminals() {
		return this.entries.filter((entry) => entry.state === "stopped" && entry.allOutputsClosed === true && !entry.acknowledged).map((entry) => structuredClone(entry));
	}
}
