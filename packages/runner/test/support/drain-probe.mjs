import { createServer } from "node:http";
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, statSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import { nativeChromePath } from "./native-media.mjs";
import { prepareNativeTestShims } from "./native-test-shims.mjs";
import { observeColdRestart } from "./observe-cold-restart.mjs";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../package.json", import.meta.url));
const chrome = nativeChromePath();
const ffmpeg = process.env.RUNNER_FFMPEG_PATH || "ffmpeg";
const directory = mkdtempSync(join(tmpdir(), "clipify-drain-"));
const cache = join(packageRoot, "node_modules/.cache/clipify-native-tests");
mkdirSync(cache, { recursive: true });
const compiled = mkdtempSync(join(cache, "drain-"));
const events = [];
const outputSignals = [];
let outputExit = null,
	lastEncoderProgress = "";
const standbyAtEnd = process.env.CLIPIFY_TEST_STANDBY_AT_END === "1";
const controlConnectionFails = process.env.CLIPIFY_TEST_SCHEDULE_CONTROL_FAILURE === "1";
let controlFailureStatus,
	liveAfterControlFailure = false,
	controlFailureCalls = 0;
const exactEnd = process.env.CLIPIFY_TEST_EXACT_END === "1";
const beforeEndAdvance = process.env.CLIPIFY_TEST_BEFORE_END_ADVANCE === "1";
const pauseStalledBoundary = process.env.CLIPIFY_TEST_SCHEDULE_PAUSE_STALLED === "1";
const pauseExactBoundary = process.env.CLIPIFY_TEST_SCHEDULE_PAUSE_EXACT === "1";
const pauseScheduledAutomation = process.env.CLIPIFY_TEST_SCHEDULE_PAUSE === "1" || pauseExactBoundary || pauseStalledBoundary;
const lateScheduleContinuation = process.env.CLIPIFY_TEST_SCHEDULE_LATE_CONTINUITY === "1";
let expandFutureSchedule;
let futureCacheAccepted;
const sameSessionContinuity = process.env.CLIPIFY_TEST_SCHEDULE_SAME_SESSION === "1" || lateScheduleContinuation;
const continuousSchedule = process.env.CLIPIFY_TEST_SCHEDULE_CONTINUITY === "1" || sameSessionContinuity || pauseScheduledAutomation;
const expiredHandoff = process.env.CLIPIFY_TEST_SCHEDULE_HANDOFF_EXPIRED === "1";
const sourceHandoff = process.env.CLIPIFY_TEST_SCHEDULE_SOURCE_HANDOFF === "1";
const scheduledHandoff = process.env.CLIPIFY_TEST_SCHEDULE_HANDOFF === "1" || expiredHandoff || continuousSchedule || sourceHandoff;
let outputStarts = 0,
	boundaryUtc;
const expiredReturn = process.env.CLIPIFY_TEST_SCHEDULE_EXPIRED_RETURN;
const explicitResumeRestart = process.env.CLIPIFY_TEST_SCHEDULE_OWNER_RESUME === "1";
let resumeCurrentOccurrence;
const weeklyOfflineReturn = process.env.CLIPIFY_TEST_SCHEDULE_WEEKLY_RETURN === "1" || expiredReturn !== undefined;
let weeklyAuthority;
const coldRestart = process.env.CLIPIFY_TEST_SCHEDULE_COLD_RESTART === "1";
let coldRestartSpec;
const replayStoppedOccurrence = process.env.CLIPIFY_TEST_SCHEDULE_STOP_ALIAS === "1";
const manualScheduledStop = process.env.CLIPIFY_TEST_SCHEDULE_MANUAL_STOP === "1" || replayStoppedOccurrence || weeklyOfflineReturn || explicitResumeRestart;
const scheduledWatchdog = process.env.CLIPIFY_TEST_SCHEDULE_WATCHDOG === "1" || scheduledHandoff || manualScheduledStop || coldRestart || controlConnectionFails;
let replayStoppedCache,
	aliasCacheAccepted = false;
let pauseCache,
	pauseAccepted = false,
	pausedCacheEmpty = false,
	currentRemainedLiveBeforeEnd = false,
	futureMemberActivated = false;
let rendererDeadlineObservation;
let nativeDeadlineObservation;
let prematureNativeTickStayedLive;
let deadlineUpdateHeld = false;
let scheduleRestoreReads = 0,
	manualStopAccepted = false,
	manualSuppressed = false,
	manualClosed = false,
	stoppedInsideWindow = false,
	restartedAfterStop = false;
let nextSessionId, nextAdmissionId, nextExecutionGeneration, nextOutput, scheduleCli, nextOverlayId;
let nextSourceLoaded = false;
let nextOccurrenceClosedUnused = false;
let handoffReleaseAfter = Infinity;
let nextExecutionBeforeClipEnd = false;
let nextOutputOpened = false,
	nextOutputBeforeClipEnd = false;
const extraEngines = new Set();
let watchdogTimer, startDelayMs;
const maximumOverrun = process.env.CLIPIFY_TEST_MAXIMUM_OVERRUN === "1";
const playbackTimeout = process.env.CLIPIFY_TEST_PLAYBACK_TIMEOUT === "1";
const cachedSchedule = process.env.CLIPIFY_TEST_CACHED_SCHEDULE === "1" || scheduledWatchdog || standbyAtEnd;
const freeExecution = process.env.CLIPIFY_TEST_FREE_EXECUTION === "1" || cachedSchedule;
let cacheStored = false,
	cacheRestored = false,
	rejectedBeforeStart = false;
const unlimitedHours = process.env.CLIPIFY_TEST_UNLIMITED_HOURS === "1";
let renewConnectedTime;
let connectedRenewals = 0,
	continuedWithFreshLeases = false,
	monthBoundaryCrossed = false;
const executionGeneration = freeExecution ? randomUUID() : "fixture-generation";
let runtimeAccepted = false;
let finalMarkerCaptured = false;
let lifecycleController, executionRequest, executionJournal, executionJob;
let clockRate = 1;
let clockOffset = 0,
	runtimeExpired = false;
const leaseClock = () => performance.now() * clockRate + clockOffset;
const expireDuringCapture = process.env.CLIPIFY_TEST_EXPIRE_DURING_CAPTURE === "1";
let encoderOpened = false,
	outputPermission = () => true;
let engine, server, replaySpec;
try {
	const clip = join(directory, "clip.mp4");
	execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=15", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", maximumOverrun ? "360" : "12", "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=lime:t=fill:enable='gte(t,11.5)'", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", clip], { timeout: 15000 });
	const { dependencies, os } = prepareNativeTestShims(compiled, { chromePath: chrome, ffmpegPath: ffmpeg, home: directory });
	await build({
		entryPoints: [join(packageRoot, "src/engine.ts")],
		outfile: join(compiled, "engine.mjs"),
		platform: "node",
		target: "node24",
		format: "esm",
		bundle: true,
		packages: "external",
		plugins: [
			{
				name: "isolated-installed-media-dependencies",
				setup(builder) {
					builder.onResolve({ filter: /^\.\/downloader$/ }, () => ({ path: dependencies }));
					builder.onResolve({ filter: /^os$/ }, () => ({ path: os }));
				},
			},
		],
	});
	// The actual production browser bridge is served once its behavior is implemented.
	const presentation = join(packageRoot, "src/presentation.ts");
	let bridge = "export const createPlaybackDrain=undefined;";
	if (existsSync(presentation)) {
		const bundle = await build({ entryPoints: [presentation], platform: "browser", format: "esm", bundle: true, write: false });
		bridge = bundle.outputFiles[0].text;
	}
	const html = `<!doctype html><html><body style="margin:0;background:black"><span hidden data-runner-content-phase="standby" data-runner-content-epoch="0" data-runner-content-id="fixture-clip"></span><video id="clip" src="/clip.mp4?index=0" style="width:100vw;height:100vh"></video><script type="module">
 import {createPlaybackDrain} from '/bridge.mjs';
 const video=document.querySelector('video');let index=0,draining=false,heldMarker=-1,releasedMarker=-1;
 const generation=window.__clipifyRunnerExecution?.generation??${JSON.stringify(executionGeneration)};
 const originalWindowDeadline=window.__clipifyRunnerExecution?.deadlineMonotonic-60000;window.fixtureOriginalWindowDeadline=originalWindowDeadline;
 const notify=(kind)=>fetch('/event',{method:'POST',body:JSON.stringify({kind,generation,index,time:video.currentTime,duration:video.duration})});
 const bridge=typeof createPlaybackDrain==='function'?createPlaybackDrain({generation,...( ${pauseExactBoundary} ? {deadlineMonotonic:window.__clipifyRunnerExecution?.deadlineMonotonic,now:()=>window.fixtureDeadlineClock??performance.now()} : ${exactEnd} ? {deadlineMonotonic:1000,now:()=>window.fixtureDeadlineClock??0} : {}),readClips:()=>[{id:String(index),time:video.currentTime,duration:video.duration,started:!window.fixtureStandby&&video.currentTime>0,ended:video.ended}],preventNext:()=>{draining=true;}}):null;
 if(bridge){const requestDrain=bridge.requestDrain.bind(bridge);bridge.requestDrain=(generation)=>{notify('drain_requested');return requestDrain(generation);};window.clipifyRunnerPresentation=bridge;}
 const fixtureContent=document.querySelector('[data-runner-content-phase]');let fixtureAudio;window.startRunnerPlayback=()=>{fixtureContent.dataset.runnerContentEpoch=String(Number(fixtureContent.dataset.runnerContentEpoch)+1);fixtureContent.dataset.runnerContentPhase='playback';fixtureContent.dataset.runnerContentId=String(index);if(!fixtureAudio){fixtureAudio=new AudioContext();const oscillator=fixtureAudio.createOscillator(),gain=fixtureAudio.createGain();gain.gain.value=0.01;oscillator.connect(gain).connect(fixtureAudio.destination);oscillator.start();}fixtureAudio.resume();video.play();};window.startFallback=window.startRunnerPlayback;window.stopFallback=()=>{video.pause();fixtureContent.dataset.runnerContentEpoch=String(Number(fixtureContent.dataset.runnerContentEpoch)+1);fixtureContent.dataset.runnerContentPhase='standby';};
 // Synchronize the short marker with real FFmpeg output rather than assuming
 // a busy display-capture pipeline samples every half-second window.
 const frame=(now,metadata)=>{if(!${maximumOverrun}&&metadata.mediaTime>=11.5&&heldMarker!==index&&releasedMarker!==index&&!video.ended){heldMarker=index;video.pause();notify('marker_hold');}video.requestVideoFrameCallback(frame);};
 video.requestVideoFrameCallback(frame);
 window.releaseFinalMarker=()=>{if(${playbackTimeout}||(${exactEnd}&&!window.fixtureExactArmed))return false;if((!draining&&!${beforeEndAdvance}&&!${exactEnd}&&!${continuousSchedule})||heldMarker!==index||releasedMarker===index)return false;releasedMarker=index;video.play();return true;};
 video.addEventListener('playing',()=>notify('started'));
 video.addEventListener('ended',async()=>{if(releasedMarker!==index){heldMarker=index;video.currentTime=video.duration-1/15;video.pause();notify('marker_hold');return;}await notify('ended');if(${pauseExactBoundary})window.fixtureDeadlineClock=originalWindowDeadline;if(${exactEnd})window.fixtureDeadlineClock=1000;bridge?.notifyEnded(String(index));if(!draining&&(bridge?.canAdvance()??true)){index++;video.src='/clip.mp4?index='+index;await video.play();}if(${exactEnd}||${pauseExactBoundary})await notify('boundary_evaluated');});
 </script></body></html>`;
	const presentationAssignments = new Map();
	const presentationCredentials = new Map();
	const registerPresentation = (job) => presentationAssignments.set(job.executionGeneration, { sessionId: job.id, sourceId: job.overlayId });
	async function bootstrapPresentation(request, response) {
		let body = "";
		for await (const chunk of request) body += chunk;
		const input = JSON.parse(body);
		const assignment = presentationAssignments.get(input.executionGeneration);
		if (request.method !== "POST" || request.headers.authorization !== "Bearer fixture-token" || !assignment || assignment.sessionId !== input.sessionId) {
			response.statusCode = 403;
			response.end(JSON.stringify({ error: "PRESENTATION_UNAVAILABLE" }));
			return;
		}
		const path = `/runner/presentation/${input.sessionId}`;
		const token = `fixture-presentation-${input.executionGeneration}`;
		presentationCredentials.set(token, { ...assignment, generation: input.executionGeneration });
		response.setHeader("Set-Cookie", `clipify_runner_presentation=${token}; Path=${path}; HttpOnly; SameSite=Strict`);
		response.setHeader("Content-Type", "application/json");
		response.end(JSON.stringify({ url: path, expiresAt: Date.now() + 600000 }));
		return;
	}
	function servePresentation(request, response) {
		const token = request.headers.cookie
			?.split(";")
			.map((value) => value.trim())
			.find((value) => value.startsWith("clipify_runner_presentation="))
			?.slice("clipify_runner_presentation=".length);
		const presentation = presentationCredentials.get(token);
		if (!presentation || request.url !== `/runner/presentation/${presentation.sessionId}`) {
			response.statusCode = 403;
			response.end("Presentation unavailable");
			return;
		}
		response.setHeader("Content-Type", "text/html");
		response.end(html.replace("<body style=", `<body data-runner-presentation-generation="${presentation.generation}" data-runner-layout-status="clean" data-fixture-source-id="${presentation.sourceId}" style=`));
		return;
	}
	async function observePreview(request, response) {
		let body = "";
		for await (const chunk of request) body += chunk;
		try {
			const jpeg = Buffer.from(JSON.parse(body).image.split(",")[1], "base64");
			const rgb = execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-vf", "scale=1:1:flags=area", "-pix_fmt", "rgb24", "-frames:v", "1", "-f", "rawvideo", "pipe:1"], { input: jpeg, timeout: 10000 });
			if (rgb[1] > 150 && rgb[0] < 80 && rgb[2] < 80 && (!scheduledHandoff || Date.now() >= handoffReleaseAfter)) finalMarkerCaptured = (await engine?.page?.evaluate(() => window.releaseFinalMarker())) === true;
		} catch {
			/* A partially written preview is retried on the next actual upload. */
		}
		response.end("{}");
		return;
	}
	server = createServer(async (request, response) => {
		if (request.url === "/api/runner/presentation") return await bootstrapPresentation(request, response);
		if (request.url.startsWith("/runner/presentation/")) return servePresentation(request, response);
		if (request.url.startsWith("/clip.mp4")) {
			response.setHeader("Content-Type", "video/mp4");
			response.end(readFileSync(clip));
			return;
		}
		if (request.url === "/bridge.mjs") {
			response.setHeader("Content-Type", "text/javascript");
			response.end(bridge);
			return;
		}
		if (request.url === "/event") {
			let body = "";
			for await (const chunk of request) body += chunk;
			events.push(JSON.parse(body));
			response.end("ok");
			return;
		}
		if (request.url === "/api/runner/preview" && (!finalMarkerCaptured || beforeEndAdvance || continuousSchedule)) return await observePreview(request, response);
		if (request.url === "/api/runner/heartbeat" && controlConnectionFails) {
			controlFailureCalls++;
			response.statusCode = 503;
			response.end("{}");
			return;
		}
		if (request.url.startsWith("/api/")) {
			response.end("{}");
			return;
		}
		response.setHeader("Content-Type", "text/html");
		response.end(html);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const observedProcesses = require("node:child_process"),
		originalSpawn = observedProcesses.spawn;
	observedProcesses.spawn = (...args) => {
		const child = originalSpawn(...args);
		if (scheduledHandoff && nextOutput && args[1]?.includes(nextOutput)) {
			nextOutputOpened = true;
			nextOutputBeforeClipEnd = !events.some((event) => event.kind === "ended" && event.generation === executionGeneration);
		}
		if (args[1]?.some((arg) => typeof arg === "string" && (arg.includes(join(directory, "broadcast.flv")) || arg.includes(join(directory, "replay.flv"))))) {
			outputStarts++;
			const kill = child.kill;
			child.kill = function (...signals) {
				outputSignals.push(signals[0]);
				return kill.apply(this, signals);
			};
			child.on("close", (code, signal) => {
				outputExit = { code, signal };
			});
			child.stderr.on("data", (data) => {
				if (data.toString().includes("bitrate=")) lastEncoderProgress = data.toString().trim();
			});
		}
		return child;
	};
	syncBuiltinESMExports();

	if (expireDuringCapture) {
		const capture = require("puppeteer-stream"),
			getStream = capture.getStream;
		capture.getStream = async (...args) => {
			const stream = await getStream(...args);
			clockOffset = executionRequest.sentAt + 300000 - performance.now();
			return stream;
		};
		const childProcess = require("node:child_process"),
			spawn = childProcess.spawn;
		childProcess.spawn = (...args) => {
			if (args[1]?.includes(join(directory, "broadcast.flv"))) encoderOpened = true;
			return spawn(...args);
		};
		syncBuiltinESMExports();
	}
	if (process.env.CLIPIFY_TEST_CAPTURE_DIAGNOSTIC === "1") {
		const capture = require("puppeteer-stream");
		const original = capture.launch;
		capture.launch = (...args) => original(...(typeof args[0]?.launch === "function" ? [args[0], { ...args[1], dumpio: true }] : [{ ...args[0], dumpio: true }]));
	}

	if (process.env.CLIPIFY_TEST_SLOW_EXTENSION_INSTALL === "1") {
		const captureRequire = createRequire(require.resolve("puppeteer-stream"));
		const { CdpBrowser } = captureRequire("puppeteer-core/lib/cjs/puppeteer/cdp/Browser.js");
		const install = CdpBrowser.prototype.installExtension;
		CdpBrowser.prototype.installExtension = async function (...args) {
			await new Promise((resolve) => setTimeout(resolve, 1500));
			return install.apply(this, args);
		};
	}
	const { Engine } = await import(new URL(`file://${join(compiled, "engine.mjs")}`));
	const output = join(directory, "broadcast.flv");

	const overlayId = freeExecution ? randomUUID() : "fixture-drain";
	engine = new Engine(overlayId, output, "fixture-secret", "", 15, "720p", "24_7", `http://127.0.0.1:${server.address().port}`, "fixture-token", { executionGeneration, now: freeExecution || playbackTimeout || maximumOverrun ? leaseClock : undefined, mayOpenOutput: () => outputPermission() });
	if (freeExecution && existsSync(join(packageRoot, "src/execution-runtime.ts"))) {
		const entry = join(compiled, "runtime-entry.mjs");
		writeFileSync(entry, `export {FreeExecutionController} from ${JSON.stringify(join(packageRoot, "src/execution-runtime.ts"))};export {ExecutionJournal} from ${JSON.stringify(join(packageRoot, "src/execution-journal.ts"))};export {RunnerScheduleCache} from ${JSON.stringify(join(packageRoot, "src/schedule-cache.ts"))};`);
		await build({ entryPoints: [entry], outfile: join(compiled, "runtime.mjs"), platform: "node", format: "esm", bundle: true, packages: "external" });
		const { FreeExecutionController, ExecutionJournal, RunnerScheduleCache } = await import(new URL(`file://${join(compiled, "runtime.mjs")}`));
		const { privateKey, publicKey } = generateKeyPairSync("ed25519");
		const signingKeyId = createHash("sha256")
			.update(publicKey.export({ type: "spki", format: "der" }))
			.digest("hex")
			.slice(0, 16);
		const ownerId = "fixture-creator",
			runnerId = randomUUID(),
			sessionId = randomUUID(),
			admissionId = randomUUID(),
			leaseId = randomUUID();
		const request = { requestId: randomUUID(), sentAt: performance.now() };
		const targetHash = createHash("sha256")
			.update(JSON.stringify([{ id: sessionId, rtmpUrl: output, credential: null }]))
			.digest("hex");
		const issuedAt = unlimitedHours ? Date.UTC(2026, 9, 31, 23, 58) : continuousSchedule ? Date.UTC(2027, 0, 3, 23, 59) : 1000000;
		if (continuousSchedule) boundaryUtc = new Date(issuedAt + 60000).toISOString();
		const claims = { issuer: "clipify.us", kind: "execution", policy: "free_lease", sourceId: overlayId, ownerId, runnerId, sessionId, admissionId, leaseId, generation: executionGeneration, configurationRevision: 2, sourceRevision: 1, targetHash, requestId: request.requestId, issuedAt, expiresAt: issuedAt + 300000 };
		if (cachedSchedule)
			Object.assign(claims, {
				kind: "scheduled_execution",
				policy: "pro_broadcast",
				cacheAuthorization: true,
				occurrenceId: '["media-event","original"]',
				scheduledStart: issuedAt + 5000,
				scheduledEnd: issuedAt + (explicitResumeRestart ? 120000 : 60000),
				expiresAt: issuedAt + 604800000,
				executionPayloadHash: createHash("sha256")
					.update(JSON.stringify({ sourceId: overlayId, sourceCredential: createHash("sha256").update("fixture-secret").digest("hex"), mode: "24/7", fps: 15, resolution: "720p", targetHash }))
					.digest("hex"),
			});
		const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
		const lease = { keyId: signingKeyId, payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") };
		const job = { id: sessionId, ownerId, runnerId, admissionId, executionGeneration, configurationRevision: 2, sourceRevision: 1, targetHash, overlayId, overlaySecret: "fixture-secret", rtmpUrl: output, streamKey: null, mode: "24/7", fps: 15, resolution: "720p", desiredState: "running", lease };
		registerPresentation(job);
		executionJob = job;
		executionJournal = new ExecutionJournal(join(directory, "journal"));
		lifecycleController = new FreeExecutionController({
			ownerId,
			runnerId,
			journal: executionJournal,
			clock: leaseClock,
			keys: { [signingKeyId]: publicKey.export({ type: "spki", format: "pem" }).toString() },
			createEngine: (_job, policy) => {
				outputPermission = policy?.mayOpenOutput ?? (() => true);
				return engine;
			},
		});
		executionRequest = request;
		if (cachedSchedule) {
			Object.assign(job, { cacheAuthorization: true, occurrenceId: claims.occurrenceId, scheduledStart: claims.scheduledStart, scheduledEnd: claims.scheduledEnd });
			const cachedJobs = [job];
			if (scheduledHandoff) {
				nextSessionId = sameSessionContinuity ? sessionId : randomUUID();
				nextOverlayId = sourceHandoff ? randomUUID() : overlayId;
				nextExecutionGeneration = randomUUID();
				nextOutput = continuousSchedule ? output : join(directory, "following.flv");
				const nextTargetHash = continuousSchedule
					? targetHash
					: createHash("sha256")
							.update(JSON.stringify([{ id: nextSessionId, rtmpUrl: nextOutput, credential: null }]))
							.digest("hex");
				const nextClaims = {
					...claims,
					sessionId: nextSessionId,
					admissionId: randomUUID(),
					leaseId: randomUUID(),
					generation: nextExecutionGeneration,
					targetHash: nextTargetHash,
					sourceId: nextOverlayId,
					occurrenceId: '["following-event","original"]',
					scheduledStart: claims.scheduledEnd,
					scheduledEnd: claims.scheduledEnd + (expiredHandoff ? 2000 : 60000),
					executionPayloadHash: createHash("sha256")
						.update(JSON.stringify({ sourceId: nextOverlayId, sourceCredential: createHash("sha256").update("fixture-secret").digest("hex"), mode: "24/7", fps: 15, resolution: "720p", targetHash: nextTargetHash }))
						.digest("hex"),
				};
				nextAdmissionId = nextClaims.admissionId;
				const nextPayload = Buffer.from(JSON.stringify(nextClaims)).toString("base64url");
				cachedJobs.push({
					...job,
					...(continuousSchedule ? { destinations: [{ id: sessionId, rtmpUrl: output, streamKey: null }] } : {}),
					id: nextSessionId,
					overlayId: nextOverlayId,
					admissionId: nextClaims.admissionId,
					executionGeneration: nextExecutionGeneration,
					targetHash: nextTargetHash,
					rtmpUrl: nextOutput,
					occurrenceId: nextClaims.occurrenceId,
					scheduledStart: nextClaims.scheduledStart,
					scheduledEnd: nextClaims.scheduledEnd,
					lease: { keyId: signingKeyId, payload: nextPayload, signature: sign(null, Buffer.from(nextPayload), privateKey).toString("base64url") },
				});
			}
			const initialJobs = lateScheduleContinuation ? [job] : cachedJobs;
			const policy = { runnerPro: true, scheduling: true, validUntil: null };
			cachedJobs.forEach(registerPresentation);
			const manifest = { issuer: "clipify.us", kind: "schedule_cache", version: 1, ownerId, runnerId, requestId: request.requestId, configurationRevision: 2, issuedAt, expiresAt: claims.expiresAt, capabilities: policy, entries: initialJobs.map((entry) => ({ admissionId: entry.admissionId, occurrenceId: entry.occurrenceId, authorizationHash: createHash("sha256").update(entry.lease.payload).digest("hex") })) };
			const document = Buffer.from(JSON.stringify(manifest)).toString("base64url");
			const options = {
				directory: join(directory, "schedule"),
				runnerId,
				ownerId,
				keys: { [signingKeyId]: publicKey.export({ type: "spki", format: "pem" }).toString() },
				clock: leaseClock,
				uptime: leaseClock,
				bootId: () => "isolated-media-boot",
				keyring: {
					set: async () => {
						throw new Error("FIXTURE_KEYRING_UNAVAILABLE");
					},
					get: async () => null,
				},
			};
			coldRestartSpec = { packageRoot, runtimePath: join(compiled, "runtime.mjs"), cliPath: join(compiled, "schedule-cli.mjs"), cache: { directory: options.directory, ownerId, runnerId, keys: options.keys }, output, sessionId, admissionId, generation: executionGeneration, originalEnd: claims.scheduledEnd, parentPid: process.pid, apiBase: `http://127.0.0.1:${server.address().port}` };
			cacheStored = await new RunnerScheduleCache(options).accept({ bundle: { keyId: signingKeyId, payload: document, signature: sign(null, Buffer.from(document), privateKey).toString("base64url") }, entries: initialJobs.map((job) => ({ job })) }, request);
			if (!cacheStored) throw new Error("SIGNED_MEDIA_CACHE_REJECTED");
			const restoredStore = new RunnerScheduleCache(options);
			if (lateScheduleContinuation)
				expandFutureSchedule = async () => {
					const refreshRequest = { requestId: randomUUID(), sentAt: leaseClock() };
					const refreshIssuedAt = Math.floor(issuedAt + refreshRequest.sentAt - request.sentAt);
					const entries = cachedJobs.map((job) => {
						const previous = JSON.parse(Buffer.from(job.lease.payload, "base64url").toString());
						const payload = Buffer.from(JSON.stringify({ ...previous, requestId: refreshRequest.requestId, issuedAt: refreshIssuedAt })).toString("base64url");
						return { job: { ...job, lease: { keyId: signingKeyId, payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") } } };
					});
					const refreshed = { ...manifest, requestId: refreshRequest.requestId, issuedAt: refreshIssuedAt, entries: entries.map(({ job }) => ({ admissionId: job.admissionId, occurrenceId: job.occurrenceId, authorizationHash: createHash("sha256").update(job.lease.payload).digest("hex") })) };
					const payload = Buffer.from(JSON.stringify(refreshed)).toString("base64url");
					return restoredStore.accept({ bundle: { keyId: signingKeyId, payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") }, entries }, refreshRequest);
				};

			if (pauseScheduledAutomation)
				pauseCache = async () => {
					const pauseRequest = { requestId: randomUUID(), sentAt: leaseClock() };
					const pausedManifest = { ...manifest, requestId: pauseRequest.requestId, configurationRevision: manifest.configurationRevision + 1, issuedAt: Math.floor(issuedAt + pauseRequest.sentAt - request.sentAt), entries: [] };
					const pausedDocument = Buffer.from(JSON.stringify(pausedManifest)).toString("base64url");
					return restoredStore.accept({ bundle: { keyId: signingKeyId, payload: pausedDocument, signature: sign(null, Buffer.from(pausedDocument), privateKey).toString("base64url") }, entries: [] }, pauseRequest);
				};

			replayStoppedCache = async () => {
				if (weeklyOfflineReturn) clockOffset += 6 * 86400000; // Refresh before going offline ahead of the next weekly occurrence.
				const aliasRequest = { requestId: randomUUID(), sentAt: leaseClock() };
				const aliasRtmpUrl = join(directory, "replay.flv");
				const aliasTargetHash = createHash("sha256")
					.update(JSON.stringify([{ id: sessionId, rtmpUrl: aliasRtmpUrl, credential: null }]))
					.digest("hex");
				const executionPayloadHash = createHash("sha256")
					.update(JSON.stringify({ sourceId: overlayId, sourceCredential: createHash("sha256").update("fixture-secret").digest("hex"), mode: "24/7", fps: 15, resolution: "720p", targetHash: aliasTargetHash }))
					.digest("hex");
				const aliasClaims = {
					...claims,
					...(weeklyOfflineReturn ? { occurrenceId: '["media-event","next-week"]', scheduledStart: claims.scheduledStart + 604800000, scheduledEnd: claims.scheduledEnd + 604800000, expiresAt: Math.floor(issuedAt + aliasRequest.sentAt - request.sentAt) + 604800000 } : {}),
					targetHash: aliasTargetHash,
					executionPayloadHash,
					admissionId: randomUUID(),
					generation: randomUUID(),
					leaseId: randomUUID(),
					configurationRevision: claims.configurationRevision + 1,
					requestId: aliasRequest.requestId,
					issuedAt: Math.floor(issuedAt + aliasRequest.sentAt - request.sentAt),
				};
				const aliasPayload = Buffer.from(JSON.stringify(aliasClaims)).toString("base64url");
				const aliasJob = { ...job, occurrenceId: aliasClaims.occurrenceId, scheduledStart: aliasClaims.scheduledStart, scheduledEnd: aliasClaims.scheduledEnd, rtmpUrl: aliasRtmpUrl, targetHash: aliasTargetHash, admissionId: aliasClaims.admissionId, executionGeneration: aliasClaims.generation, configurationRevision: aliasClaims.configurationRevision, lease: { keyId: signingKeyId, payload: aliasPayload, signature: sign(null, Buffer.from(aliasPayload), privateKey).toString("base64url") } };
				registerPresentation(aliasJob);
				const aliasManifest = { ...manifest, expiresAt: aliasClaims.expiresAt, requestId: aliasRequest.requestId, configurationRevision: manifest.configurationRevision + 1, issuedAt: aliasClaims.issuedAt, entries: [{ admissionId: aliasJob.admissionId, occurrenceId: aliasJob.occurrenceId, authorizationHash: createHash("sha256").update(aliasPayload).digest("hex") }] };
				const document = Buffer.from(JSON.stringify(aliasManifest)).toString("base64url");
				weeklyAuthority = { ...coldRestartSpec, admissionId: aliasJob.admissionId, generation: aliasJob.executionGeneration, originalEnd: aliasJob.scheduledEnd, output: aliasRtmpUrl, priorAdmissionId: admissionId, expectSkipped: expiredReturn !== undefined, clockAtRestart: request.sentAt + 604800000 + (expiredReturn !== undefined ? 60000 + (expiredReturn === "after_end" ? 1 : 0) : 15000) };
				return restoredStore.accept({ bundle: { keyId: signingKeyId, payload: document, signature: sign(null, Buffer.from(document), privateKey).toString("base64url") }, entries: [{ job: aliasJob }] }, aliasRequest);
			};

			resumeCurrentOccurrence = async () => {
				const resumeRequest = { requestId: randomUUID(), sentAt: leaseClock() };
				const resumeIssuedAt = Math.floor(issuedAt + resumeRequest.sentAt - request.sentAt);
				const ordinaryClaims = { ...claims, kind: "execution", cacheAuthorization: undefined, executionPayloadHash: undefined, admissionId: randomUUID(), generation: randomUUID(), leaseId: randomUUID(), configurationRevision: claims.configurationRevision + 2, requestId: resumeRequest.requestId, issuedAt: resumeIssuedAt, expiresAt: resumeIssuedAt + 300000 };
				const ordinaryPayload = Buffer.from(JSON.stringify(ordinaryClaims)).toString("base64url");
				const ordinaryJob = { ...job, cacheAuthorization: undefined, admissionId: ordinaryClaims.admissionId, executionGeneration: ordinaryClaims.generation, configurationRevision: ordinaryClaims.configurationRevision, lease: { keyId: signingKeyId, payload: ordinaryPayload, signature: sign(null, Buffer.from(ordinaryPayload), privateKey).toString("base64url") } };
				registerPresentation(ordinaryJob);
				const accepted = await lifecycleController.apply(ordinaryJob, resumeRequest);
				if (!accepted) throw new Error("OWNER_RESUME_ORDINARY_START_REJECTED");
				const cacheRequest = { requestId: randomUUID(), sentAt: leaseClock() };
				const cachedClaims = { ...ordinaryClaims, kind: "scheduled_execution", cacheAuthorization: true, executionPayloadHash: claims.executionPayloadHash, requestId: cacheRequest.requestId, issuedAt: Math.floor(issuedAt + cacheRequest.sentAt - request.sentAt), expiresAt: claims.expiresAt };
				const cachedPayload = Buffer.from(JSON.stringify(cachedClaims)).toString("base64url");
				const cachedJob = { ...ordinaryJob, cacheAuthorization: true, lease: { keyId: signingKeyId, payload: cachedPayload, signature: sign(null, Buffer.from(cachedPayload), privateKey).toString("base64url") } };
				const resumedManifest = { ...manifest, requestId: cacheRequest.requestId, issuedAt: cachedClaims.issuedAt, entries: [{ admissionId: cachedJob.admissionId, occurrenceId: cachedJob.occurrenceId, authorizationHash: createHash("sha256").update(cachedPayload).digest("hex") }] };
				const document = Buffer.from(JSON.stringify(resumedManifest)).toString("base64url");
				const cacheAccepted = await restoredStore.accept({ bundle: { keyId: signingKeyId, payload: document, signature: sign(null, Buffer.from(document), privateKey).toString("base64url") }, entries: [{ job: cachedJob }] }, cacheRequest);
				return { accepted, cacheAccepted, job: ordinaryJob, spec: { ...coldRestartSpec, admissionId: ordinaryJob.admissionId, generation: ordinaryJob.executionGeneration } };
			};

			const before = await restoredStore.restore();
			rejectedBeforeStart = before !== null && !(await lifecycleController.apply(before.jobs[0], before.request));
			if (scheduledWatchdog) {
				const logger = join(compiled, "logger.mjs"),
					keyring = join(compiled, "keyring.mjs"),
					clockModule = join(compiled, "clock.mjs");
				writeFileSync(logger, "export const ConsoleUI=new Proxy({},{get:()=>()=>{}})");
				writeFileSync(keyring, "export class Entry{constructor(){throw new Error('Isolated fixture keyring unavailable')}}");
				globalThis.__clipifyMediaClock = leaseClock;
				writeFileSync(clockModule, "export const executionNow=()=>globalThis.__clipifyMediaClock();");
				const source = readFileSync(join(packageRoot, "src/index.ts"), "utf8"),
					entry = "main().catch(console.error);";
				if (source.split(entry).length !== 2) throw new Error("Ambiguous CLI startup adapter");
				const adapted = source.replace(entry, "export {pollHeartbeat,startExecutionWatchdog,activeEngines,freeControllers,freeJournals,scheduleCaches,scheduleContexts,getFreeJournal,getFreeController};");
				if (adapted.slice(0, source.indexOf(entry)) !== source.slice(0, source.indexOf(entry))) throw new Error("CLI prefix changed");
				await build({
					stdin: { contents: adapted, sourcefile: join(packageRoot, "src/index.ts"), resolveDir: join(packageRoot, "src"), loader: "ts" },
					outfile: join(compiled, "schedule-cli.mjs"),
					platform: "node",
					target: "node24",
					format: "esm",
					bundle: true,
					packages: "external",
					plugins: [
						{
							name: "isolated-schedule-infrastructure",
							setup(builder) {
								builder.onResolve({ filter: /^\.\/(?:dependencies|downloader)$/ }, () => ({ path: dependencies }));
								builder.onResolve({ filter: /^(?:node:)?os$/ }, (args) => (args.importer === os ? { path: "node:os", external: true } : { path: os }));
								builder.onResolve({ filter: /^\.\/logger$/ }, () => ({ path: logger }));
								builder.onResolve({ filter: /^@napi-rs\/keyring$/ }, () => ({ path: keyring }));
								builder.onResolve({ filter: /^\.\/execution-clock$/ }, () => ({ path: clockModule }));
							},
						},
					],
				});
				process.env.RUNNER_EXECUTION_PUBLIC_KEYS = JSON.stringify(options.keys);
				const cli = await import(new URL(`file://${join(compiled, "schedule-cli.mjs")}`));
				scheduleCli = cli;
				if (manualScheduledStop || pauseScheduledAutomation || lateScheduleContinuation) {
					const restore = restoredStore.restore.bind(restoredStore);
					restoredStore.restore = async () => {
						scheduleRestoreReads++;
						return restore();
					};
				}
				cli.scheduleCaches.set("isolated-signed-cache", restoredStore);
				cli.scheduleContexts.set("isolated-signed-cache", { runnerId, apiBase: `http://127.0.0.1:${server.address().port}`, token: "fixture-token", busy: false });
				watchdogTimer = cli.startExecutionWatchdog();
				await new Promise((resolve) => setTimeout(resolve, 500));
				if (cli.scheduleContexts.get("isolated-signed-cache").warned) {
					const diagnostic = await restoredStore.restore();
					const journal = cli.getFreeJournal(runnerId);
					journal.closeUnusedOccurrences({ ownerId, runnerId }, diagnostic.serverTimeLower);
					cli.getFreeController(job, runnerId, `http://127.0.0.1:${server.address().port}`, "fixture-token");
					throw new Error("Watchdog fixture rejected before original window");
				}
				if (Object.keys(cli.activeEngines).length) throw new Error("Watchdog started before original window");
				clockOffset += 5000;
				const startDeadline = Date.now() + 30000;
				while (!cli.activeEngines[sessionId]?.ffmpeg || !cli.activeEngines[sessionId]?.mediaStream) {
					if (Date.now() >= startDeadline) throw new Error("Cached scheduled start missed thirty-second SLO");
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
				engine = cli.activeEngines[sessionId];
				startDelayMs = leaseClock() - (request.sentAt + 5000);
				lifecycleController = [...cli.freeControllers.values()][0].controller;
				executionJournal = cli.freeJournals.get(runnerId);
				runtimeAccepted = true;
				cacheRestored = true;
			} else {
				clockOffset += 5000;
				const restored = await restoredStore.restore();
				cacheRestored = restored !== null;
				if (!restored) throw new Error("SIGNED_MEDIA_CACHE_RESTORE_REJECTED");
				executionRequest = restored.request;
				runtimeAccepted = await lifecycleController.apply(restored.jobs[0], restored.request);
			}
		} else runtimeAccepted = await lifecycleController.apply(job, request);
		if (unlimitedHours)
			renewConnectedTime = async () => {
				const renewalStepMs = 240000;
				const renewalCount = 360;
				for (let index = 1; index <= renewalCount; index++) {
					clockOffset += renewalStepMs;
					await lifecycleController.tick();
					const renewal = { requestId: randomUUID(), sentAt: leaseClock() };
					const serverTime = issuedAt + index * renewalStepMs;
					const payload = Buffer.from(JSON.stringify({ ...claims, requestId: renewal.requestId, issuedAt: serverTime, expiresAt: serverTime + 300000 })).toString("base64url");
					const renewed = { ...job, lease: { keyId: signingKeyId, payload, signature: sign(null, Buffer.from(payload), privateKey).toString("base64url") } };
					if (!(await lifecycleController.apply(renewed, renewal))) throw new Error("Valid connected lease renewal rejected before the unlimited-hours horizon");
					connectedRenewals++;
				}
				continuedWithFreshLeases = engine.isRunning && outputPermission() && executionJournal.pendingTerminals().length === 0;
				monthBoundaryCrossed = new Date(issuedAt).getUTCMonth() !== new Date(issuedAt + renewalCount * renewalStepMs).getUTCMonth();
			};
		if (process.env.CLIPIFY_TEST_FREE_REPLAY === "1") replaySpec = { packageRoot, directory, runtimePath: join(compiled, "runtime.mjs"), enginePath: join(compiled, "engine.mjs"), job, keys: { [signingKeyId]: publicKey.export({ type: "spki", format: "pem" }).toString() }, apiBase: `http://127.0.0.1:${server.address().port}`, activeSnapshot: readFileSync(join(directory, "journal/execution-journal.json"), "utf8") };
	} else await engine.start();
	if (expireDuringCapture) {
		console.log(JSON.stringify({ runtimeAccepted, encoderOpened, allOutputsClosed: !engine.isRunning && !engine.ffmpeg && !engine.obsForwarder && !engine.browser && !engine.mediaStream, persistedClosed: executionJournal.pendingTerminals().some((receipt) => receipt.allOutputsClosed === true) }));
	} else {
		const page = engine.page;
		await page.waitForFunction(
			() => {
				const video = document.querySelector("video");
				return video && video.currentTime >= 1 && !video.ended;
			},
			{ timeout: 10000 },
		);
		const mediaDeadline = Date.now() + 20000;
		while (!existsSync(output) || statSync(output).size < 1024) {
			if (!engine.isRunning || Date.now() >= mediaDeadline) throw new Error("Real encoded output did not become ready before the drain precondition");
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		await page.waitForFunction(
			() => {
				const video = document.querySelector("video");
				return video.currentTime >= 1 && !video.ended;
			},
			{ timeout: 10000 },
		);
		if (renewConnectedTime) await renewConnectedTime();
		if (controlConnectionFails) {
			controlFailureStatus = await scheduleCli.pollHeartbeat("fixture-token", `http://127.0.0.1:${server.address().port}`, executionJob.runnerId);
			liveAfterControlFailure = engine.isRunning && !!engine.ffmpeg && !!engine.mediaStream;
		}
		if (beforeEndAdvance)
			await page.waitForFunction(
				() => {
					const video = document.querySelector("video");
					return Number(new URL(video.currentSrc || video.src).searchParams.get("index")) >= 1 && video.currentTime >= 1 && !video.ended;
				},
				{ timeout: 20000 },
			);
		const { timeAtStop, indexAtStop } = await page.evaluate(() => {
			const video = document.querySelector("video");
			return { timeAtStop: video.currentTime, indexAtStop: Number(new URL(video.currentSrc || video.src).searchParams.get("index") || 0) };
		});
		const stoppedDuringClip = timeAtStop >= 1 && timeAtStop < 12;

		if (explicitResumeRestart) {
			const originalStopped = await lifecycleController.stop(executionJob);
			if (!originalStopped) throw new Error("OWNER_RESUME_ORIGINAL_STOP_REJECTED");
			rmSync(output, { force: true });
			finalMarkerCaptured = false;
			const resumed = await resumeCurrentOccurrence();
			if (!resumed.cacheAccepted) throw new Error("OWNER_RESUME_SIGNED_CACHE_REJECTED");
			engine = scheduleCli.activeEngines[resumed.job.id];
			await engine.page.waitForFunction(() => document.querySelector("video")?.currentTime >= 1, { timeout: 10000 });
			if (!engine.ffmpeg || !engine.mediaStream) throw new Error("OWNER_RESUME_CAPTURE_NOT_READY");
			const record = executionJournal.get(resumed.job.admissionId);
			const resumeRecord = { state: record?.state, revision: record?.configurationRevision, occurrence: record?.occurrence };
			clearInterval(watchdogTimer);
			await engine.requestDrain(); // Close the physical capture without persisting a second owner Stop.
			if (!existsSync(output) || statSync(output).size < 1024) throw new Error("OWNER_RESUME_FRESH_MEDIA_NOT_ENCODED");
			rmSync(output, { force: true });
			const childResult = await observeColdRestart(directory, { ...resumed.spec, clockAtRestart: leaseClock() + 1000 });
			console.log(JSON.stringify({ originalStopped, ownerResumeAccepted: resumed.accepted, resumeCacheAccepted: resumed.cacheAccepted, resumeRecord, originalEnd: coldRestartSpec.originalEnd, resumedEnd: resumed.job.scheduledEnd, ownerOutputStarts: outputStarts, coldRestart: childResult }));
		} else if (weeklyOfflineReturn) {
			const stopped = await lifecycleController.stop(executionJob);
			clearInterval(watchdogTimer);
			const prior = executionJournal.get(executionJob.admissionId);
			if (!stopped || prior?.state !== "stopped" || prior.occurrence?.suppressed !== true) throw new Error("WEEKLY_RETURN_PRIOR_STOP_MISSING");
			const refreshedBeforeOffline = await replayStoppedCache();
			if (!refreshedBeforeOffline) throw new Error("WEEKLY_RETURN_FUTURE_CACHE_REJECTED");
			const childResult = await observeColdRestart(directory, weeklyAuthority);
			console.log(JSON.stringify({ refreshedBeforeOffline, priorStopped: true, priorSuppressed: true, nextOccurrence: childResult }));
		} else if (coldRestart) {
			clearInterval(watchdogTimer);
			if (executionJournal.get(executionJob.admissionId)?.state !== "active") throw new Error("COLD_RESTART_ACTIVE_CAPTURE_MISSING");
			// Simulate process loss: close OS resources without persisting Stop/terminal intent.
			await engine.stop();
			rmSync(output, { force: true }); // The child must produce fresh encoded bytes, not inherit the old file.
			const childResult = await observeColdRestart(directory, { ...coldRestartSpec, clockAtRestart: leaseClock() + 1000 });
			console.log(JSON.stringify({ initialCapture: true, realWatchdog: true, cacheStored, coldRestart: childResult }));
		} else if (continuousSchedule && !pauseScheduledAutomation) {
			if (lateScheduleContinuation) {
				const initialReads = scheduleRestoreReads;
				futureCacheAccepted = await expandFutureSchedule();
				if (!futureCacheAccepted) throw new Error("LATE_CONTINUITY_SIGNED_CACHE_REJECTED");
				const deadline = Date.now() + 6000;
				while (scheduleRestoreReads < initialReads + 3) {
					if (Date.now() >= deadline) throw new Error("LATE_CONTINUITY_WATCHDOG_NOT_RECONCILED");
					await new Promise((resolve) => setTimeout(resolve, 50));
				}
			}
			const originalEncoderPid = engine.ffmpeg?.pid;
			handoffReleaseAfter = Date.now() + 1000;
			clockOffset = executionRequest.sentAt + 60000 - performance.now();
			const boundaryDeadline = Date.now() + 20000;
			while (engine.isRunning && !events.some((event) => event.generation === executionGeneration && event.kind === "started" && event.index > indexAtStop)) {
				if (Date.now() >= boundaryDeadline) break;
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
			const observation = {
				realWatchdog: true,
				boundaryUtc,
				cacheStored,
				cacheRestored,
				originalEngineContinued: engine.isRunning,
				sameEncoder: originalEncoderPid !== undefined && engine.ffmpeg?.pid === originalEncoderPid,
				outputStarts,
				advancedOriginalPlayback: events.some((event) => event.generation === executionGeneration && event.kind === "started" && event.index > indexAtStop),
				futureCacheAccepted,
				sameSession: executionJob.id === nextSessionId,
				logicalMembers: lifecycleController.reports().filter((receipt) => receipt.sessionId === executionJob.id && receipt.state === "active").length,
				originalOccurrenceStillOpen: lifecycleController.reports().some((receipt) => receipt.executionGeneration === executionGeneration && receipt.state === "active"),
			};
			clearInterval(watchdogTimer);
			// Emergency teardown follows the continuity observation, outside its proof.
			for (const extra of Object.values(scheduleCli.activeEngines)) extraEngines.add(extra);
			extraEngines.add(engine);
			for (const extra of extraEngines) await extra.stop();
			console.log(JSON.stringify(observation));
		} else {
			if (pauseScheduledAutomation) {
				if (pauseStalledBoundary) {
					const evaluate = page.evaluate.bind(page);
					page.evaluate = (operation, ...args) => {
						if (args.length === 2 && args[0] === executionGeneration && typeof args[1] === "number") {
							deadlineUpdateHeld = true;
							// Hold only the control RPC; real renderer/capture/drain RPCs remain live.
							return new Promise(() => {});
						}
						return evaluate(operation, ...args);
					};
				}
				pauseAccepted = await pauseCache();
				if (!pauseAccepted) throw new Error("Signed Pause snapshot was rejected before the continuity observation");
				const readsBefore = scheduleRestoreReads,
					pauseDeadline = Date.now() + 5000;
				while (scheduleRestoreReads < readsBefore + 3) {
					if (Date.now() >= pauseDeadline) throw new Error("Real watchdog did not restore the accepted Pause snapshot");
					await new Promise((resolve) => setTimeout(resolve, 50));
				}
				const restored = await scheduleCli.scheduleCaches.get("isolated-signed-cache").restore();
				pausedCacheEmpty = restored !== null && restored.jobs.length === 0;
				currentRemainedLiveBeforeEnd = engine.isRunning;
				handoffReleaseAfter = Date.now() + 1000;
				if (pauseExactBoundary) {
					rendererDeadlineObservation = await page.evaluate(() => ({ original: window.fixtureOriginalWindowDeadline, current: window.__clipifyRunnerExecution?.deadlineMonotonic, state: window.clipifyRunnerPresentation?.snapshot().state }));
					// Isolate the renderer guard: the native timer must not mask a stale browser deadline.
					clearInterval(watchdogTimer);
					const rendererDeadline = Date.now() + 20000;
					while (!events.some((event) => event.kind === "boundary_evaluated")) {
						if (Date.now() >= rendererDeadline) throw new Error("Paused renderer did not evaluate its original clip boundary");
						await new Promise((resolve) => setTimeout(resolve, 50));
					}
				}
				clockOffset = executionRequest.sentAt + 60000 - performance.now();
				if (pauseExactBoundary) {
					// Cache restoration may shift the native anchor slightly past the
					// request-based estimate. Exercise an early tick deterministically.
					clockOffset = engine.executionOptions.scheduledDeadlineMonotonic - 1000 - performance.now();
					nativeDeadlineObservation = { now: leaseClock(), deadline: engine.executionOptions.scheduledDeadlineMonotonic };
					await lifecycleController.tick();
					prematureNativeTickStayedLive = engine.isRunning && nativeDeadlineObservation.now < nativeDeadlineObservation.deadline;
					// The renderer proof is complete. Restore the real periodic owner:
					// one early tick must not strand the execution after its deadline.
					watchdogTimer = scheduleCli.startExecutionWatchdog();
				}
				const closureDeadline = Date.now() + 20000;
				while (!executionJournal.pendingTerminals().some((receipt) => receipt.executionGeneration === executionGeneration && receipt.allOutputsClosed === true) && !events.some((event) => event.generation === executionGeneration && event.kind === "started" && event.index > indexAtStop)) {
					if (Date.now() >= closureDeadline) break;
					await new Promise((resolve) => setTimeout(resolve, 50));
				}
				futureMemberActivated = executionJournal.get(nextAdmissionId)?.state === "active" || lifecycleController.reports().some((receipt) => receipt.admissionId === nextAdmissionId && receipt.state === "active");
				runtimeExpired = executionJournal.pendingTerminals().some((receipt) => receipt.executionGeneration === executionGeneration && receipt.allOutputsClosed === true);
				clearInterval(watchdogTimer);
			} else if (manualScheduledStop) {
				manualStopAccepted = await lifecycleController.stop(executionJob);
				if (replayStoppedOccurrence) {
					aliasCacheAccepted = await replayStoppedCache();
					if (!aliasCacheAccepted) throw new Error("Valid unseen-admission cache rejected before Stop replay observation");
				}
				const readsBefore = scheduleRestoreReads;
				const observerDeadline = Date.now() + 5000;
				while (scheduleRestoreReads < readsBefore + 3) {
					if (Date.now() >= observerDeadline) throw new Error("Actual scheduled watchdog did not revisit the stopped occurrence");
					await new Promise((resolve) => setTimeout(resolve, 50));
				}
				if (replayStoppedOccurrence) {
					const replay = Object.values(scheduleCli.activeEngines).find((entry) => entry !== engine);
					if (replay) {
						const startupDeadline = Date.now() + 15000;
						while (!replay.mediaStream || !replay.ffmpeg) {
							if (Date.now() >= startupDeadline) throw new Error("Replayed capture did not finish startup before observation cleanup");
							await new Promise((resolve) => setTimeout(resolve, 50));
						}
					}
				}
				const record = executionJournal.get(executionJob.admissionId);
				manualSuppressed = record?.occurrence?.suppressed === true;
				manualClosed = record?.state === "stopped" && record.allOutputsClosed === true;
				stoppedInsideWindow = leaseClock() < executionRequest.sentAt + 60000;
				restartedAfterStop = outputStarts > 1 || Object.values(scheduleCli.activeEngines).some((entry) => entry.isRunning);
				clearInterval(watchdogTimer);
			} else if (standbyAtEnd) {
				await page.evaluate(() => {
					window.fixtureStandby = true;
					const video = document.querySelector("video");
					video.pause();
					video.hidden = true;
					document.body.style.background = "black";
					const message = document.createElement("p");
					message.textContent = "Standby";
					message.style.color = "white";
					document.body.append(message);
				});
				clockOffset = executionRequest.sentAt + 60000 - performance.now();
				await lifecycleController.tick();
				runtimeExpired = executionJournal.pendingTerminals().some((receipt) => receipt.executionGeneration === executionGeneration && receipt.allOutputsClosed === true);
			} else if (exactEnd) {
				await page.evaluate(() => {
					window.fixtureExactArmed = true;
				});
				const completionDeadline = Date.now() + 20000;
				while (!events.some((event) => event.kind === "boundary_evaluated")) {
					if (Date.now() >= completionDeadline) throw new Error("Exact-end fixture did not finish its current clip");
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
				await engine.requestDrain();
			} else if (maximumOverrun) {
				const draining = engine.requestDrain();
				await page.waitForFunction(() => window.clipifyRunnerPresentation?.snapshot().state === "draining");
				await new Promise((resolve) => setTimeout(resolve, 500));
				const currentClock = leaseClock();
				clockRate = 100;
				clockOffset = currentClock - performance.now() * clockRate;
				await draining;
			} else if (playbackTimeout) {
				await page.evaluate(() => {
					const video = document.querySelector("video");
					video.pause();
				});
				await page.waitForFunction(() => {
					const video = document.querySelector("video");
					return video.paused && !video.seeking && !video.ended && video.currentTime >= 1 && video.currentTime < video.duration;
				});
				const beforeDrain = await page.evaluate(() => window.clipifyRunnerPresentation?.snapshot());
				if (beforeDrain?.generation !== executionGeneration || beforeDrain.state !== "playing" || !beforeDrain.clips.some((clip) => clip.started && !clip.ended)) throw new Error("INVALID_STALL_GIVEN: " + JSON.stringify(beforeDrain));
				const draining = engine.requestDrain();
				await page.waitForFunction(() => window.clipifyRunnerPresentation?.snapshot().state === "draining");
				await new Promise((resolve) => setTimeout(resolve, 500));
				clockOffset += 60000;
				await draining;
			} else if (process.env.CLIPIFY_TEST_FREE_EXPIRE === "1" || cachedSchedule) {
				if (lifecycleController?.tick) {
					if (scheduledHandoff) handoffReleaseAfter = Date.now() + 7000;
					clockOffset = executionRequest.sentAt + (cachedSchedule ? 60000 : 300000) - performance.now();
					if (scheduledWatchdog) {
						// Restored clock anchors can differ by sub-millisecond request latency.
						// The real watchdog owns the end; a single manual tick may still be early.
						const terminalDeadline = Date.now() + 20000;
						while (!executionJournal.pendingTerminals().some((receipt) => receipt.executionGeneration === executionGeneration && receipt.allOutputsClosed === true)) {
							if (scheduledHandoff && scheduleCli.activeEngines[nextSessionId] && !events.some((event) => event.kind === "ended" && event.generation === executionGeneration)) nextExecutionBeforeClipEnd = true;
							if (Date.now() >= terminalDeadline) throw new Error("Scheduled watchdog did not persist physical closure");
							await new Promise((resolve) => setTimeout(resolve, 50));
						}
						if (scheduledHandoff && !expiredHandoff) {
							const nextDeadline = Date.now() + 20000;
							while (!scheduleCli.activeEngines[nextSessionId]?.ffmpeg) {
								if (Date.now() >= nextDeadline) throw new Error("Following active window did not open its output");
								await new Promise((resolve) => setTimeout(resolve, 50));
							}
							const following = scheduleCli.activeEngines[nextSessionId];
							extraEngines.add(following);
							nextSourceLoaded = following.page.url().includes(`/runner/presentation/${nextSessionId}`) && (await following.page.evaluate(() => document.body.getAttribute("data-fixture-source-id"))) === nextOverlayId;
							// Cleanup follows the observed handoff; it is not first-event closure proof.
							await following.stop();
						}
						if (expiredHandoff) nextOccurrenceClosedUnused = executionJournal.pendingTerminals().some((receipt) => receipt.admissionId === nextAdmissionId && receipt.allOutputsClosed === true);
						clearInterval(watchdogTimer);
					} else await lifecycleController.tick();
					runtimeExpired = executionJournal.pendingTerminals().some((receipt) => receipt.executionGeneration === executionGeneration && receipt.allOutputsClosed === true);
				} else await engine.requestDrain();
			} else if (process.env.CLIPIFY_TEST_STOP_NOW === "1") await engine.stop();
			else if (typeof engine.requestDrain === "function") await engine.requestDrain();
			else await engine.stop();
			const bytes = existsSync(output) ? statSync(output).size : 0;
			let encodedFinalFrame = false,
				lastFrameRgb = null,
				frameDecodeError = null;
			if (bytes > 1024) {
				try {
					const frame = execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-i", output, "-vf", "scale=1:1:flags=area", "-pix_fmt", "rgb24", "-fps_mode", "passthrough", "-f", "rawvideo", "pipe:1"], { timeout: 10000 });
					lastFrameRgb = [...frame.subarray(-3)];
					encodedFinalFrame = frame.length >= 3 && lastFrameRgb[1] > 150 && lastFrameRgb[0] < 80 && lastFrameRgb[2] < 80;
				} catch (error) {
					frameDecodeError = String(error); /* Incomplete output remains a failing media assertion. */
				}
			}

			let replay;
			if (replaySpec) {
				const input = join(directory, "replay-input.json");
				writeFileSync(input, JSON.stringify({ ...replaySpec, closedSnapshot: readFileSync(join(directory, "journal/execution-journal.json"), "utf8") }), { mode: 0o600 });
				replay = JSON.parse(
					execFileSync(process.execPath, [join(packageRoot, "test/support/replay-probe.mjs"), input], { encoding: "utf8", timeout: 15000 })
						.trim()
						.split("\n")
						.at(-1),
				);
			}
			console.log(
				JSON.stringify({
					replay,
					...(controlConnectionFails ? { controlFailureStatus, controlFailureCalls, liveAfterControlFailure } : {}),
					...(pauseStalledBoundary ? { deadlineUpdateHeld } : {}),
					...(pauseExactBoundary ? { rendererDeadlineObservation, nativeDeadlineObservation, prematureNativeTickStayedLive, openOutputs: { running: engine.isRunning, encoder: !!engine.ffmpeg, forwarder: !!engine.obsForwarder, browser: !!engine.browser, capture: !!engine.mediaStream } } : {}),
					...(pauseScheduledAutomation ? { pauseAccepted, pausedCacheEmpty, currentRemainedLiveBeforeEnd, futureMemberActivated } : {}),
					...(replayStoppedOccurrence ? { aliasCacheAccepted } : {}),
					...(manualScheduledStop ? { manualStopAccepted, manualSuppressed, manualClosed, stoppedInsideWindow, restartedAfterStop, outputStarts } : {}),
					...(scheduledHandoff ? { nextExecutionBeforeClipEnd, nextOutputOpened, nextOutputBeforeClipEnd, nextOccurrenceClosedUnused, nextSourceLoaded } : {}),
					playbackOutcome: engine.drainOutcome,
					...(standbyAtEnd ? { standbyAtEnd: true } : {}),
					...(scheduledWatchdog ? { startDelayMs, realWatchdog: true } : {}),
					...(cachedSchedule ? { cacheStored, cacheRestored, rejectedBeforeStart } : {}),
					...(unlimitedHours ? { connectedRenewals, connectedHours: (connectedRenewals * 240000) / (60 * 60 * 1000), continuedWithFreshLeases, monthBoundaryCrossed } : {}),
					finalMarkerCaptured,
					timeAtStop,
					indexAtStop,
					drainRequested: events.find((event) => event.kind === "drain_requested"),
					runtimeExpired,
					runtimeAccepted,
					outputSignals,
					outputExit,
					lastEncoderProgress,
					lastFrameRgb,
					frameDecodeError,
					encodedFinalFrame,
					stoppedDuringClip,
					clipCompleted: events.some((event) => event.kind === "ended" && event.index === indexAtStop && event.time >= event.duration - 0.1),
					nextClipStarted: events.some((event) => event.kind === "started" && event.index > indexAtStop),
					allOutputsClosed: !engine.isRunning && !engine.ffmpeg && !engine.obsForwarder && !engine.browser && !engine.mediaStream,
					bytes,
				}),
			);
		}
	}
} finally {
	clearInterval(watchdogTimer);
	if (engine) await engine.stop();
	for (const extra of Object.values(scheduleCli?.activeEngines ?? {})) extraEngines.add(extra);
	for (const extra of extraEngines) await extra.stop();
	const { wss } = require("puppeteer-stream");
	try {
		const server = await wss;
		await new Promise((resolve) => server.close(resolve));
	} catch {}
	if (server) await new Promise((resolve) => server.close(resolve));
	rmSync(directory, { recursive: true, force: true });
	rmSync(compiled, { recursive: true, force: true });
}
