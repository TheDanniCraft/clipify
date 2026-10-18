import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { uptime as systemUptime } from "node:os";
import { Entry } from "@napi-rs/keyring";
import { execFileSync } from "node:child_process";
import { executionNow } from "./execution-clock";
import { restrictCredentialFile } from "./storage";
import { verifyExecutionBundle, verifyScheduleCacheManifest, hashExecutionTargets, hashScheduledExecutionPayload, type LeaseRequestContext, type SignedExecutionBundle, type ScheduleCacheManifest } from "./protocol";
import type { FreeExecutionJob } from "./execution-runtime";

type PrivatePayload = Pick<FreeExecutionJob, "overlaySecret" | "rtmpUrl" | "streamKey" | "destinations">;
type StoredJob = Omit<FreeExecutionJob, keyof PrivatePayload>;
type StoredEntry = { job: StoredJob; credentialReference: string };
type StoredCache = { version: 1; bundle: SignedExecutionBundle; entries: StoredEntry[]; anchor: { bootId: string | null; sent: number; received: number } };
type Keyring = { set: (id: string, value: string) => Promise<void>; get: (id: string) => Promise<string | null> };
const service = "us.clipify.runner.schedule";
function bootIdentity(): string | null {
	try {
		const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (process.platform === "linux") {
			const value = readFileSync("/proc/sys/kernel/random/boot_id", "utf8").trim();
			return uuid.test(value) ? value.toLowerCase() : null;
		}
		if (process.platform === "darwin") {
			const value = execFileSync("/usr/sbin/sysctl", ["-n", "kern.bootsessionuuid"], { encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] }).trim();
			return uuid.test(value) ? value.toLowerCase() : null;
		}
		if (process.platform === "win32") {
			const script = String.raw`$ErrorActionPreference='Stop'; [pscustomobject]@{bootId=(Get-ItemPropertyValue -LiteralPath 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management\PrefetchParameters' -Name BootId -ErrorAction Stop);machine=(Get-ItemPropertyValue -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop)} | ConvertTo-Json -Compress`;
			const executable = process.env.SystemRoot ? join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "powershell.exe";
			const value = JSON.parse(execFileSync(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", timeout: 10000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] }));
			if (!Number.isInteger(value.bootId) || value.bootId < 0 || value.bootId > 4294967295 || typeof value.machine !== "string" || !uuid.test(value.machine)) return null;
			return createHash("sha256")
				.update(value.machine.toLowerCase() + ":" + value.bootId)
				.digest("hex");
		}
		return null;
	} catch {
		return null;
	}
}
function writeAtomic(path: string, value: unknown) {
	const temporary = path + "." + randomUUID() + ".tmp";
	try {
		const handle = openSync(temporary, "wx", 0o600);
		try {
			writeFileSync(handle, JSON.stringify(value));
			fsyncSync(handle);
		} finally {
			closeSync(handle);
		}
		renameSync(temporary, path);
		restrictCredentialFile(path);
	} finally {
		rmSync(temporary, { force: true });
	}
}

/** Protected cache documents hold only signed authority and opaque private-payload references.
 * This store does not by itself dispatch or authorize physical output.
 */
export class RunnerScheduleCache {
	private readonly path: string;
	private readonly privatePath: string;
	private readonly keys: Readonly<Record<string, string>>;
	private readonly keyring: Keyring;
	private readonly clock: () => number;
	private ownerId: string | undefined;
	private latestIssuedAt = -1;
	private latestRevision = 0;
	private current: StoredCache | null = null;
	private failure: "sync_required" | null = null;
	private receivedHere = false;
	private resolved: { snapshot: StoredCache; jobs: FreeExecutionJob[]; manifest: ScheduleCacheManifest } | null = null;
	private readonly bootId: () => string | null;
	constructor(private readonly options: { directory: string; runnerId: string; ownerId?: string; keys: Readonly<Record<string, string>>; clock?: () => number; uptime?: () => number; bootId?: () => string | null; keyring?: Keyring }) {
		this.path = join(options.directory, "snapshot.json");
		this.privatePath = join(options.directory, "private-payloads.json");
		this.keys = { ...options.keys };
		this.ownerId = options.ownerId;
		this.clock = options.clock ?? executionNow;
		let readBoot = false,
			knownBoot: string | null = null;
		this.bootId =
			options.bootId ??
			(() => {
				if (!readBoot) {
					knownBoot = bootIdentity();
					readBoot = true;
				}
				return knownBoot;
			});
		this.keyring = options.keyring ?? {
			set: async (id, value) => {
				await new Entry(service, id).setPassword(value);
			},
			get: async (id) => new Entry(service, id).getPassword(),
		};
		if (existsSync(this.path)) {
			try {
				if (statSync(this.path).size > 2 * 1024 * 1024) throw new Error();
				const stored = JSON.parse(readFileSync(this.path, "utf8")) as StoredCache;
				if (stored.version !== 1 || !stored.bundle || !Array.isArray(stored.entries) || !stored.anchor || ![stored.anchor.sent, stored.anchor.received].every((value) => Number.isFinite(value) && value >= 0) || stored.anchor.received < stored.anchor.sent || (stored.anchor.bootId !== null && (typeof stored.anchor.bootId !== "string" || !stored.anchor.bootId || stored.anchor.bootId.length > 256))) throw new Error();
				const untrusted = JSON.parse(Buffer.from(stored.bundle.payload, "base64url").toString("utf8"));
				const manifest = verifyScheduleCacheManifest(stored.bundle, this.keys, { runnerId: options.runnerId, ownerId: this.ownerId, requestId: untrusted.requestId }, untrusted.issuedAt);
				if (!manifest || manifest.entries.length !== stored.entries.length) throw new Error();
				this.ownerId = manifest.ownerId;
				this.latestIssuedAt = manifest.issuedAt;
				this.latestRevision = manifest.configurationRevision;
				this.current = stored;
			} catch {
				this.failure = "sync_required";
			}
		}
	}
	get error() {
		return this.failure;
	}
	get hasSnapshot() {
		return this.current !== null && this.failure === null;
	}
	revoke() {
		this.current = null;
		this.resolved = null;
		this.failure = "sync_required";
		rmSync(this.path, { force: true });
	}
	private validate(raw: unknown, requestId: string): { manifest: ScheduleCacheManifest; entries: FreeExecutionJob[]; bundle: SignedExecutionBundle } | null {
		if (!raw || typeof raw !== "object") return null;
		const response = raw as { bundle?: SignedExecutionBundle; entries?: { job: FreeExecutionJob }[] };
		if (!response.bundle || !Array.isArray(response.entries)) return null;
		let issuedAt: unknown;
		try {
			issuedAt = JSON.parse(Buffer.from(response.bundle.payload, "base64url").toString("utf8")).issuedAt;
		} catch {
			return null;
		}
		const manifest = verifyScheduleCacheManifest(response.bundle, this.keys, { runnerId: this.options.runnerId, ownerId: this.ownerId, requestId }, Number(issuedAt));
		if (!manifest || manifest.entries.length !== response.entries.length) return null;
		const jobs: FreeExecutionJob[] = [];
		for (const expected of manifest.entries) {
			const matches = response.entries.filter((entry) => entry?.job?.admissionId === expected.admissionId);
			if (matches.length !== 1) return null;
			const job = matches[0].job;
			if (!job || job.cacheAuthorization !== true || !job.lease || job.ownerId !== manifest.ownerId || job.runnerId !== manifest.runnerId || job.occurrenceId !== expected.occurrenceId || job.mode !== "24/7" || typeof job.overlaySecret !== "string" || typeof job.rtmpUrl !== "string" || (job.streamKey !== null && typeof job.streamKey !== "string") || !Number.isSafeInteger(job.fps) || job.fps < 1 || job.fps > 120 || typeof job.resolution !== "string" || !["720p", "1080p"].includes(job.resolution))
				return null;
			if (createHash("sha256").update(job.lease.payload).digest("hex") !== expected.authorizationHash) return null;
			const targets = job.destinations ?? [{ id: job.id, rtmpUrl: job.rtmpUrl, streamKey: job.streamKey }];
			if (!targets.length || new Set(targets.map((target) => target.id)).size !== targets.length || targets.some((target) => !target || typeof target.id !== "string" || typeof target.rtmpUrl !== "string" || (target.streamKey !== null && typeof target.streamKey !== "string")) || hashExecutionTargets(targets) !== job.targetHash) return null;
			const claims = verifyExecutionBundle(job.lease, this.keys, { ...job, sourceId: job.overlayId, sessionId: job.id, generation: job.executionGeneration, requestId, leaseId: JSON.parse(Buffer.from(job.lease.payload, "base64url").toString("utf8")).leaseId, executionPayloadHash: hashScheduledExecutionPayload(job) }, manifest.issuedAt);
			if (!claims || claims.issuedAt !== manifest.issuedAt || claims.expiresAt !== manifest.expiresAt) return null;
			jobs.push(structuredClone(job));
		}
		return { manifest, entries: jobs, bundle: response.bundle };
	}
	private fallback(): Record<string, string> {
		if (!existsSync(this.privatePath)) return {};
		if (statSync(this.privatePath).size > 16 * 1024 * 1024) throw new Error("Schedule private storage invalid");
		const value: unknown = JSON.parse(readFileSync(this.privatePath, "utf8"));
		if (!value || typeof value !== "object" || Array.isArray(value) || Object.entries(value).some(([key, payload]) => !/^[a-f0-9]{64}$/.test(key) || typeof payload !== "string")) throw new Error("Schedule private storage invalid");
		return value as Record<string, string>;
	}
	private async retain(payload: PrivatePayload) {
		const value = JSON.stringify(payload),
			id = createHash("sha256").update(value).digest("hex");
		try {
			await this.keyring.set(id, value);
		} catch {
			const previous = this.fallback();
			if (previous[id] !== value) writeAtomic(this.privatePath, { ...previous, [id]: value });
		}
		return id;
	}
	async accept(raw: unknown, request: LeaseRequestContext): Promise<boolean> {
		try {
			const now = this.clock();
			if (!Number.isFinite(now) || !Number.isFinite(request.sentAt) || request.sentAt < 0 || request.sentAt > now) throw new Error();
			const uptimeReceived = (this.options.uptime ?? (() => systemUptime() * 1000))();
			const uptimeSent = uptimeReceived - (now - request.sentAt);
			if (!Number.isFinite(uptimeReceived) || !Number.isFinite(uptimeSent) || uptimeSent < 0) throw new Error();
			const verified = this.validate(raw, request.requestId);
			if (!verified || verified.manifest.issuedAt < this.latestIssuedAt || verified.manifest.configurationRevision < this.latestRevision || now - request.sentAt >= verified.manifest.expiresAt - verified.manifest.issuedAt) throw new Error();
			mkdirSync(this.options.directory, { recursive: true, mode: 0o700 });
			const entries: StoredEntry[] = [];
			for (const job of verified.entries) {
				const { overlaySecret, rtmpUrl, streamKey, destinations, ...safe } = job;
				const credentialReference = await this.retain({ overlaySecret, rtmpUrl, streamKey, ...(destinations ? { destinations } : {}) });
				entries.push({ job: safe, credentialReference });
			}
			const next: StoredCache = { version: 1, bundle: verified.bundle, entries, anchor: { bootId: this.bootId(), sent: uptimeSent, received: uptimeReceived } };
			writeAtomic(this.path, next);
			this.current = next;
			this.resolved = { snapshot: next, jobs: verified.entries, manifest: verified.manifest };
			this.receivedHere = true;
			this.ownerId = verified.manifest.ownerId;
			this.latestIssuedAt = verified.manifest.issuedAt;
			this.latestRevision = verified.manifest.configurationRevision;
			this.failure = null;
			return true;
		} catch {
			this.failure = "sync_required";
			return false;
		}
	}
	async restore(): Promise<{ jobs: FreeExecutionJob[]; request: LeaseRequestContext; serverTimeLower: number; serverTimeUpper: number; manifest: ScheduleCacheManifest } | null> {
		try {
			if (this.failure || !this.current) throw new Error();
			const stored = this.current,
				anchor = stored.anchor;
			const boot = this.bootId();
			if ((!anchor.bootId || !boot || anchor.bootId !== boot) && !(this.receivedHere && anchor.bootId === boot)) throw new Error();
			const uptime = (this.options.uptime ?? (() => systemUptime() * 1000))(),
				now = this.clock();
			if (!Number.isFinite(uptime) || !Number.isFinite(now) || now < 0 || uptime < anchor.received) throw new Error();
			let verified = this.resolved?.snapshot === stored ? { entries: this.resolved.jobs, manifest: this.resolved.manifest } : null;
			if (!verified) {
				const entries: { job: FreeExecutionJob }[] = [];
				for (const entry of stored.entries) {
					if (!entry || !/^[a-f0-9]{64}$/.test(entry.credentialReference)) throw new Error();
					let serialized: string | null = null;
					try {
						serialized = await this.keyring.get(entry.credentialReference);
					} catch {}
					serialized ??= this.fallback()[entry.credentialReference] ?? null;
					if (!serialized || createHash("sha256").update(serialized).digest("hex") !== entry.credentialReference) throw new Error();
					const value = JSON.parse(serialized) as PrivatePayload;
					entries.push({ job: { ...entry.job, overlaySecret: value.overlaySecret, rtmpUrl: value.rtmpUrl, streamKey: value.streamKey, ...(value.destinations ? { destinations: value.destinations } : {}) } });
				}
				const untrusted = JSON.parse(Buffer.from(stored.bundle.payload, "base64url").toString("utf8"));
				const validated = this.validate({ bundle: stored.bundle, entries }, untrusted.requestId);
				if (!validated) throw new Error();
				verified = validated;
				this.resolved = { snapshot: stored, jobs: validated.entries, manifest: validated.manifest };
			}
			const serverTimeLower = verified.manifest.issuedAt + uptime - anchor.received;
			const serverTimeUpper = verified.manifest.issuedAt + uptime - anchor.sent;
			if (serverTimeUpper >= verified.manifest.expiresAt) throw new Error();
			return { jobs: structuredClone(verified.entries), request: { requestId: verified.manifest.requestId, sentAt: now - (uptime - anchor.sent) }, serverTimeLower, serverTimeUpper, manifest: verified.manifest };
		} catch {
			this.failure = "sync_required";
			return null;
		}
	}
}
