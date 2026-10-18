import { RunnerOutputs } from "./output";
import { requestRunnerPresentation } from "./presentation-bootstrap";
import { executionNow } from "./execution-clock";
import * as fs from "fs";
import type { PlaybackSnapshot } from "./presentation";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { launch, getStream } from "puppeteer-stream";
import type { Browser, Page } from "puppeteer-core";
import { spawn, type ChildProcess } from "child_process";
import * as os from "os";
import * as path from "path";
import { ensureDependencies } from "./downloader";
import { writeExtension } from "./extension";

import * as net from "net";

declare global {
	interface Window {
		startFallback?: () => void;
		stopFallback?: () => void;
		startRunnerPlayback?: () => void;
	}
}

// Singleton TCP Proxy Server to avoid port conflicts
let proxyServer: net.Server | null = null;
let proxyClosePromise: Promise<void> | null = null;
const proxySockets = new Set<net.Socket>();

// We use an event emitter to notify the engine about stream events
import { EventEmitter } from "events";
export const proxyEvents = new EventEmitter();

const CAPTURE_ATTEMPT_TIMEOUT_MS = 15_000;
const CAPTURE_MAX_ATTEMPTS = 3;
const CAPTURE_RETRY_DELAY_MS = 5_000;
const RTMP_PROXY_PORT = 1935;
const RTMP_PROBE_PREFIX = "CLIPIFY_RTMP_PROBE ";
const MAX_PROBE_BYTES = 512;

const activeProbeNonces = new Map<string, NodeJS.Timeout>();

export function activateRtmpProbeNonce(nonce: string, ttlMs = 30_000) {
	if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) return;
	const existingTimeout = activeProbeNonces.get(nonce);
	if (existingTimeout) clearTimeout(existingTimeout);
	const timeout = setTimeout(() => activeProbeNonces.delete(nonce), ttlMs);
	timeout.unref?.();
	activeProbeNonces.set(nonce, timeout);
}

function consumeRtmpProbeNonce(nonce: string) {
	const timeout = activeProbeNonces.get(nonce);
	if (!timeout) return false;
	clearTimeout(timeout);
	activeProbeNonces.delete(nonce);
	return true;
}

export async function stopTCPProxy() {
	if (proxyClosePromise) return proxyClosePromise;
	if (!proxyServer) return;
	const server = proxyServer;
	proxyServer = null;
	const closePromise = new Promise<void>((resolve, reject) => {
		server.close((error) => {
			if (error) reject(error);
			else resolve();
		});
		for (const socket of proxySockets) socket.destroy();
	});
	proxyClosePromise = closePromise;
	try {
		await closePromise;
	} finally {
		if (proxyClosePromise === closePromise) proxyClosePromise = null;
	}
}

export async function startTCPProxy() {
	if (proxyClosePromise) await proxyClosePromise;
	if (proxyServer) return Promise.resolve(false);
	console.log(`[TCP Proxy] Starting on port ${RTMP_PROXY_PORT}...`);
	const server = net.createServer((clientSocket) => {
		proxySockets.add(clientSocket);
		console.log(`[TCP Proxy] Connection received from ${clientSocket.remoteAddress}`);

		let retryCount = 0;
		let forwardSocket: net.Socket | null = null;
		let earlyData: Buffer[] = [];
		let isPiping = false;
		let hasStartedForwarding = false;
		let probeBuffer = Buffer.alloc(0);
		let retryTimeout: NodeJS.Timeout | null = null;
		let clientClosed = false;

		const connectToFFmpeg = () => {
			if (clientClosed) return;
			if (forwardSocket) {
				forwardSocket.removeAllListeners();
				forwardSocket.destroy();
			}

			forwardSocket = new net.Socket();

			forwardSocket.on("error", (err: unknown) => {
				const error = err as NodeJS.ErrnoException;
				if (error.code === "ECONNREFUSED" && retryCount < 50) {
					retryCount++;
					retryTimeout = setTimeout(() => connectToFFmpeg(), 100);
					retryTimeout.unref?.();
				} else {
					console.error(`[TCP Proxy] Failed to connect to local FFmpeg:`, err);
					clientSocket.destroy();
				}
			});

			forwardSocket.connect(1936, "127.0.0.1", () => {
				console.log(`[TCP Proxy] Connected to local FFmpeg on 1936. Piping data...`);
				isPiping = true;

				// Flush buffered data first
				for (const chunk of earlyData) {
					forwardSocket!.write(chunk);
				}
				earlyData = [];

				// Only destroy the client when the FFmpeg connection intentionally closes AFTER a successful connection
				forwardSocket!.on("close", () => {
					clientSocket.destroy();
				});

				clientSocket.pipe(forwardSocket!);
				forwardSocket!.pipe(clientSocket);
			});
		};

		const startForwarding = () => {
			if (hasStartedForwarding) return;
			hasStartedForwarding = true;
			proxyEvents.emit("obsConnected");
			connectToFFmpeg();
		};

		// Buffer initial packets manually due to a bug in Bun's net.Socket.pause().
		// Probe sockets are handled before they can trigger OBS forwarding.
		clientSocket.on("data", (chunk: any) => {
			const data = chunk as Buffer;
			if (!isPiping) {
				earlyData.push(data);
			}
			if (hasStartedForwarding) return;

			if (probeBuffer.length < MAX_PROBE_BYTES) {
				probeBuffer = Buffer.concat([probeBuffer, data]).subarray(0, MAX_PROBE_BYTES);
			}

			const probeText = probeBuffer.toString("utf8");
			if (probeText.startsWith(RTMP_PROBE_PREFIX)) {
				if (!probeText.includes("\n") && probeBuffer.length < MAX_PROBE_BYTES) return;
				const probeLine = probeText.split(/\r?\n/, 1)[0] ?? "";
				const nonce = probeLine.slice(RTMP_PROBE_PREFIX.length).trim();
				if (consumeRtmpProbeNonce(nonce)) {
					clientSocket.end("OK\n");
				} else {
					clientSocket.destroy();
				}
				return;
			}

			if (!RTMP_PROBE_PREFIX.startsWith(probeText) || probeBuffer.length >= MAX_PROBE_BYTES) {
				startForwarding();
			}
		});

		clientSocket.on("close", () => {
			clientClosed = true;
			proxySockets.delete(clientSocket);
			if (retryTimeout) clearTimeout(retryTimeout);
			console.log(`[TCP Proxy] Client disconnected`);
			if (forwardSocket) forwardSocket.destroy();
			if (hasStartedForwarding) proxyEvents.emit("obsDisconnected");
		});

		clientSocket.on("error", (err) => {
			console.error(`[TCP Proxy] Client error:`, err);
		});
	});
	proxyServer = server;

	return new Promise<boolean>((resolve, reject) => {
		const handleListenError = (error: Error) => {
			if (proxyServer === server) proxyServer = null;
			reject(error);
		};
		server.once("error", handleListenError);
		server.listen(RTMP_PROXY_PORT, () => {
			server.off("error", handleListenError);
			console.log(`[TCP Proxy] Listening on port ${RTMP_PROXY_PORT}`);
			resolve(true);
		});
	});
}

export class Engine {
	private browser: Browser | null = null;

	private page: Page | null = null;
	private scheduledDeadlineBootstrap: string | undefined;
	private browserExecutionClock: { browser: number; native: number } | null = null;
	private ffmpeg: ChildProcess | null = null;
	private obsForwarder: ChildProcess | null = null;
	public isRunning = false;

	// In failsafe mode, are we currently forwarding OBS instead of Puppeteer?
	private isForwardingObs: boolean = false;
	private expectedCloudLoopExit: boolean = false;

	private transitionPromise: Promise<void> = Promise.resolve();
	private activeObsConnections = 0;
	private draining = false;
	/** Retained after physical closure so the controller can report why playback ended. */
	drainOutcome: "clip_completed" | "playback_timeout" | null = null;
	private drainPromise: Promise<void> | null = null;

	private chromePath: string = "";
	private ffmpegPath: string = "ffmpeg";
	private extPath: string = "";

	constructor(
		public readonly overlayId: string,
		public readonly rtmpUrl: string,
		public readonly overlaySecret: string,
		public readonly streamKey: string,
		public readonly fps: number = 60,
		public readonly resolution: string = "1080p",
		public readonly mode: "24_7" | "failsafe" = "24_7",
		public readonly apiBase: string = "http://localhost:3000",
		public readonly runnerToken: string = "",
		private readonly executionOptions: { presentationSessionId?: string; executionGeneration?: string; scheduledDeadlineMonotonic?: number | null; now?: () => number; mayOpenOutput?: () => boolean; destinations?: readonly { id: string; rtmpUrl: string; streamKey: string | null }[] } = {},
	) {}

	private mayOpenOutput() {
		return this.isRunning && !this.draining && this.executionOptions.mayOpenOutput?.() !== false;
	}

	private killProcessAndWait(child: ChildProcess, name: string, signal: NodeJS.Signals = "SIGINT"): Promise<void> {
		return new Promise<void>((resolve) => {
			if (child.exitCode !== null || child.signalCode !== null) {
				resolve();
				return;
			}

			const timeout = setTimeout(() => {
				console.log(`[Engine] ${name} did not exit gracefully, force killing with SIGKILL...`);
				child.kill("SIGKILL");
			}, 5000);

			const onClose = () => {
				clearTimeout(timeout);
				resolve();
			};

			child.once("close", onClose);
			child.kill(signal);
		});
	}

	private handleObsConnected = () => {
		this.activeObsConnections++;
		if (this.activeObsConnections > 1) return;

		this.transitionPromise = this.transitionPromise
			.then(async () => {
				if (!this.mayOpenOutput()) return;
				if (this.mode !== "failsafe") return;

				console.log(`[Engine] OBS Connected to TCP Proxy. Switching to OBS Forwarder...`);
				this.isForwardingObs = true;

				// Stop streaming Cloud Loop to YouTube
				await this.stopCloudLoopStream();

				// Stop previous obsForwarder if it was running (fix zombie FFmpeg processes)
				await this.stopObsForwarder();

				if (!this.mayOpenOutput()) return;

				// Tell Chromium to pause clips
				if (this.page) {
					this.page
						.evaluate(() => {
							if (typeof window.stopFallback === "function") {
								window.stopFallback();
							}
						})
						.catch((err) => console.error("[Engine] Failed to stop fallback:", this.safeDiagnostic(err)));
				}

				// Start forwarding local RTMP to destination
				this.startObsForwarder();
			})
			.catch((err) => console.error("[Engine] Error in handleObsConnected transition:", this.safeDiagnostic(err)));
	};

	private handleObsDisconnected = () => {
		this.activeObsConnections = Math.max(0, this.activeObsConnections - 1);
		if (this.activeObsConnections > 0) return;

		this.transitionPromise = this.transitionPromise
			.then(async () => {
				if (!this.mayOpenOutput()) return;
				if (this.mode !== "failsafe") return;

				console.log(`[Engine] OBS Disconnected. Falling back to Cloud Loop...`);
				this.isForwardingObs = false;

				// Stop OBS Forwarder
				await this.stopObsForwarder();

				if (!this.mayOpenOutput()) return;

				// Tell Chromium to play clips (now handled safely inside startCloudLoopStream)
				// Start streaming Cloud Loop to YouTube
				await this.startCloudLoopStreamWithRetry().catch((err) => console.error("[Engine] Failed to start cloud loop stream:", this.safeDiagnostic(err)));
			})
			.catch((err) => console.error("[Engine] Error in handleObsDisconnected transition:", this.safeDiagnostic(err)));
	};

	async start() {
		try {
			return await this.startInternal();
		} catch (error) {
			// Process/browser errors can carry argv or private navigation URLs.
			// Preserve useful text without forwarding secret-bearing error objects.
			throw new Error(this.safeDiagnostic(error));
		}
	}

	private async startInternal() {
		if (this.isRunning || this.draining || this.stopPromise || this.executionOptions.mayOpenOutput?.() === false) return;
		this.isRunning = true;
		console.log(`[Engine] Ensuring dependencies are ready...`);
		const deps = await ensureDependencies();
		if (!this.mayOpenOutput()) return;
		this.chromePath = deps.chromePath;
		this.ffmpegPath = deps.ffmpegPath;

		this.extPath = path.join(os.homedir(), ".clipify-runner", "extension");
		writeExtension(this.extPath);

		console.log(`[Engine] Starting stream for overlay ${this.overlayId} in ${this.mode} mode...`);

		if (this.mode === "failsafe") {
			await startTCPProxy();
			proxyEvents.on("obsConnected", this.handleObsConnected);
			proxyEvents.on("obsDisconnected", this.handleObsDisconnected);
		}

		// Start Chromium in the background. It will load the page but wait in standby.
		if ((await this.startChromiumBackground()) === false) return false;

		if (this.mode === "24_7") {
			// Start streaming Cloud Loop immediately for 24/7 mode
			return await this.startCloudLoopStreamWithRetry();
		} else {
			console.log(`[Engine] Deferred Initialization: Failsafe is standing by. Waiting for first OBS connection...`);
		}
	}

	private presentationRefresh: ReturnType<typeof setInterval> | null = null;
	private presentationRefreshPending = false;
	private presentationAbort: AbortController | null = null;
	private mediaStream: any = null;
	public ffmpegStatus: string = "Starting... ⏳";

	private async startChromiumBackground() {
		if (this.browser) return;
		console.log(`[Engine] Launching Puppeteer...`);
		this.browser = (await launch({
			executablePath: this.chromePath,
			extensionPath: this.extPath,
			headless: "new",
			defaultViewport: {
				width: 1920,
				height: 1080,
			},
			args: ["--no-sandbox", "--disable-setuid-sandbox", "--autoplay-policy=no-user-gesture-required", "--window-size=1920,1080"],
		})) as any;
		if (!this.mayOpenOutput()) {
			await this.browser!.close();
			this.browser = null;
			return;
		}

		this.page = await this.browser!.newPage();
		await this.page.evaluateOnNewDocument((generation) => {
			window.__clipifyRunnerExecution = { generation };
		}, this.executionOptions.executionGeneration ?? "legacy");

		const scheduledEnd = this.executionOptions.scheduledDeadlineMonotonic;
		if (typeof scheduledEnd === "number" && Number.isFinite(scheduledEnd)) {
			const browserTime = await this.page.evaluate(() => performance.timeOrigin + performance.now());
			this.browserExecutionClock = { browser: browserTime, native: (this.executionOptions.now ?? executionNow)() };
			const browserEnd = browserTime + scheduledEnd - this.browserExecutionClock.native;
			await this.installScheduledDeadline(browserEnd);
		}

		let overlayUrl = `${this.apiBase}/overlay/${this.overlayId}?secret=${this.overlaySecret}`;
		if (this.mode === "failsafe") {
			overlayUrl += "&showFallbackBanner=true&standby=true";
		} else {
			overlayUrl += "&standby=true";
		}

		if (this.executionOptions.presentationSessionId) {
			this.presentationAbort = new AbortController();
			const presentation = await requestRunnerPresentation({ apiBase: this.apiBase, runnerToken: this.runnerToken, sessionId: this.executionOptions.presentationSessionId, executionGeneration: this.executionOptions.executionGeneration ?? "", signal: this.presentationAbort.signal });
			if (!presentation) return this.refusePresentation();
			await this.page!.setCookie(presentation.cookie);
			overlayUrl = presentation.url;
		}
		console.log(`[Engine] Navigating to the configured overlay`);
		await this.page!.goto(overlayUrl, { waitUntil: "networkidle2" });
		if (this.executionOptions.presentationSessionId) {
			try {
				await this.page!.waitForFunction(
					(generation) => {
						const surface = document.querySelector("[data-runner-presentation-generation]");
						return surface?.getAttribute("data-runner-presentation-generation") === generation && ["placed", "clean"].includes(surface.getAttribute("data-runner-layout-status") ?? "") && window.clipifyRunnerPresentation?.snapshot().generation === generation;
					},
					{ timeout: 15000 },
					this.executionOptions.executionGeneration!,
				);
			} catch {
				return this.refusePresentation();
			}
			const page = this.page;
			this.presentationRefresh = setInterval(async () => {
				if (this.presentationRefreshPending || this.page !== page || !this.isRunning) return;
				this.presentationRefreshPending = true;
				try {
					const refreshed = await requestRunnerPresentation({ apiBase: this.apiBase, runnerToken: this.runnerToken, sessionId: this.executionOptions.presentationSessionId!, executionGeneration: this.executionOptions.executionGeneration!, signal: this.presentationAbort?.signal });
					if (refreshed && this.page === page && this.isRunning) await page!.setCookie(refreshed.cookie);
				} catch {
					// A transient refresh/browser failure must not cut an admitted clip.
				} finally {
					this.presentationRefreshPending = false;
				}
			}, 300000);
			this.presentationRefresh.unref();
		}
	}

	private async refusePresentation(message = "Runner presentation is unavailable. Reconnect and try again.") {
		if (this.mediaStream) await this.stopCloudLoopStream();
		this.ffmpegStatus = message;
		await this.stopChromiumBackground();
		this.isRunning = false;
		return false as const;
	}

	private safeDiagnostic(value: unknown) {
		let text = value instanceof Error ? value.message : String(value);
		text = text.replace(/rtmps?:\/\/[^\s"'<>]+/gi, "[RTMP destination]");
		for (const secret of [this.streamKey, this.overlaySecret, this.runnerToken, ...(this.executionOptions.destinations?.map((target) => target.streamKey) ?? [])]) if (secret) text = text.split(secret).join("[redacted]");
		return text;
	}

	private monitorFFmpeg(child: any, name: string, aggregateStatus = true) {
		let lastLogTime = 0;
		let lastErrorLine = "";

		child.stderr.on("data", (data: Buffer) => {
			const text = this.safeDiagnostic(data.toString());

			const lines = text
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l.length > 0);
			if (lines.length > 0) {
				lastErrorLine = lines[lines.length - 1];
			}

			if (aggregateStatus && text.includes("bitrate=")) {
				const now = Date.now();
				if (now - lastLogTime > 1000) {
					const bitrateMatch = text.match(/bitrate=\s*([\d.]+\s*kbits\/s)/);
					const fpsMatch = text.match(/fps=\s*([\d.]+)/);
					const timeMatch = text.match(/time=([\d:.]+)/);

					if (bitrateMatch) {
						this.ffmpegStatus = `Healthy 🟢 | FPS: ${fpsMatch ? fpsMatch[1] : "?"} | Bitrate: ${bitrateMatch[1]} | Uptime: ${timeMatch ? timeMatch[1] : "?"}`;
						lastLogTime = now;
					}
				}
			}
		});

		child.on("close", (code: number) => {
			if (aggregateStatus) this.ffmpegStatus = `Stopped 🔴 (Code: ${code})`;
			console.log(`[${name}] Exited with code ${code}`);
			if (code !== 0 && code !== null) {
				console.error(`[${name}] 🔴 Stopped unexpectedly. Last log: ${lastErrorLine}`);
			}
		});
	}

	private async startCloudLoopStreamWithTimeout() {
		let timeoutId: NodeJS.Timeout | undefined;
		try {
			return await Promise.race([
				this.startCloudLoopStream(),
				new Promise<never>((_, reject) => {
					timeoutId = setTimeout(() => reject(new Error(`Capture startup timed out after ${CAPTURE_ATTEMPT_TIMEOUT_MS / 1000}s`)), CAPTURE_ATTEMPT_TIMEOUT_MS);
				}),
			]);
		} finally {
			if (timeoutId) clearTimeout(timeoutId);
		}
	}

	private async startCloudLoopStreamWithRetry() {
		let lastError: unknown = new Error("Cloud loop capture did not start");

		for (let attempt = 1; attempt <= CAPTURE_MAX_ATTEMPTS; attempt++) {
			this.ffmpegStatus = `Starting (capture attempt ${attempt}/${CAPTURE_MAX_ATTEMPTS})... ⏳`;
			console.log(`[Engine] Capture startup attempt ${attempt}/${CAPTURE_MAX_ATTEMPTS}...`);

			try {
				return await this.startCloudLoopStreamWithTimeout();
			} catch (error) {
				lastError = error;
				this.ffmpegStatus = "Capture startup failed 🔴";
				console.error(`[Engine] Capture startup failed on attempt ${attempt}/${CAPTURE_MAX_ATTEMPTS}:`, this.safeDiagnostic(error));
				await this.stopCloudLoopStream();
				await this.stopChromiumBackground();

				if (attempt === CAPTURE_MAX_ATTEMPTS || !this.isRunning) break;
				console.log(`[Engine] Retrying capture startup in ${CAPTURE_RETRY_DELAY_MS / 1000}s...`);
				await new Promise((resolve) => setTimeout(resolve, CAPTURE_RETRY_DELAY_MS));
				if (!this.isRunning) break;
				await this.startChromiumBackground();
			}
		}

		throw lastError;
	}

	private async beginCapturedPlayback(capturePage: Page): Promise<boolean | undefined> {
		const previousEpoch = this.executionOptions.presentationSessionId
			? await capturePage.evaluate(() => {
					const value = document.querySelector("[data-runner-presentation-generation]")?.querySelector("[data-runner-content-epoch]")?.getAttribute("data-runner-content-epoch");
					const epoch = value == null ? NaN : Number(value);
					return Number.isSafeInteger(epoch) && epoch >= 0 ? epoch : null;
				})
			: null;
		if (this.executionOptions.presentationSessionId && previousEpoch === null) return this.refusePresentation();
		const playbackFunction = this.mode === "failsafe" ? "startFallback" : "startRunnerPlayback";
		const playbackStarted = await capturePage.evaluate((functionName) => {
			const startPlayback = window[functionName as "startFallback" | "startRunnerPlayback"];
			if (typeof startPlayback !== "function") return false;
			startPlayback();
			return true;
		}, playbackFunction);
		if (!playbackStarted) throw new Error(`Missing ${playbackFunction} function in overlay`);
		if (this.executionOptions.presentationSessionId && previousEpoch !== null) {
			try {
				const ready = await capturePage.waitForFunction(
					(expectedGeneration, beforeEpoch) => {
						const surface = document.querySelector("[data-runner-presentation-generation]");
						if (surface?.getAttribute("data-runner-presentation-generation") !== expectedGeneration || window.clipifyRunnerPresentation?.snapshot().generation !== expectedGeneration) return false;
						const content = surface.querySelector("[data-runner-content-phase]");
						if (!content) return false;
						const epoch = Number(content.getAttribute("data-runner-content-epoch"));
						const phase = content.getAttribute("data-runner-content-phase");
						if (!Number.isSafeInteger(epoch) || epoch <= beforeEpoch || !["playback", "empty"].includes(phase ?? "")) return false;
						const status = surface.getAttribute("data-runner-layout-status");
						if (status === "clean") return "clean";
						const key = [String(epoch), phase, content.getAttribute("data-runner-content-id") ?? ""].join(":");
						if (surface.getAttribute("data-runner-layout-content-key") !== key) return false;
						return status === "placed" || status === "blocked" ? status : false;
					},
					{ timeout: 15000 },
					this.executionOptions.executionGeneration!,
					previousEpoch,
				);
				const status = await ready.jsonValue();
				await ready.dispose();
				if (!this.mayOpenOutput() || this.isForwardingObs || this.page !== capturePage) return;
				if (status === "blocked") return this.refusePresentation("Adjust your overlay layout to leave room for Clipify attribution, then try again.");
				if (status !== "placed" && status !== "clean") return this.refusePresentation();
			} catch {
				if (!this.mayOpenOutput() || this.isForwardingObs || this.page !== capturePage) return;
				return this.refusePresentation();
			}
		}
		return true;
	}

	private async startCloudLoopStream() {
		this.expectedCloudLoopExit = false;
		if (this.ffmpeg || !this.mayOpenOutput() || this.isForwardingObs || !this.page) return;

		try {
			console.log(`[Engine] Capturing media stream from Puppeteer...`);
			const capturePage = this.page;
			const capturedStream = await getStream(capturePage as any, {
				audio: true,
				video: true,
				frameSize: 20,
				videoBitsPerSecond: 8000000,
				videoConstraints: {
					mandatory: {
						minFrameRate: this.fps,
						maxFrameRate: this.fps,
						minWidth: this.resolution === "1080p" ? 1920 : 1280,
						maxWidth: this.resolution === "1080p" ? 1920 : 1280,
						minHeight: this.resolution === "1080p" ? 1080 : 720,
						maxHeight: this.resolution === "1080p" ? 1080 : 720,
					},
				} as any,
			});
			if (!this.mayOpenOutput() || this.isForwardingObs || this.page !== capturePage) {
				capturedStream.destroy();
				return;
			}
			this.mediaStream = capturedStream;

			if (this.page) {
				const playback = await this.beginCapturedPlayback(capturePage);
				if (playback !== true) return playback;
			}

			if (!this.mayOpenOutput() || this.isForwardingObs || this.page !== capturePage) return;

			console.log(`[Engine] Spawning Cloud Loop FFmpeg...`);
			const fullRtmpUrl = this.streamKey ? `${this.rtmpUrl}/${this.streamKey}` : this.rtmpUrl;

			const previewPath = path.join(os.tmpdir(), `clipify-preview-${this.overlayId}.jpg`);
			this.ffmpeg = spawn(this.ffmpegPath, ["-y", "-thread_queue_size", "1024", "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-b:v", "4500k", "-maxrate", "4500k", "-bufsize", "9000k", "-pix_fmt", "yuv420p", "-g", `${this.fps * 2}`, "-r", `${this.fps}`, "-c:a", "aac", "-b:a", "160k", "-ar", "44100", ...(this.executionOptions.destinations?.length ? ["-f", "mpegts", "pipe:1"] : ["-f", "flv", fullRtmpUrl]), "-map", "0:v:0", "-f", "image2", "-update", "1", "-r", "1", previewPath], {
				windowsHide: true,
			});

			if (this.executionOptions.destinations?.length) this.startDestinationOutputs(this.ffmpeg);
			this.monitorFFmpeg(this.ffmpeg, "Cloud Loop FFmpeg");
			this.startPreviewUploader(previewPath);

			this.ffmpeg.on("close", () => {
				if (this.expectedCloudLoopExit) {
					// Intentionally stopped
					return;
				}
				if (!this.isForwardingObs && this.isRunning) {
					// We only auto-stop if we aren't intentionally switching to OBS
					// and the engine wasn't told to stop completely
					this.stop();
				}
			});

			this.ffmpeg.stdin!.on("error", (err: unknown) => {
				const error = err as NodeJS.ErrnoException;
				if (error.code !== "EPIPE") {
					console.error("[Engine] FFmpeg stdin error:", this.safeDiagnostic(err));
				}
			});
			this.mediaStream.pipe(this.ffmpeg.stdin!);
			console.log(`[Engine] Cloud Loop successfully started to the configured destination`);
		} catch (error) {
			const message = this.safeDiagnostic(error);
			console.error(`[Engine] Failed to start cloud loop stream:`, message);
			throw new Error(message);
		}
	}

	private startObsForwarder() {
		if (!this.mayOpenOutput()) return;
		const fullRtmpUrl = this.streamKey ? `${this.rtmpUrl}/${this.streamKey}` : this.rtmpUrl;

		console.log(`[Engine] Spawning FFmpeg to forward local OBS (port 1936) to the configured destination...`);

		const previewPath = path.join(os.tmpdir(), `clipify-preview-${this.overlayId}.jpg`);
		// FFmpeg acts as the RTMP server on port 1936. TCP Proxy connects to it.
		// -listen 1 tells FFmpeg to accept one incoming RTMP connection.
		this.obsForwarder = spawn(this.ffmpegPath, ["-y", "-listen", "1", "-i", "rtmp://127.0.0.1:1936", "-c", "copy", ...(this.executionOptions.destinations?.length ? ["-f", "mpegts", "pipe:1"] : ["-f", "flv", fullRtmpUrl]), "-map", "0:v:0", "-f", "image2", "-update", "1", "-r", "1", previewPath], { windowsHide: true });

		if (this.executionOptions.destinations?.length) this.startDestinationOutputs(this.obsForwarder);
		this.monitorFFmpeg(this.obsForwarder, "OBS Forwarder");
		this.startPreviewUploader(previewPath);
	}

	private destinationOutputs: RunnerOutputs | null = null;
	outputStates() {
		return this.destinationOutputs?.snapshot() ?? [];
	}
	private startDestinationOutputs(source: ChildProcess) {
		this.destinationOutputs = new RunnerOutputs(
			this.ffmpegPath,
			this.executionOptions.destinations ?? [],
			(child) => this.monitorFFmpeg(child, "Destination output", false),
			() => this.mayOpenOutput(),
		);
		this.destinationOutputs.connect(source);
	}
	private async stopDestinationOutputs(flush: boolean, closeWithinMs = 5000) {
		const outputs = this.destinationOutputs;
		this.destinationOutputs = null;
		await outputs?.close(flush, closeWithinMs);
	}

	private previewInterval: NodeJS.Timeout | null = null;

	private startPreviewUploader(previewPath: string) {
		if (this.previewInterval) clearInterval(this.previewInterval);
		this.previewInterval = setInterval(() => {
			if (!fs.existsSync(previewPath)) return;
			try {
				const base64 = fs.readFileSync(previewPath, { encoding: "base64" });
				const dataUrl = `data:image/jpeg;base64,${base64}`;

				fetch(`${this.apiBase}/api/runner/preview`, {
					method: "POST",
					headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.runnerToken}` },
					body: JSON.stringify({ overlayId: this.overlayId, image: dataUrl }),
				}).catch(() => {});
			} catch {
				// ignore read errors
			}
		}, 2000);
	}

	private async stopCloudLoopStream(flush = false, closeWithinMs = 5000) {
		this.expectedCloudLoopExit = true;
		const clock = this.executionOptions.now ?? executionNow;
		const closeDeadline = clock() + Math.max(0, closeWithinMs);
		const child = this.ffmpeg;
		// Capture EOF can close stdin before its final chunk has finished encoding.
		const encoderClosed =
			flush && child
				? new Promise<void>((resolve) => {
						if (child.exitCode !== null || child.signalCode !== null) resolve();
						else child.once("close", () => resolve());
					})
				: null;
		if (this.previewInterval) {
			clearInterval(this.previewInterval);
			this.previewInterval = null;
		}

		if (this.mediaStream) {
			const capture = this.mediaStream;
			if (flush && typeof capture.stop === "function" && typeof capture.once === "function") {
				await new Promise<void>((resolve) => {
					const done = () => {
						clearTimeout(timeout);
						capture.off("end", done);
						capture.off("error", done);
						resolve();
					};
					const timeout = setTimeout(done, Math.max(0, closeDeadline - clock()));
					capture.once("end", done);
					capture.once("error", done);
					Promise.resolve()
						.then(() => capture.stop())
						.then(() => {
							if (capture.readableEnded) done();
						}, done);
				});
			}
			capture.destroy();
			this.mediaStream = null;
		}

		if (child) {
			this.ffmpeg = null;
			if (child.stdin) {
				try {
					child.stdin.end();
				} catch {}
			}
			if (encoderClosed) {
				const timeout = setTimeout(() => child.kill("SIGKILL"), Math.max(0, closeDeadline - clock()));
				try {
					await encoderClosed;
				} finally {
					clearTimeout(timeout);
				}
			} else await this.killProcessAndWait(child, "Cloud Loop FFmpeg", "SIGKILL");
			await this.stopDestinationOutputs(flush, Math.max(0, closeDeadline - clock()));
		}
	}

	private async stopObsForwarder() {
		if (this.obsForwarder) {
			const child = this.obsForwarder;
			this.obsForwarder = null;
			await this.killProcessAndWait(child, "OBS Forwarder");
			await this.stopDestinationOutputs(false);
		}
	}

	private async stopChromiumBackground() {
		this.presentationAbort?.abort();
		this.presentationAbort = null;
		if (this.presentationRefresh) clearInterval(this.presentationRefresh);
		this.presentationRefresh = null;
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.page = null;
			this.browserExecutionClock = null;
			this.scheduledDeadlineBootstrap = undefined;
		}
	}

	/** Replace the next-document boundary after installing its verified successor. */
	private async installScheduledDeadline(browserEnd: number) {
		const page = this.page;
		if (!page) return;
		const installed = await page.evaluateOnNewDocument((deadline) => {
			if (window.__clipifyRunnerExecution) window.__clipifyRunnerExecution.deadlineMonotonic = deadline - performance.timeOrigin;
		}, browserEnd);
		const previous = this.scheduledDeadlineBootstrap;
		this.scheduledDeadlineBootstrap = installed?.identifier;
		if (previous && previous !== installed?.identifier) await page.removeScriptToEvaluateOnNewDocument(previous);
	}

	/** Replace only this captured generation's verified playback boundary. */
	async updateScheduledDeadline(deadlineMonotonic: number): Promise<void> {
		if (!Number.isFinite(deadlineMonotonic)) throw new Error("Invalid execution deadline");
		this.executionOptions.scheduledDeadlineMonotonic = deadlineMonotonic;
		if (!this.page || this.draining) return;
		// Reuse the initial clock mapping: resampling adds RPC jitter to an immutable end.
		if (!this.browserExecutionClock) {
			const browser = await this.page.evaluate(() => performance.timeOrigin + performance.now());
			this.browserExecutionClock = { browser, native: (this.executionOptions.now ?? executionNow)() };
		}
		const browserEnd = this.browserExecutionClock.browser + deadlineMonotonic - this.browserExecutionClock.native;
		await this.installScheduledDeadline(browserEnd);
		await this.page.evaluate(
			(generation, deadline) => {
				if (window.__clipifyRunnerExecution?.generation !== generation) throw new Error("Execution generation changed");
				const relativeDeadline = deadline - performance.timeOrigin;
				window.__clipifyRunnerExecution.deadlineMonotonic = relativeDeadline;
				window.clipifyRunnerPresentation?.updateDeadline(generation, relativeDeadline);
			},
			this.executionOptions.executionGeneration ?? "legacy",
			browserEnd,
		);
	}

	private async finishPresentationClip(started: number, deadline: number, generation: string, clock: () => number) {
		let lastProgressAt = started,
			lastProgress = "";
		let finished = false;
		// Browser RPCs can stall without rejecting. They share the playback watchdog
		// budget rather than delaying the next deadline check indefinitely.
		const readPresentation = async (operation: Promise<PlaybackSnapshot | null>) => {
			let timer: ReturnType<typeof setTimeout> | undefined;
			try {
				const remaining = Math.max(0, Math.min(deadline, lastProgressAt + 60000) - clock());
				return await Promise.race([
					operation.catch(() => null),
					new Promise<null>((resolve) => {
						timer = setTimeout(() => resolve(null), remaining);
					}),
				]);
			} finally {
				clearTimeout(timer);
			}
		};
		if (!this.isForwardingObs && this.page) {
			let report: PlaybackSnapshot | null = await readPresentation(this.page.evaluate((expected) => window.clipifyRunnerPresentation?.requestDrain(expected) ?? null, generation));
			while (this.isRunning) {
				const now = clock();
				if (report?.generation === generation && report.state === "drained") {
					finished = true;
					break;
				}
				const progress = report?.generation === generation ? JSON.stringify(report.clips.map((clip) => [clip.id, clip.time])) : "";
				if (progress && progress !== lastProgress) {
					if (lastProgress) lastProgressAt = now;
					lastProgress = progress;
				}
				if (!Number.isFinite(now) || now >= deadline || now - lastProgressAt >= 60000) break;
				await new Promise((resolve) => setTimeout(resolve, Math.max(0, Math.min(250, deadline - now, lastProgressAt + 60000 - now))));
				if (!this.page) break;
				report = await readPresentation(this.page.evaluate(() => window.clipifyRunnerPresentation?.snapshot() ?? null));
			}
		}
		return finished;
	}

	/** Keep capture alive through the already-playing clip, then flush encoded output. */
	requestDrain(options: { deadlineMonotonic?: number } = {}) {
		if (this.stopPromise) return this.stopPromise;
		if (this.drainPromise) return this.drainPromise;
		this.draining = true;
		this.drainPromise = (async () => {
			if (!this.isRunning) return;
			const clock = this.executionOptions.now ?? executionNow;
			const started = clock(),
				generation = this.executionOptions.executionGeneration ?? "legacy";
			const requested = options.deadlineMonotonic;
			const deadline = Math.min(started + 300000, typeof requested === "number" && Number.isFinite(requested) ? requested : Infinity);
			const generatedPlayback = !this.isForwardingObs;
			const finished = await this.finishPresentationClip(started, deadline, generation, clock);
			this.drainOutcome = this.isRunning && generatedPlayback ? (finished ? "clip_completed" : "playback_timeout") : null;
			await this.stop(finished, Math.min(5000, Math.max(0, deadline - clock())));
		})();
		return this.drainPromise;
	}

	private stopPromise: Promise<void> | null = null;

	stop(flushCapture = false, closeWithinMs = 5000): Promise<void> {
		if (this.stopPromise) return this.stopPromise;
		this.stopPromise = this.closeOutputs(flushCapture, closeWithinMs);
		return this.stopPromise;
	}

	private async closeOutputs(flushCapture: boolean, closeWithinMs: number) {
		if (!this.isRunning) return;
		console.log(`[Engine] Stopping stream for overlay ${this.overlayId}...`);
		this.isRunning = false;

		if (this.mode === "failsafe") {
			proxyEvents.off("obsConnected", this.handleObsConnected);
			proxyEvents.off("obsDisconnected", this.handleObsDisconnected);
		}

		await this.stopCloudLoopStream(flushCapture, closeWithinMs);
		await this.stopObsForwarder();
		await this.stopChromiumBackground();

		console.log(`[Engine] Stream stopped.`);
	}
}
