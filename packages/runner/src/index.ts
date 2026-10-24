import { acquireRunnerInstance, recoverInterruptedExecutions } from "./startup-recovery";
import { parseExecutionPublicKeys } from "./execution-keys";
import { executionNow } from "./execution-clock";
import { RunnerBenefitSnapshotCache } from "./protocol";
import { RunnerScheduleCache } from "./schedule-cache";
import { TerminalCredentialStore } from "./terminal-credentials";
import { flushTerminalReceipts } from "./terminal-delivery";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { FreeExecutionController, type FreeExecutionJob } from "./execution-runtime";
import { ExecutionJournal } from "./execution-journal";
import { randomUUID, createHash } from "node:crypto";
import * as os from "os";
import * as readline from "readline";
import { activateRtmpProbeNonce, Engine, startTCPProxy, stopTCPProxy } from "./engine";
import { ensureDependencies } from "./downloader";
import { ConsoleUI } from "./logger";
import { checkForUpdates, cleanupOldVersions } from "./updater";
import { openBrowser } from "./browser";
import { getRtmpReachabilityConfirmation, type RtmpReachabilityStatus } from "./reachability";

import { clearCredentials, loadCredentials, saveCredentials, type RunnerCredentials } from "./storage";

// Keep dependency deprecation noise out of the end-user runner console.
if (process.env.NODE_ENV !== "test") process.noDeprecation = true;

let RUNNER_VERSION = "unknown";
const DEVELOPMENT_API_BASE = "http://localhost:3000";

// Track actual states and active engines locally
const actualStates: Record<string, string> = {};
const activeEngines: Record<string, Engine> = {};
const drainingEngines = new Set<Engine>();
const admittedEngines = new WeakSet<Engine>();
const freeControllers = new Map<string, { runnerId: string; controller: FreeExecutionController }>();
const freeJournals = new Map<string, ExecutionJournal>();
const closedOnRestart = new Set<string>();
const learnedDevices = new Map<string, string>();
const ownerBenefitCaches = new Map<string, RunnerBenefitSnapshotCache>();
const scheduleCaches = new Map<string, RunnerScheduleCache>();
const scheduleContexts = new Map<string, { runnerId: string; apiBase: string; token: string; busy: boolean; warned: boolean }>();
let terminalCredentials: TerminalCredentialStore | undefined;
let terminalDelivery: Promise<void> | undefined;
let nextTerminalDeliveryAt = 0;

async function stopRtmpProxyIfUnused() {
	const hasFailsafeEngine = Object.values(activeEngines).some((engine) => engine.mode === "failsafe" && engine.isRunning);
	if (!hasFailsafeEngine) await stopTCPProxy();
}

function getRunnerOsInfo() {
	return `${os.type()} ${os.release()} ${os.arch()}`;
}

interface EnrollmentStartResponse {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	expiresAt: string;
	pollInterval: number;
}

interface EnrollmentApprovedResponse {
	status: "approved";
	apiBase: string;
	runnerId: string;
	token: string;
}

class RunnerConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RunnerConfigurationError";
	}
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeApiBase(apiBase: string) {
	return apiBase.replace(/\/+$/, "");
}

function normalizeIpCandidate(value: unknown) {
	if (typeof value !== "string") return null;
	let address = value.trim();
	if (!address) return null;
	address = address.split("%")[0].toLowerCase();
	if (address.startsWith("::ffff:")) address = address.slice("::ffff:".length);
	return address;
}

function isPublicRoutableAddress(value: unknown) {
	const address = normalizeIpCandidate(value);
	if (!address) return false;

	const ipv4 = address.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (ipv4) {
		const [a, b, c] = ipv4.slice(1).map(Number);
		if ([a, b, c, Number(ipv4[4])].some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
		return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || (a === 192 && b === 0) || (a === 192 && b === 0 && c === 2) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || a >= 224);
	}

	return !(address === "::1" || address === "::" || address.startsWith("fe80:") || address.startsWith("fc") || address.startsWith("fd") || address.startsWith("ff") || address.startsWith("2001:db8:"));
}

function getPublicRoutableInterfaceIps() {
	return [
		...new Set(
			Object.values(os.networkInterfaces())
				.flatMap((entries) => entries ?? [])
				.filter((entry) => !entry.internal && isPublicRoutableAddress(entry.address))
				.map((entry) => entry.address),
		),
	];
}

function isSourceRunnerExecution() {
	const normalizedArgs = process.argv.map((arg) => arg.replace(/\\/g, "/"));
	return normalizedArgs.some((arg) => arg.endsWith("packages/runner/src/index.ts"));
}

function resolveApiBase(options: { overrideUrl?: string; localApiBase?: string; hasLocalToken: boolean }) {
	const explicitApiBase = options.overrideUrl || process.env.CLIPIFY_API_URL || process.env.BAKED_API_URL;
	if (explicitApiBase) return normalizeApiBase(explicitApiBase);

	if (isSourceRunnerExecution() && !options.hasLocalToken) return DEVELOPMENT_API_BASE;
	if (options.localApiBase) return normalizeApiBase(options.localApiBase);

	throw new RunnerConfigurationError("This runner is missing its Clipify connection settings.");
}

async function startRunnerEnrollment(apiBase: string, runnerId?: string) {
	const startUrl = `${apiBase}/api/runner/enroll/start`;
	const startResponse = await fetch(startUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			os: getRunnerOsInfo(),
			hostname: os.hostname(),
			version: RUNNER_VERSION,
			runnerId,
		}),
	});

	if (!startResponse.ok) {
		const responseText = await startResponse.text().catch(() => "");
		const responseSuffix = responseText ? `: ${responseText}` : "";
		throw new Error(`Enrollment start failed with status ${startResponse.status} at ${startUrl}${responseSuffix}`);
	}

	return (await startResponse.json()) as EnrollmentStartResponse;
}

function printEnrollmentInstructions(enrollment: EnrollmentStartResponse) {
	console.log("==========================================");
	console.log("=       Clipify Runner Enrollment        =");
	console.log("==========================================");
	console.log(`[Enrollment] Open this URL on any device: ${enrollment.verificationUri}`);
	console.log(`[Enrollment] Code: ${enrollment.userCode}`);
	console.log("[Enrollment] If no browser opens, open the URL manually and enter the code.");
	console.log("[Enrollment] Waiting for approval...");
}

function updateEnrollmentCodeLine(userCode: string) {
	if (!process.stdout.isTTY) {
		console.log(`[Enrollment] Code: ${userCode}`);
		return;
	}

	readline.moveCursor(process.stdout, 0, -3);
	readline.cursorTo(process.stdout, 0);
	readline.clearLine(process.stdout, 0);
	process.stdout.write(`[Enrollment] Code: ${userCode}`);
	readline.cursorTo(process.stdout, 0);
	readline.moveCursor(process.stdout, 0, 3);
}

async function enrollRunner(apiBase: string, runnerId?: string): Promise<Required<Pick<RunnerCredentials, "runnerId" | "apiBase" | "token">>> {
	console.log("[Enrollment] No runner token found. Starting browser enrollment...");
	let hasPrintedInstructions = false;

	while (true) {
		const enrollment = await startRunnerEnrollment(apiBase, runnerId);

		if (hasPrintedInstructions) {
			updateEnrollmentCodeLine(enrollment.userCode);
		} else {
			printEnrollmentInstructions(enrollment);
			openBrowser(enrollment.verificationUri);
			hasPrintedInstructions = true;
		}

		const expiresAt = new Date(enrollment.expiresAt).getTime();
		const pollIntervalMs = Math.max(1, enrollment.pollInterval || 3) * 1000;

		while (Date.now() < expiresAt) {
			await sleep(pollIntervalMs);
			const pollResponse = await fetch(`${apiBase}/api/runner/enroll/poll`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ deviceCode: enrollment.deviceCode }),
			});

			if (pollResponse.status === 202) continue;
			if (pollResponse.status === 410) break;
			if (!pollResponse.ok) {
				const responseText = await pollResponse.text().catch(() => "");
				const responseSuffix = responseText ? `: ${responseText}` : "";
				throw new Error(`Enrollment poll failed with status ${pollResponse.status}${responseSuffix}`);
			}

			const approved = (await pollResponse.json()) as EnrollmentApprovedResponse;
			if (approved.status === "approved") {
				const credentials = { runnerId: approved.runnerId, apiBase: approved.apiBase, token: approved.token };
				await saveCredentials(credentials);
				console.log("[Enrollment] Runner approved and credentials saved.");
				return credentials;
			}
		}
	}
}

function requiresStreamKey(rtmpUrl: string) {
	return rtmpUrl === "rtmp://live.twitch.tv/app" || rtmpUrl === "rtmp://a.rtmp.youtube.com/live2";
}

type HeartbeatJob = {
	id: string;
	mode: "24_7" | "24/7" | "failsafe";
	rtmpUrl: string;
	overlaySecret: string;
	streamKey: string | null;
	overlayId: string;
	fps: number;
	resolution: string;
	desiredState: "running" | "stopped";
	stopMode?: "graceful" | "immediate";
	ownerId?: string;
	runnerId?: string;
	admissionId?: string;
	executionGeneration?: string;
	configurationRevision?: number;
	lease?: FreeExecutionJob["lease"];
};

async function checkPublicRtmpReachability(apiBase: string, token: string): Promise<{ status: RtmpReachabilityStatus; reachableIps: string[] }> {
	let startedProxyForCheck = false;
	try {
		startedProxyForCheck = await startTCPProxy();
		const startResponse = await fetch(`${apiBase}/api/runner/reachability/start`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
			body: JSON.stringify({ candidateIps: getPublicRoutableInterfaceIps() }),
		});

		if (!startResponse.ok) {
			console.warn(`[Security] RTMP reachability check could not start (status ${startResponse.status}). Continuing without blocking.`);
			return { status: "unknown", reachableIps: [] };
		}

		const startData = (await startResponse.json()) as { checkId?: string; nonce?: string; ipsToCheck?: string[] };
		if (!startData.checkId || !startData.nonce || !Array.isArray(startData.ipsToCheck) || startData.ipsToCheck.length === 0) {
			return { status: "skipped", reachableIps: [] };
		}

		activateRtmpProbeNonce(startData.nonce);
		const executeResponse = await fetch(`${apiBase}/api/runner/reachability/execute`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
			body: JSON.stringify({ checkId: startData.checkId }),
		});

		if (!executeResponse.ok) {
			console.warn(`[Security] RTMP reachability check could not complete (status ${executeResponse.status}). Continuing without blocking.`);
			return { status: "unknown", reachableIps: [] };
		}

		const executeData = (await executeResponse.json()) as { status?: RtmpReachabilityStatus; reachableIps?: string[] };
		if (executeData.status === "reachable") return { status: "reachable", reachableIps: executeData.reachableIps ?? [] };
		if (executeData.status === "not_reachable") return { status: "not_reachable", reachableIps: [] };
		return { status: "unknown", reachableIps: [] };
	} catch (error) {
		console.warn("[Security] RTMP reachability check failed. Continuing without blocking.", error);
		return { status: "unknown", reachableIps: [] };
	} finally {
		if (startedProxyForCheck) {
			try {
				await stopTCPProxy();
			} catch (error) {
				console.warn("[Security] Failed to stop the temporary RTMP reachability listener.", error);
			}
		}
	}
}

async function prepareLiveFallback(apiBase: string, token: string) {
	const reachability = await checkPublicRtmpReachability(apiBase, token);
	const confirmation = getRtmpReachabilityConfirmation(reachability.status);
	if (confirmation) console.log(confirmation);
	if (reachability.status === "reachable") {
		console.error("==========================================================================");
		console.error("[SECURITY WARNING] RTMP ingest port 1935 is reachable from the public internet.");
		console.error("Anyone who can reach this port could stream into this runner while it is active.");
		console.error("Protect port 1935 with firewall or private-network rules. The runner will continue starting.");
		if (reachability.reachableIps.length > 0) console.error(`Reachable address(es): ${reachability.reachableIps.join(", ")}`);
		console.error("==========================================================================");
	}
}

async function processHeartbeatJob(job: HeartbeatJob, apiBase: string, token: string) {
	const mode = job.mode === "24/7" ? "24_7" : job.mode;
	const streamKey = job.streamKey ?? "";
	const existingEngine = activeEngines[job.id];
	// Admission-bound commands exclusively control signed executions, including cached schedules.
	if (existingEngine && admittedEngines.has(existingEngine)) return;
	if (existingEngine && drainingEngines.has(existingEngine) && !(job.desiredState === "stopped" && job.stopMode === "immediate")) return;
	const needsRestart = Boolean(existingEngine && (existingEngine.mode !== mode || existingEngine.rtmpUrl !== job.rtmpUrl || existingEngine.streamKey !== streamKey || existingEngine.overlayId !== job.overlayId || existingEngine.fps !== job.fps || existingEngine.resolution !== job.resolution));

	console.log(`  - Job [${job.id}]: Mode=${mode}, DesiredState=${job.desiredState}`);

	if (job.desiredState === "running" && requiresStreamKey(job.rtmpUrl) && !streamKey) {
		console.error(`[Error] Missing stream key for Twitch/YouTube job ${job.id}; refusing to start engine.`);
		if (existingEngine) {
			await existingEngine.stop();
			delete activeEngines[job.id];
			await stopRtmpProxyIfUnused();
		}
		actualStates[job.id] = "error";
		return;
	}

	if (job.desiredState === "running" && (actualStates[job.id] !== "running" || needsRestart)) {
		if (needsRestart && existingEngine) {
			console.log(`  -> Restarting engine for job ${job.id} due to parameter change...`);
			await existingEngine.stop();
			delete activeEngines[job.id];
			await stopRtmpProxyIfUnused();
		} else {
			console.log(`  -> Starting engine for job ${job.id}...`);
		}

		if (mode === "failsafe") await prepareLiveFallback(apiBase, token);

		actualStates[job.id] = "running";
		const engine = new Engine(job.overlayId, job.rtmpUrl, job.overlaySecret, streamKey, job.fps, job.resolution, mode, apiBase, token);
		activeEngines[job.id] = engine;
		engine.start().catch((err) => {
			console.error(`[Error] Engine failed to start for job ${job.id}:`, err);
			actualStates[job.id] = "error";
			engine.isRunning = false;
			if (activeEngines[job.id] === engine) delete activeEngines[job.id];
			void stopRtmpProxyIfUnused();
		});
		return;
	}

	if (job.desiredState === "stopped" && (actualStates[job.id] === "running" || actualStates[job.id] === "error")) {
		console.log(`  -> Stopping engine for job ${job.id}...`);
		if (!existingEngine) {
			actualStates[job.id] = "stopped";
			return;
		}
		if (drainingEngines.has(existingEngine) && job.stopMode !== "immediate") return;
		drainingEngines.add(existingEngine);
		const stopping = job.stopMode === "immediate" ? existingEngine.stop() : existingEngine.requestDrain();
		void stopping
			.then(async () => {
				if (activeEngines[job.id] !== existingEngine) return;
				actualStates[job.id] = "stopped";
				delete activeEngines[job.id];
				await stopRtmpProxyIfUnused();
			})
			.catch((error: unknown) => {
				console.error(`[Error] Engine failed to drain for job ${job.id}:`, error);
				if (activeEngines[job.id] === existingEngine) actualStates[job.id] = "error";
			})
			.finally(() => {
				drainingEngines.delete(existingEngine);
			});
	}
}

function getTerminalCredentials() {
	return (terminalCredentials ??= new TerminalCredentialStore());
}
function retryTerminalDelivery(): Promise<void> {
	if (!terminalCredentials) return Promise.resolve();
	if (!terminalDelivery)
		terminalDelivery = flushTerminalReceipts({ credentials: terminalCredentials, journalFor: getFreeJournal }).finally(() => {
			terminalDelivery = undefined;
		});
	return terminalDelivery;
}
function startExecutionWatchdog() {
	return setInterval(() => {
		if (terminalCredentials && Date.now() >= nextTerminalDeliveryAt) {
			nextTerminalDeliveryAt = Date.now() + 10000;
			void retryTerminalDelivery().catch(() => console.warn("[Runner] Terminal credential retry remains pending."));
		}
		void tickRunnerSchedules();
		for (const entry of freeControllers.values()) void entry.controller.tick().catch(() => console.error("[Runner] Execution shutdown remains pending; retrying safely."));
	}, 250);
}

/** Local evaluation continues independently of the control polling connection. */
async function tickRunnerSchedules() {
	for (const [key, cache] of scheduleCaches) {
		const context = scheduleContexts.get(key);
		if (!context || context.busy) continue;
		context.busy = true;
		try {
			const restored = await cache.restore();
			if (!restored) {
				if (!context.warned) console.warn("[Runner] Schedule synchronization required; new scheduled starts are unavailable.");
				context.warned = true;
				continue;
			}
			if (scheduleContexts.get(key) !== context) continue;
			const journal = getFreeJournal(context.runnerId);
			for (const job of restored.jobs) {
				if (!journal.get(job.admissionId)) {
					const claims = JSON.parse(Buffer.from(job.lease.payload, "base64url").toString("utf8"));
					journal.save({ admissionId: job.admissionId, ownerId: job.ownerId, runnerId: job.runnerId, sessionId: job.id, executionGeneration: job.executionGeneration, leaseId: claims.leaseId, configurationRevision: job.configurationRevision, state: "pending", updatedAt: Date.now(), occurrence: { occurrenceId: job.occurrenceId!, start: job.scheduledStart!, end: job.scheduledEnd! } });
				}
			}
			journal.closeUnusedOccurrences({ ownerId: restored.manifest.ownerId, runnerId: context.runnerId }, restored.serverTimeLower);
			for (const receipt of journal.pendingTerminals()) getFreeController(receipt, context.runnerId, context.apiBase, context.token);
			journal.prune(Math.floor(restored.serverTimeLower));
			// Empty signed replacements also revoke unstarted continuity membership.
			getFreeController({ ownerId: restored.manifest.ownerId, runnerId: context.runnerId }, context.runnerId, context.apiBase, context.token)?.prepareScheduledJobs(restored.jobs, restored.request);

			for (const job of restored.jobs) {
				if (restored.serverTimeLower < job.scheduledStart! || restored.serverTimeUpper >= job.scheduledEnd!) continue;
				const controller = getFreeController(job, context.runnerId, context.apiBase, context.token);
				if (controller) void controller.apply(job, restored.request).catch(() => console.error("[Runner] Scheduled execution could not start; synchronization is required."));
			}
		} catch {
			if (!context.warned) console.error("[Runner] Schedule storage unavailable; new scheduled starts are unavailable.");
			context.warned = true;
		} finally {
			context.busy = false;
		}
	}
}

function getFreeJournal(runnerId: string) {
	let journal = freeJournals.get(runnerId);
	if (!journal) {
		journal = new ExecutionJournal(join(os.homedir(), ".clipify-runner", "executions", runnerId));
		freeJournals.set(runnerId, journal);
	}
	return journal;
}
function restoreFreeReceipts(runnerId: string, apiBase: string, token: string) {
	for (const receipt of getFreeJournal(runnerId).pendingTerminals()) if (receipt.runnerId === runnerId) getFreeController(receipt, runnerId, apiBase, token);
}
function getFreeController(job: Pick<HeartbeatJob, "ownerId" | "runnerId">, runnerId: string, apiBase: string, token: string) {
	if (!job.ownerId || job.runnerId !== runnerId) return null;
	const key = JSON.stringify([runnerId, job.ownerId]);
	const existing = freeControllers.get(key);
	if (existing) return existing.controller;
	const keys = parseExecutionPublicKeys(process.env.RUNNER_EXECUTION_PUBLIC_KEYS ?? process.env.BAKED_RUNNER_EXECUTION_PUBLIC_KEYS);
	const controller = new FreeExecutionController({
		ownerId: job.ownerId,
		runnerId,
		keys,
		journal: getFreeJournal(runnerId),
		closedOnRestart,
		clock: executionNow,
		createEngine: (assignment, policy) => {
			const mode = assignment.mode === "24/7" ? "24_7" : assignment.mode;
			const engine = new Engine(assignment.overlayId, assignment.rtmpUrl, assignment.overlaySecret, assignment.streamKey ?? "", assignment.fps, assignment.resolution, mode, apiBase, token, { presentationSessionId: assignment.id, scheduledDeadlineMonotonic: policy.scheduledDeadlineMonotonic, destinations: assignment.destinations, executionGeneration: assignment.executionGeneration, mayOpenOutput: policy.mayOpenOutput });
			activeEngines[assignment.id] = engine;
			admittedEngines.add(engine);
			const closed = async (operation: Promise<void>) => {
				await operation;
				if (activeEngines[assignment.id] === engine) {
					delete activeEngines[assignment.id];
					actualStates[assignment.id] = "stopped";
				}
				await stopRtmpProxyIfUnused();
			};
			return {
				get isRunning() {
					return engine.isRunning;
				},
				start: async () => {
					if (mode === "failsafe") await prepareLiveFallback(apiBase, token);
					const started = await engine.start();
					if (started === false) {
						if (activeEngines[assignment.id] === engine) actualStates[assignment.id] = "stopped";
						return false;
					}
					if (activeEngines[assignment.id] === engine) actualStates[assignment.id] = "running";
				},
				stop: () => closed(engine.stop()),
				requestDrain: (options) => closed(engine.requestDrain(options)),
				updateScheduledDeadline: (deadline) => engine.updateScheduledDeadline(deadline),
				get drainOutcome() {
					return engine.drainOutcome;
				},
			};
		},
	});
	freeControllers.set(key, { runnerId, controller });
	return controller;
}

function getRunnerBenefitCache(credentialId: string, runnerId?: string) {
	let cache = ownerBenefitCaches.get(credentialId);
	if (!cache) {
		cache = new RunnerBenefitSnapshotCache({ runnerId, keys: parseExecutionPublicKeys(process.env.RUNNER_EXECUTION_PUBLIC_KEYS ?? process.env.BAKED_RUNNER_EXECUTION_PUBLIC_KEYS), clock: executionNow });
		ownerBenefitCaches.set(credentialId, cache);
	}
	return cache;
}

function getRunnerScheduleCache(credentialId: string, runnerId: string, apiBase: string, token: string) {
	let cache = scheduleCaches.get(credentialId);
	if (!cache) {
		cache = new RunnerScheduleCache({ directory: join(os.homedir(), ".clipify-runner", "schedules", runnerId), runnerId, ownerId: ownerBenefitCaches.get(credentialId)?.scope?.ownerId, keys: parseExecutionPublicKeys(process.env.RUNNER_EXECUTION_PUBLIC_KEYS ?? process.env.BAKED_RUNNER_EXECUTION_PUBLIC_KEYS), clock: executionNow });
		scheduleCaches.set(credentialId, cache);
		if (cache.error) console.warn("[Runner] Schedule synchronization required; new scheduled starts are unavailable.");
	}
	if (cache.hasSnapshot && !scheduleContexts.has(credentialId)) scheduleContexts.set(credentialId, { runnerId, apiBase, token, busy: false, warned: false });
	return cache;
}

async function handleHeartbeatFailure(response: Response, credentialId: string, request: { requestId: string; sentAt: number }, token: string, apiBase: string, runnerId?: string): Promise<"reauth" | "retry"> {
	console.error(`[Error] API returned status ${response.status}`);
	if (response.status === 401) {
		scheduleContexts.delete(credentialId);
		const revokedSchedule = scheduleCaches.get(credentialId);
		scheduleCaches.delete(credentialId);
		try {
			revokedSchedule?.revoke();
		} catch {
			console.error("[Runner] Revoked schedule cache could not be removed; synchronization is required.");
		}
		ownerBenefitCaches.get(credentialId)?.accept(null, request);
		ownerBenefitCaches.delete(credentialId);
		if (runnerId) await getTerminalCredentials().save({ runnerId, apiBase, token });
		await stopActiveEngines();
		if (terminalDelivery) await terminalDelivery;
		await retryTerminalDelivery();
		if (!process.env.CLIPIFY_TOKEN) {
			await clearCredentials(runnerId);
			console.error("[Runner] Credentials invalid or revoked. Starting new enrollment...");
			return "reauth";
		}
		console.error("[Runner] Token invalid or revoked. Outputs are closed; update the configured token to reconnect.");
	}
	return "retry";
}

type HeartbeatResponse = { jobs?: HeartbeatJob[]; benefitSnapshot?: unknown; scheduleCache?: unknown; acceptedExecutions?: { admissionId: string; executionGeneration: string; state: string }[] };
async function acceptHeartbeatCaches(data: HeartbeatResponse, request: { requestId: string; sentAt: number }, credentialId: string, apiBase: string, token: string, runnerId?: string) {
	if (data.benefitSnapshot !== undefined || ownerBenefitCaches.has(credentialId)) {
		const cache = getRunnerBenefitCache(credentialId, runnerId);
		if (cache.accept(data.benefitSnapshot, request) && !runnerId && cache.scope) {
			await saveCredentials({ runnerId: cache.scope.runnerId, apiBase, token });
			learnedDevices.set(credentialId, cache.scope.runnerId);
			runnerId = cache.scope.runnerId;
		}
	}
	if (data.scheduleCache !== undefined && runnerId) {
		const cache = getRunnerScheduleCache(credentialId, runnerId, apiBase, token);
		if (!(await cache.accept(data.scheduleCache, request))) console.warn("[Runner] Schedule synchronization required; new scheduled starts are unavailable.");
		else scheduleContexts.set(credentialId, { runnerId, apiBase, token, busy: false, warned: false });
	}
	return runnerId;
}

function executionReportMatches(verified: ReturnType<ExecutionJournal["get"]>, job: HeartbeatJob, candidateId: string) {
	return !!verified && verified.ownerId === job.ownerId && verified.runnerId === candidateId && verified.sessionId === job.id && verified.executionGeneration === job.executionGeneration && verified.configurationRevision === job.configurationRevision && ["starting", "active"].includes(verified.state);
}

async function processExecutionHeartbeatJob(job: HeartbeatJob, request: { requestId: string; sentAt: number }, credentialId: string, apiBase: string, token: string, runnerId?: string) {
	const candidateId = runnerId ?? (typeof job.runnerId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job.runnerId) ? job.runnerId : undefined);
	const controller = candidateId ? getFreeController(job, candidateId, apiBase, token) : null;
	if (!controller) return runnerId;
	const operation = job.desiredState === "running" ? (job.lease ? controller.apply(job as FreeExecutionJob, request) : Promise.resolve(false)) : controller.stop(job as FreeExecutionJob, job.stopMode === "immediate");
	void operation.catch(() => console.error("[Runner] Execution control failed; keeping shutdown receipt pending."));
	if (!runnerId && candidateId && job.admissionId) {
		// Journal identity was persisted only after lease verification.
		const verified = getFreeJournal(candidateId).get(job.admissionId);
		if (executionReportMatches(verified, job, candidateId)) {
			await saveCredentials({ runnerId: candidateId, apiBase, token });
			learnedDevices.set(credentialId, candidateId);
			runnerId = candidateId;
		}
	}
	return runnerId;
}

async function pollHeartbeat(token: string, apiBase: string, runnerId?: string): Promise<"ok" | "reauth" | "retry"> {
	try {
		const credentialId = createHash("sha256")
			.update(JSON.stringify([apiBase, token]))
			.digest("hex");
		runnerId ??= learnedDevices.get(credentialId);
		console.log(`[Heartbeat] Polling ${apiBase}/api/runner/heartbeat...`);
		if (runnerId) {
			restoreFreeReceipts(runnerId, apiBase, token);
			if (existsSync(join(os.homedir(), ".clipify-runner", "schedules", runnerId, "snapshot.json"))) getRunnerScheduleCache(credentialId, runnerId, apiBase, token);
		}
		const request = { requestId: randomUUID(), sentAt: executionNow() };
		const executions = Array.from(freeControllers.values())
			.filter((entry) => entry.runnerId === runnerId)
			.flatMap((entry) => entry.controller.reports());
		const response = await fetch(`${apiBase}/api/runner/heartbeat`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
			body: JSON.stringify({ requestId: request.requestId, executions, protocolVersion: 2, capabilities: ["admissions", "destinations", "drain", "runner_presentation", "free_lease", "schedule_cache"], os: getRunnerOsInfo(), hostname: os.hostname(), version: RUNNER_VERSION, actualStates }),
		});
		if (!response.ok) return await handleHeartbeatFailure(response, credentialId, request, token, apiBase, runnerId);
		const data = (await response.json()) as HeartbeatResponse;
		runnerId = await acceptHeartbeatCaches(data, request, credentialId, apiBase, token, runnerId);
		console.log(`[Jobs] Received ${data.jobs?.length || 0} jobs.`);
		for (const entry of freeControllers.values()) if (entry.runnerId === runnerId) entry.controller.confirm(data.acceptedExecutions ?? []);
		for (const job of data.jobs ?? []) {
			if (job.admissionId || job.lease) {
				runnerId = await processExecutionHeartbeatJob(job, request, credentialId, apiBase, token, runnerId);
			} else await processHeartbeatJob(job, apiBase, token);
		}
		return "ok";
	} catch (error) {
		console.error(`[Error] Failed to poll heartbeat:`, error);
		return "retry";
	}
}

async function initializeRunner(args: string[]): Promise<{ apiBase: string; token: string; runnerId?: string }> {
	const tokenArgIndex = args.indexOf("--token");
	let token = tokenArgIndex !== -1 ? args[tokenArgIndex + 1] : undefined;
	const urlArgIndex = args.findIndex((arg) => arg === "--url" || arg === "--api" || arg === "--api-url");
	const inlineUrlArg = args.find((arg) => arg.startsWith("--api-url="));
	const overrideUrl = inlineUrlArg ? inlineUrlArg.slice("--api-url=".length) : urlArgIndex !== -1 ? args[urlArgIndex + 1] : undefined;

	const savedConfig = await loadCredentials();
	const localConfig: RunnerCredentials = {
		runnerId: savedConfig.runnerId,
		apiBase: savedConfig.apiBase,
		token: savedConfig.token,
	};

	let apiBase: string;
	try {
		apiBase = resolveApiBase({
			overrideUrl,
			localApiBase: localConfig.apiBase,
			hasLocalToken: Boolean(localConfig.token),
		});
	} catch (error) {
		if (error instanceof RunnerConfigurationError) {
			console.error("\n==========================================================================");
			console.error("[FATAL ERROR] Runner setup is incomplete.");
			console.error("Please download a fresh runner from your Clipify dashboard and run that file.");
			console.error("If this keeps happening, contact Clipify support.");
			console.error("==========================================================================\n");
			process.exit(1);
		}
		throw error;
	}

	if (!token) {
		token = localConfig.token;
	}

	if (!token) {
		token = process.env.CLIPIFY_TOKEN;
	}

	if (!token) {
		try {
			const enrolledConfig = await enrollRunner(apiBase, localConfig.runnerId);
			localConfig.runnerId = enrolledConfig.runnerId;
			localConfig.apiBase = enrolledConfig.apiBase;
			localConfig.token = enrolledConfig.token;
			apiBase = enrolledConfig.apiBase;
			token = enrolledConfig.token;
		} catch (error) {
			console.error("\n==========================================================================");
			console.error("[FATAL ERROR] Runner enrollment failed.");
			console.error(error);
			console.error("==========================================================================\n");
			process.exit(1);
		}
	}

	if (!token) {
		console.error("[FATAL ERROR] Missing Runner Token after enrollment.");
		process.exit(1);
	}

	const runnerToken = token;

	if (!localConfig.token || localConfig.token !== runnerToken) {
		// Save manually provided token
		await saveCredentials({
			runnerId: localConfig.runnerId,
			apiBase: apiBase,
			token: runnerToken,
		});
	}

	return { apiBase, token: runnerToken, runnerId: localConfig.runnerId };
}

async function stopActiveEngines() {
	await Promise.all(Array.from(freeControllers.values()).map((entry) => entry.controller.stopAll()));
	freeControllers.clear();
	const engines = Object.entries(activeEngines);
	await Promise.all(
		engines.map(async ([id, engine]) => {
			try {
				await engine.stop();
			} catch (error) {
				console.error(`[Runner] Failed to stop engine ${id} during re-enrollment:`, error);
			}
			delete activeEngines[id];
			delete actualStates[id];
		}),
	);
	await stopRtmpProxyIfUnused();
}

let shutdownPromise: Promise<void> | null = null;

function shutdownRunner(reason: string, logReason = true) {
	if (shutdownPromise) return shutdownPromise;

	shutdownPromise = (async () => {
		if (logReason) console.log(`[Runner] Shutting down (${reason})...`);
		const forceExitTimer = setTimeout(() => process.exit(1), 305_000);
		forceExitTimer.unref?.();
		try {
			await stopActiveEngines();
		} catch (error) {
			console.error("[Runner] Shutdown cleanup failed:", error);
		} finally {
			clearTimeout(forceExitTimer);
			process.exit(0);
		}
	})();

	return shutdownPromise;
}

function installShutdownHandlers() {
	const shutdownSignals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
	if (process.platform === "win32") shutdownSignals.push("SIGBREAK");
	for (const signal of shutdownSignals) {
		process.once(signal, () => void shutdownRunner(signal));
	}

	const handleConsoleError = (error: NodeJS.ErrnoException) => {
		if (error.code === "EPIPE") void shutdownRunner("console disconnected", false);
	};
	process.stdout.on("error", handleConsoleError);
	process.stderr.on("error", handleConsoleError);
}

async function main() {
	installShutdownHandlers();
	if (process.argv.includes("--self-test")) {
		console.log("Clipify Runner self-test passed");
		process.exit(0);
	}

	const directory = join(os.homedir(), ".clipify-runner");
	await acquireRunnerInstance(directory);
	const recovered = await recoverInterruptedExecutions(directory);
	for (const admissionId of recovered) closedOnRestart.add(admissionId);
	if (recovered.size) console.log(`[Runner] Closed interrupted outputs; reconciling ${recovered.size} broadcasts.`);

	const oldVersionCleanup = cleanupOldVersions();
	await Promise.race([oldVersionCleanup, sleep(5_000)]);
	void oldVersionCleanup;

	getTerminalCredentials();
	startExecutionWatchdog();
	let { apiBase, token, runnerId } = await initializeRunner(process.argv.slice(2));
	ConsoleUI.init();

	console.log("==========================================");
	console.log(`=       Clipify Runner (${RUNNER_VERSION.substring(0, 8)})        =`);
	console.log("==========================================");

	console.log(`[Info] Token loaded. API Base URL is ${apiBase}. Starting polling loop...`);

	let connectionStatus = "Connection: Connecting 🟡";
	// Update UI real-time
	setInterval(() => {
		const pinned = [connectionStatus, `Jobs Active: ${Object.keys(activeEngines).length}`];
		for (const [id, engine] of Object.entries(activeEngines)) {
			pinned.push(`- Engine [${id.substring(0, 8)}]: Mode=${engine.mode}, FFmpeg=${engine.ffmpegStatus}`);
		}
		ConsoleUI.setPinned(pinned);
	}, 1000);

	const runnerArgs = process.argv.slice(2);
	let heartbeatFailures = 0;
	let startupPrepared = false;
	while (true) {
		const heartbeatStatus = await pollHeartbeat(token, apiBase, runnerId);
		connectionStatus = heartbeatStatus === "ok" ? "Connection: Online 🟢" : heartbeatStatus === "reauth" ? "Connection: Reconnecting 🟡" : "Connection: Offline 🔴";
		if (heartbeatStatus === "reauth") {
			await stopActiveEngines();
			const reauthenticated = await initializeRunner([...runnerArgs, "--api-url", apiBase]);
			apiBase = reauthenticated.apiBase;
			token = reauthenticated.token;
			runnerId = reauthenticated.runnerId;
			heartbeatFailures = 0;
			console.log(`[Info] Re-enrollment complete. API Base URL is ${apiBase}.`);
			continue;
		}
		if (heartbeatStatus === "ok" && !startupPrepared) {
			startupPrepared = true;
			RUNNER_VERSION = await checkForUpdates(apiBase);
			void ensureDependencies().catch(() => console.warn("[Runner] Dependency preparation failed; the next broadcast start will retry."));
		}
		if (heartbeatStatus === "retry") {
			heartbeatFailures += 1;
			const retryDelayMs = Math.min(120_000, 10_000 * 2 ** Math.min(heartbeatFailures - 1, 3));
			console.warn(`[Heartbeat] Retrying in ${retryDelayMs / 1000}s.`);
			await sleep(retryDelayMs);
		} else {
			heartbeatFailures = 0;
			await sleep(10 * 1000);
		}
	}
}

main().catch(console.error);
