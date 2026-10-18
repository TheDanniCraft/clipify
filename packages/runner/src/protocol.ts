import { executionNow } from "./execution-clock";
import { verify, randomUUID, createHash } from "node:crypto";

export type LeaseRequestContext = { requestId: string; sentAt: number };

export type FreeLeaseBinding = { admissionId: string; leaseId: string; requestId: string };

export type ExecutionIdentity = Partial<FreeLeaseBinding> & {
	ownerId: string;
	runnerId: string;
	sessionId: string;
	generation: string;
	targetHash: string;
	configurationRevision: number;
	sourceRevision: number;
	sourceId?: string;
	scheduledEnd?: number | null;
	cacheAuthorization?: true;
	occurrenceId?: string;
	scheduledStart?: number;
	executionPayloadHash?: string;
};
export type ExecutionClaims = ExecutionIdentity & {
	issuer: "clipify.us";
	kind: "execution" | "scheduled_execution";
	policy?: "free_lease" | "pro_broadcast";
	issuedAt: number;
	expiresAt: number;
};
export type SignedExecutionBundle = { keyId: string; payload: string; signature: string };

/** All signed protocol documents use the same exact-byte/key checks. */
function readSignedClaims(bundle: unknown, trustedKeys: Readonly<Record<string, string>>) {
	if (!bundle || typeof bundle !== "object") return null;
	const { keyId, payload, signature } = bundle as SignedExecutionBundle;
	if (typeof keyId !== "string" || typeof payload !== "string" || typeof signature !== "string" || !Object.hasOwn(trustedKeys, keyId)) return null;
	if (payload.length > 65536 || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]{86}$/.test(signature)) return null;
	if (Buffer.from(payload, "base64url").toString("base64url") !== payload || Buffer.from(signature, "base64url").toString("base64url") !== signature) return null;
	if (!verify(null, Buffer.from(payload), trustedKeys[keyId], Buffer.from(signature, "base64url"))) return null;
	return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

function boundedIdentity(value: unknown, limit = 256): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= limit;
}
function uuidIdentity(value: unknown): value is string {
	return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function digestIdentity(value: unknown): value is string {
	return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function validExecutionWindow(claims: Pick<ExecutionClaims, "issuedAt" | "expiresAt">, now: number) {
	return Number.isSafeInteger(now) && Number.isSafeInteger(claims.issuedAt) && Number.isSafeInteger(claims.expiresAt) && claims.issuedAt <= now && claims.expiresAt > now && claims.expiresAt > claims.issuedAt;
}
function matchesExecutionIdentity(claims: ExecutionClaims, expected: ExecutionIdentity) {
	for (const field of ["ownerId", "runnerId", "sessionId", "generation", "targetHash"] as const) if (!boundedIdentity(claims[field])) return false;
	for (const field of ["configurationRevision", "sourceRevision"] as const) if (!Number.isSafeInteger(claims[field]) || claims[field] < 1) return false;
	return (["ownerId", "runnerId", "sessionId", "generation", "targetHash", "configurationRevision", "sourceRevision"] as const).every((field) => claims[field] === expected[field]);
}
function matchesExecutionPolicy(claims: ExecutionClaims, expected: ExecutionIdentity) {
	const hasLeaseBinding = (["admissionId", "leaseId", "requestId"] as const).some((field) => expected[field] !== undefined);
	if (hasLeaseBinding && claims.policy !== "free_lease" && claims.policy !== "pro_broadcast") return false;
	if (expected.sourceId !== undefined && claims.sourceId !== expected.sourceId) return false;
	if (expected.scheduledEnd !== undefined && claims.scheduledEnd !== expected.scheduledEnd) return false;
	return claims.scheduledEnd == null || (claims.policy === "pro_broadcast" && Number.isSafeInteger(claims.scheduledEnd) && claims.scheduledEnd > claims.issuedAt);
}
function matchesOccurrenceIdentity(claims: ExecutionClaims, expected: ExecutionIdentity) {
	return claims.policy === "pro_broadcast" && boundedIdentity(claims.occurrenceId, 1024) && claims.occurrenceId === expected.occurrenceId;
}
function matchesOccurrenceWindow(claims: ExecutionClaims, expected: ExecutionIdentity) {
	return Number.isSafeInteger(claims.scheduledStart) && Number(claims.scheduledStart) >= 0 && claims.scheduledStart === expected.scheduledStart && claims.scheduledEnd != null && Number(claims.scheduledStart) < claims.scheduledEnd;
}
function matchesOptionalOccurrence(claims: ExecutionClaims, expected: ExecutionIdentity) {
	const present = claims.occurrenceId !== undefined || expected.occurrenceId !== undefined || claims.scheduledStart !== undefined || expected.scheduledStart !== undefined;
	return !present || (matchesOccurrenceIdentity(claims, expected) && matchesOccurrenceWindow(claims, expected));
}
function matchesCacheAuthorization(claims: ExecutionClaims, expected: ExecutionIdentity) {
	if (expected.cacheAuthorization !== true) return claims.cacheAuthorization === undefined;
	return claims.cacheAuthorization === true && matchesOccurrenceIdentity(claims, expected) && matchesOccurrenceWindow(claims, expected) && Number(claims.scheduledStart) < claims.expiresAt && digestIdentity(claims.executionPayloadHash) && claims.executionPayloadHash === expected.executionPayloadHash;
}
function matchesLeaseBinding(claims: ExecutionClaims, expected: ExecutionIdentity) {
	if (claims.policy !== "free_lease" && claims.policy !== "pro_broadcast") return true;
	if (claims.expiresAt - claims.issuedAt > (expected.cacheAuthorization === true ? 604800000 : 300000)) return false;
	return (["admissionId", "leaseId", "requestId", "sourceId"] as const).every((field) => uuidIdentity(claims[field]) && claims[field] === expected[field]);
}
function executionClaimsHeader(claims: ExecutionClaims, expected: ExecutionIdentity) {
	return !!claims && typeof claims === "object" && !Array.isArray(claims) && claims.issuer === "clipify.us" && claims.kind === (expected.cacheAuthorization === true ? "scheduled_execution" : "execution");
}

/** Verify exact serialized bytes, identity, temporal bounds and captured policy independently. */
export function verifyExecutionBundle(bundle: unknown, trustedKeys: Readonly<Record<string, string>>, expected: ExecutionIdentity, now = Date.now()): ExecutionClaims | null {
	try {
		const claims = readSignedClaims(bundle, trustedKeys) as ExecutionClaims;
		if (!executionClaimsHeader(claims, expected) || !validExecutionWindow(claims, now) || !matchesExecutionIdentity(claims, expected) || !matchesExecutionPolicy(claims, expected) || !matchesOptionalOccurrence(claims, expected) || !matchesCacheAuthorization(claims, expected) || !matchesLeaseBinding(claims, expected)) return null;
		return claims;
	} catch {
		return null;
	}
}

export type RunnerBenefitSnapshotIdentity = { ownerId: string; runnerId: string; requestId: string; configurationRevision?: number };
export type RunnerBenefitPolicy = { basicAccess: true; runnerPro: boolean; maxRegisteredDevices: null; maxActiveBroadcasts: number | null; maxTargets: number | null; scheduling: boolean; customStandby: boolean; attributionRequired: boolean; monthlyUsageLimit: null; validUntil: string | null; source: string; evaluatedAt: string; capabilityRevision: string };
export type RunnerBenefitSnapshotClaims = RunnerBenefitSnapshotIdentity & { configurationRevision: number; issuer: "clipify.us"; kind: "benefits"; issuedAt: number; expiresAt: number; capabilities: RunnerBenefitPolicy };

function matchesBenefitIdentity(claims: RunnerBenefitSnapshotClaims, expected: RunnerBenefitSnapshotIdentity) {
	if (!boundedIdentity(claims.ownerId) || claims.ownerId !== expected.ownerId) return false;
	for (const field of ["runnerId", "requestId"] as const) if (!uuidIdentity(claims[field]) || claims[field] !== expected[field]) return false;
	return Number.isSafeInteger(claims.configurationRevision) && claims.configurationRevision >= 1 && (expected.configurationRevision === undefined || claims.configurationRevision === expected.configurationRevision);
}
function matchesBenefitEntitlements(policy: Record<string, unknown>) {
	const paid = policy.runnerPro;
	const required = { basicAccess: true, maxRegisteredDevices: null, maxActiveBroadcasts: paid ? null : 1, maxTargets: paid ? null : 1, scheduling: paid, customStandby: paid, attributionRequired: !paid, monthlyUsageLimit: null };
	return Object.entries(required).every(([field, value]) => policy[field] === value);
}
function validBenefitEvaluation(policy: Record<string, unknown>, issuedAt: number) {
	return digestIdentity(policy.capabilityRevision) && typeof policy.evaluatedAt === "string" && Date.parse(policy.evaluatedAt) === issuedAt;
}
function validBenefitSource(policy: Record<string, unknown>) {
	return typeof policy.source === "string" && ["free", "pro", "trial", "grant", "agency"].includes(policy.source) && (policy.runnerPro ? policy.source !== "free" : policy.source === "free");
}
function withinKnownPaidEnd(policy: { runnerPro?: unknown; validUntil?: unknown }, expiresAt: number) {
	return policy.validUntil === null || (typeof policy.validUntil === "string" && Number.isFinite(Date.parse(policy.validUntil)) && (!policy.runnerPro || expiresAt <= Date.parse(policy.validUntil)));
}
function validBenefitPolicy(claims: RunnerBenefitSnapshotClaims) {
	const policy = claims.capabilities as unknown as Record<string, unknown>;
	if (!policy || typeof policy !== "object" || Array.isArray(policy) || typeof policy.runnerPro !== "boolean") return false;
	return matchesBenefitEntitlements(policy) && validBenefitEvaluation(policy, claims.issuedAt) && validBenefitSource(policy) && withinKnownPaidEnd(policy, claims.expiresAt);
}
function benefitClaimsHeader(claims: RunnerBenefitSnapshotClaims) {
	return !!claims && typeof claims === "object" && !Array.isArray(claims) && claims.issuer === "clipify.us" && claims.kind === "benefits";
}

/** Owner policy cannot substitute for an admission or an execution permit. */
export function verifyRunnerBenefitSnapshot(bundle: unknown, trustedKeys: Readonly<Record<string, string>>, expected: RunnerBenefitSnapshotIdentity, now = Date.now()): RunnerBenefitSnapshotClaims | null {
	try {
		const claims = readSignedClaims(bundle, trustedKeys) as RunnerBenefitSnapshotClaims;
		if (!benefitClaimsHeader(claims) || !validExecutionWindow(claims, now) || claims.issuedAt < 0 || claims.expiresAt - claims.issuedAt > 604800000 || !matchesBenefitIdentity(claims, expected) || !validBenefitPolicy(claims)) return null;
		return claims;
	} catch {
		return null;
	}
}

/** Cached policy gates new paid features; accepted execution has its own guard. */
export class RunnerBenefitSnapshotGuard {
	private cached: { policy: Readonly<RunnerBenefitPolicy>; deadline: number } | null = null;
	private knownEnd: { value: string; deadline: number } | null = null;
	private latestIssuedAt = -1;
	private latestConfigurationRevision = 0;
	private latestCapabilityRevision: string | null = null;
	private readonly identity: Pick<RunnerBenefitSnapshotIdentity, "ownerId" | "runnerId">;
	private readonly keys: Readonly<Record<string, string>>;
	private readonly clock: () => number;
	constructor(options: { ownerId: string; runnerId: string; keys: Readonly<Record<string, string>>; clock?: () => number }) {
		this.identity = { ownerId: options.ownerId, runnerId: options.runnerId };
		this.keys = { ...options.keys };
		this.clock = options.clock ?? executionNow;
	}
	get capabilities(): Readonly<RunnerBenefitPolicy> | null {
		try {
			const now = this.clock();
			if (!Number.isFinite(now) || !this.cached || now >= this.cached.deadline) this.cached = null;
			return this.cached?.policy ?? null;
		} catch {
			this.cached = null;
			return null;
		}
	}
	get runnerPro() {
		return this.capabilities?.runnerPro === true;
	}
	accept(bundle: unknown, request: LeaseRequestContext): boolean {
		this.cached = null;
		try {
			const now = this.clock();
			if (!Number.isFinite(now) || !Number.isFinite(request.sentAt) || request.sentAt < 0 || request.sentAt > now) return false;
			const candidate = readSignedClaims(bundle, this.keys);
			const claims = verifyRunnerBenefitSnapshot(bundle, this.keys, { ...this.identity, requestId: request.requestId }, candidate?.issuedAt);
			if (!claims || claims.issuedAt < this.latestIssuedAt || claims.configurationRevision < this.latestConfigurationRevision || (claims.issuedAt === this.latestIssuedAt && claims.configurationRevision === this.latestConfigurationRevision && claims.capabilities.capabilityRevision !== this.latestCapabilityRevision)) return false;
			// Snapshot freshness can renew before a longer paid period ends. Keep
			// that known paid end anchored independently of each snapshot's TTL.
			const paidEnd = claims.capabilities.runnerPro && claims.capabilities.validUntil !== null ? { value: claims.capabilities.validUntil, deadline: request.sentAt + (Date.parse(claims.capabilities.validUntil) - claims.issuedAt) } : null;
			if (paidEnd && this.knownEnd?.value === paidEnd.value) paidEnd.deadline = Math.min(paidEnd.deadline, this.knownEnd.deadline);
			const deadline = Math.min(request.sentAt + (claims.expiresAt - claims.issuedAt), paidEnd?.deadline ?? Infinity);
			if (now >= deadline) return false;
			if (paidEnd) this.knownEnd = paidEnd;
			this.latestIssuedAt = claims.issuedAt;
			this.latestConfigurationRevision = claims.configurationRevision;
			this.latestCapabilityRevision = claims.capabilities.capabilityRevision;
			this.cached = { policy: Object.freeze({ ...claims.capabilities }), deadline };
			return true;
		} catch {
			return false;
		}
	}
}

/** One authenticated credential's verified identity and current feature policy. */
export class RunnerBenefitSnapshotCache {
	private bound: Readonly<{ ownerId: string; runnerId: string }> | null = null;
	private guard: RunnerBenefitSnapshotGuard | null = null;
	private readonly pinned: { ownerId?: string; runnerId?: string };
	private readonly keys: Readonly<Record<string, string>>;
	private readonly clock: () => number;
	constructor(options: { ownerId?: string; runnerId?: string; keys: Readonly<Record<string, string>>; clock?: () => number }) {
		this.pinned = { ownerId: options.ownerId, runnerId: options.runnerId };
		this.keys = { ...options.keys };
		this.clock = options.clock ?? executionNow;
	}
	get scope() {
		return this.bound;
	}
	get capabilities() {
		return this.guard?.capabilities ?? null;
	}
	get runnerPro() {
		return this.capabilities?.runnerPro === true;
	}
	accept(bundle: unknown, request: LeaseRequestContext): boolean {
		try {
			const candidate = readSignedClaims(bundle, this.keys);
			if (!candidate || typeof candidate.ownerId !== "string" || typeof candidate.runnerId !== "string") {
				this.guard?.accept(null, request);
				return false;
			}
			const identity = { ownerId: this.bound?.ownerId ?? this.pinned.ownerId ?? candidate.ownerId, runnerId: this.bound?.runnerId ?? this.pinned.runnerId ?? candidate.runnerId };
			const guard = this.guard ?? new RunnerBenefitSnapshotGuard({ ...identity, keys: this.keys, clock: this.clock });
			if (!guard.accept(bundle, request)) return false;
			this.guard = guard;
			this.bound ??= Object.freeze(identity);
			return true;
		} catch {
			this.guard?.accept(null, request);
			return false;
		}
	}
}

/** A lease is anchored to request-send monotonic time, never the PC wall clock.
 * Restarted processes have no accepted lease and must obtain a fresh response.
 * The runtime journals terminal transitions and owns actual output shutdown.
 */
function untrustedExecutionCandidate(bundle: unknown): ExecutionClaims | null {
	if (!bundle || typeof bundle !== "object") return null;
	const payload = (bundle as SignedExecutionBundle).payload;
	if (typeof payload !== "string" || payload.length > 65536) return null;
	const candidate = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
	return candidate && typeof candidate === "object" ? candidate : null;
}
function scheduledPermissionWindowOpen(expected: ExecutionIdentity, claims: ExecutionClaims, pending: LeaseRequestContext, now: number) {
	if (expected.cacheAuthorization !== true) return true;
	return claims.scheduledStart !== undefined && claims.scheduledEnd != null && now >= pending.sentAt + claims.scheduledStart - claims.issuedAt && now < pending.sentAt + claims.scheduledEnd - claims.issuedAt;
}
function capturedOutputDeadline(policy: "free_lease" | "pro_broadcast", claims: ExecutionClaims, pending: LeaseRequestContext, renewalDeadline: number) {
	if (policy === "free_lease") return renewalDeadline;
	return claims.scheduledEnd == null ? null : pending.sentAt + (claims.scheduledEnd - claims.issuedAt);
}

class ExecutionPermission {
	private phase: "renewal_required" | "active" | "draining" = "renewal_required";
	private deadline: number | null = null;
	private pending: { requestId: string; sentAt: number } | null = null;
	private readonly expected: ExecutionIdentity & Pick<FreeLeaseBinding, "admissionId" | "leaseId">;
	private readonly keys: Readonly<Record<string, string>>;
	constructor(
		expected: ExecutionIdentity & Pick<FreeLeaseBinding, "admissionId" | "leaseId">,
		keys: Readonly<Record<string, string>>,
		private readonly clock: () => number,
		private readonly policy: "free_lease" | "pro_broadcast",
	) {
		this.expected = { ...expected };
		this.keys = { ...keys };
	}
	get state() {
		if (this.phase === "active" && this.deadline !== null) {
			const now = this.clock();
			if (!Number.isFinite(now) || now >= this.deadline) {
				this.phase = "draining";
				this.pending = null;
			}
		}
		return this.phase;
	}
	get deadlineMonotonic() {
		return this.deadline;
	}
	beginRenewal(context?: LeaseRequestContext) {
		if (this.state === "draining") return null;
		const now = this.clock();
		const sentAt = context?.sentAt ?? now;
		const requestId = context?.requestId ?? randomUUID();
		if (!Number.isFinite(now) || !Number.isFinite(sentAt) || (sentAt < 0 && !(this.policy === "pro_broadcast" && this.expected.cacheAuthorization === true)) || sentAt > now || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return null;
		this.pending = { requestId, sentAt };
		return requestId;
	}
	accept(bundle: unknown) {
		if (this.state === "draining" || !this.pending) return false;
		const pending = this.pending;
		this.pending = null;
		try {
			const untrusted = untrustedExecutionCandidate(bundle);
			if (!untrusted) return false;
			const claims = verifyExecutionBundle(bundle, this.keys, { ...this.expected, requestId: pending.requestId }, untrusted.issuedAt);
			if (!claims || claims.policy !== this.policy) return false;
			const now = this.clock(),
				deadline = pending.sentAt + (claims.expiresAt - claims.issuedAt);
			if (!Number.isFinite(now) || now < pending.sentAt) return false;
			if (!scheduledPermissionWindowOpen(this.expected, claims, pending, now)) return false;
			if (now >= deadline) {
				this.phase = "draining";
				return false;
			}
			const outputDeadline = capturedOutputDeadline(this.policy, claims, pending, deadline);
			this.deadline = this.policy === "pro_broadcast" && this.deadline !== null ? Math.min(this.deadline, outputDeadline ?? Infinity) : outputDeadline;
			this.phase = "active";
			return true;
		} catch {
			return false;
		}
	}
}

/** Free output always retains its bounded, monotonic renewal deadline. */
export class FreeExecutionLease extends ExecutionPermission {
	constructor(expected: ExecutionIdentity & Pick<FreeLeaseBinding, "admissionId" | "leaseId">, keys: Readonly<Record<string, string>>, clock: () => number = executionNow) {
		super(expected, keys, clock, "free_lease");
	}
}
/** A fresh signed paid start authorizes this captured broadcast until normal Stop. */
export class ProExecutionPermit extends ExecutionPermission {
	constructor(expected: ExecutionIdentity & Pick<FreeLeaseBinding, "admissionId" | "leaseId">, keys: Readonly<Record<string, string>>, clock: () => number = executionNow) {
		super(expected, keys, clock, "pro_broadcast");
	}
}

/** Canonical effective output set; credentials appear only as one-way digests. */
export function hashExecutionTargets(targets: ReadonlyArray<{ id: string; rtmpUrl: string; streamKey: string | null }>) {
	const canonical = targets.map((target) => ({ id: target.id, rtmpUrl: target.rtmpUrl, credential: target.streamKey ? createHash("sha256").update(target.streamKey).digest("hex") : null })).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

/** Bind cached private source input and capture settings without serializing secrets into claims. */
export function hashScheduledExecutionPayload(job: { overlayId: string; overlaySecret: string; mode: string; fps: number; resolution: string; targetHash: string }) {
	return createHash("sha256")
		.update(JSON.stringify({ sourceId: job.overlayId, sourceCredential: createHash("sha256").update(job.overlaySecret).digest("hex"), mode: job.mode === "24_7" ? "24/7" : job.mode, fps: job.fps, resolution: job.resolution, targetHash: job.targetHash }))
		.digest("hex");
}

export type ScheduleCacheManifest = { issuer: "clipify.us"; kind: "schedule_cache"; version: 1; ownerId: string; runnerId: string; requestId: string; configurationRevision: number; issuedAt: number; expiresAt: number; capabilities: RunnerBenefitPolicy; entries: { admissionId: string; occurrenceId: string; authorizationHash: string }[] };
function matchesManifestIdentity(claims: ScheduleCacheManifest, expected: { runnerId: string; ownerId?: string; requestId: string }) {
	return !!claims && claims.issuer === "clipify.us" && claims.kind === "schedule_cache" && claims.version === 1 && claims.runnerId === expected.runnerId && claims.requestId === expected.requestId && boundedIdentity(claims.ownerId) && (expected.ownerId === undefined || claims.ownerId === expected.ownerId);
}
function validManifestWindow(claims: ScheduleCacheManifest, now: number) {
	return [now, claims.issuedAt, claims.expiresAt, claims.configurationRevision].every(Number.isSafeInteger) && claims.issuedAt >= 0 && claims.configurationRevision >= 1 && claims.issuedAt <= now && claims.expiresAt > now && claims.expiresAt - claims.issuedAt <= 604800000;
}
function validManifestEntry(entry: ScheduleCacheManifest["entries"][number], ids: Set<string>) {
	return !!entry && typeof entry.admissionId === "string" && /^[0-9a-f-]{36}$/i.test(entry.admissionId) && !ids.has(entry.admissionId) && boundedIdentity(entry.occurrenceId, 1024) && digestIdentity(entry.authorizationHash);
}
function validManifestEntries(claims: ScheduleCacheManifest) {
	if (!Array.isArray(claims.entries) || claims.entries.length > 1024 || (!claims.capabilities.runnerPro && claims.entries.length)) return false;
	const ids = new Set<string>();
	for (const entry of claims.entries) {
		if (!validManifestEntry(entry, ids)) return false;
		ids.add(entry.admissionId);
	}
	return true;
}
function validManifestPolicy(claims: ScheduleCacheManifest) {
	const policy = claims.capabilities;
	return !!policy && typeof policy.runnerPro === "boolean" && policy.scheduling === policy.runnerPro && withinKnownPaidEnd(policy, claims.expiresAt);
}
/** The enclosing manifest binds cache replacement/clearing to one authenticated response. */
export function verifyScheduleCacheManifest(bundle: unknown, keys: Readonly<Record<string, string>>, expected: { runnerId: string; ownerId?: string; requestId: string }, now: number): ScheduleCacheManifest | null {
	try {
		const claims = readSignedClaims(bundle, keys) as ScheduleCacheManifest;
		if (!matchesManifestIdentity(claims, expected) || !validManifestWindow(claims, now) || !validManifestPolicy(claims) || !validManifestEntries(claims)) return null;
		return claims;
	} catch {
		return null;
	}
}
