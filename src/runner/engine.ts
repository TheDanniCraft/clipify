import * as fs from "fs";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { launch, getStream } from "puppeteer-stream";
import type { Browser, Page } from "puppeteer-core";
import { spawn, type ChildProcess } from "child_process";
import * as os from "os";
import * as path from "path";
import { ensureDependencies } from "./downloader";
import { writeExtension } from "./extension";

import * as net from "net";

// Singleton TCP Proxy Server to avoid port conflicts
let proxyServer: net.Server | null = null;

// We use an event emitter to notify the engine about stream events
import { EventEmitter } from "events";
export const proxyEvents = new EventEmitter();

function startTCPProxy() {
	if (proxyServer) return;
	console.log(`[TCP Proxy] Starting on port 1935...`);
	proxyServer = net.createServer((clientSocket) => {
		console.log(`[TCP Proxy] Connection received from ${clientSocket.remoteAddress}`);

		// 1. Emit obsConnected so Engine can start FFmpeg listening on 1936
		proxyEvents.emit("obsConnected");

		let retryCount = 0;
		let forwardSocket: net.Socket | null = null;
		let earlyData: Buffer[] = [];
		let isPiping = false;

		// Buffer initial packets manually due to a bug in Bun's net.Socket.pause()
		clientSocket.on("data", (chunk: any) => {
			if (!isPiping) {
				earlyData.push(chunk as Buffer);
			}
		});

		const connectToFFmpeg = () => {
			if (forwardSocket) {
				forwardSocket.removeAllListeners();
				forwardSocket.destroy();
			}

			forwardSocket = new net.Socket();

			forwardSocket.on("error", (err: unknown) => {
				const error = err as NodeJS.ErrnoException;
				if (error.code === "ECONNREFUSED" && retryCount < 50) {
					retryCount++;
					setTimeout(() => connectToFFmpeg(), 100);
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

		clientSocket.on("close", () => {
			console.log(`[TCP Proxy] Client disconnected`);
			if (forwardSocket) forwardSocket.destroy();
			proxyEvents.emit("obsDisconnected");
		});

		clientSocket.on("error", (err) => {
			console.error(`[TCP Proxy] Client error:`, err);
		});

		connectToFFmpeg();
	});

	proxyServer.listen(1935, () => {
		console.log(`[TCP Proxy] Listening on port 1935`);
	});
}

export class Engine {
	private browser: Browser | null = null;

	private page: Page | null = null;
	private ffmpeg: ChildProcess | null = null;
	private obsForwarder: ChildProcess | null = null;
	public isRunning = false;

	// In failsafe mode, are we currently forwarding OBS instead of Puppeteer?
	private isForwardingObs: boolean = false;
	private expectedCloudLoopExit: boolean = false;

	private transitionPromise: Promise<void> = Promise.resolve();
	private activeObsConnections = 0;

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
	) {}

	private killProcessAndWait(child: ChildProcess, name: string, signal: NodeJS.Signals = "SIGINT"): Promise<void> {
		return new Promise<void>((resolve) => {
			if (child.killed || child.exitCode !== null || child.signalCode !== null) {
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
				if (!this.isRunning) return;
				if (this.mode !== "failsafe") return;

				console.log(`[Engine] OBS Connected to TCP Proxy. Switching to OBS Forwarder...`);
				this.isForwardingObs = true;

				// Stop streaming Cloud Loop to YouTube
				await this.stopCloudLoopStream();

				// Stop previous obsForwarder if it was running (fix zombie FFmpeg processes)
				await this.stopObsForwarder();

				if (!this.isRunning) return;

				// Tell Chromium to pause clips
				if (this.page) {
					this.page
						.evaluate(() => {
							if (typeof (window as any).stopFallback === "function") {
								(window as any).stopFallback();
							}
						})
						.catch((err) => console.error("[Engine] Failed to stop fallback:", err));
				}

				// Start forwarding local RTMP to destination
				this.startObsForwarder();
			})
			.catch((err) => console.error("[Engine] Error in handleObsConnected transition:", err));
	};

	private handleObsDisconnected = () => {
		this.activeObsConnections = Math.max(0, this.activeObsConnections - 1);
		if (this.activeObsConnections > 0) return;

		this.transitionPromise = this.transitionPromise
			.then(async () => {
				if (!this.isRunning) return;
				if (this.mode !== "failsafe") return;

				console.log(`[Engine] OBS Disconnected. Falling back to Cloud Loop...`);
				this.isForwardingObs = false;

				// Stop OBS Forwarder
				await this.stopObsForwarder();

				if (!this.isRunning) return;

				// Tell Chromium to play clips (now handled safely inside startCloudLoopStream)
				// Start streaming Cloud Loop to YouTube
				await this.startCloudLoopStream().catch((err) => console.error("[Engine] Failed to start cloud loop stream:", err));
			})
			.catch((err) => console.error("[Engine] Error in handleObsDisconnected transition:", err));
	};

	async start() {
		if (this.isRunning) return;
		this.isRunning = true;
		console.log(`[Engine] Ensuring dependencies are ready...`);
		const deps = await ensureDependencies();
		this.chromePath = deps.chromePath;
		this.ffmpegPath = deps.ffmpegPath;

		this.extPath = path.join(os.homedir(), ".clipify-runner", "extension");
		writeExtension(this.extPath);

		console.log(`[Engine] Starting stream for overlay ${this.overlayId} in ${this.mode} mode...`);

		if (this.mode === "failsafe") {
			startTCPProxy();
			proxyEvents.on("obsConnected", this.handleObsConnected);
			proxyEvents.on("obsDisconnected", this.handleObsDisconnected);
		}

		// Start Chromium in the background. It will load the page but wait in standby.
		await this.startChromiumBackground();

		if (this.mode === "24_7") {
			// Start streaming Cloud Loop immediately for 24/7 mode
			await this.startCloudLoopStream();
		} else {
			console.log(`[Engine] Deferred Initialization: Failsafe is standing by. Waiting for first OBS connection...`);
		}
	}

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

		this.page = await this.browser!.newPage();

		let overlayUrl = `${this.apiBase}/overlay/${this.overlayId}?secret=${this.overlaySecret}`;
		if (this.mode === "failsafe") {
			overlayUrl += "&showFallbackBanner=true&standby=true";
		}

		console.log(`[Engine] Navigating to ${overlayUrl}`);
		await this.page.goto(overlayUrl, { waitUntil: "networkidle2" });
	}

	private monitorFFmpeg(child: any, name: string) {
		let lastLogTime = 0;
		let lastErrorLine = "";

		child.stderr.on("data", (data: Buffer) => {
			const text = data.toString();

			const lines = text
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l.length > 0);
			if (lines.length > 0) {
				lastErrorLine = lines[lines.length - 1];
			}

			if (text.includes("bitrate=")) {
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
			this.ffmpegStatus = `Stopped 🔴 (Code: ${code})`;
			console.log(`[${name}] Exited with code ${code}`);
			if (code !== 0 && code !== null) {
				console.error(`[${name}] 🔴 Stopped unexpectedly. Last log: ${lastErrorLine}`);
			}
		});
	}

	private async startCloudLoopStream() {
		this.expectedCloudLoopExit = false;
		if (this.ffmpeg || !this.isRunning || this.isForwardingObs || !this.page) return;

		try {
			console.log(`[Engine] Capturing media stream from Puppeteer...`);
			this.mediaStream = await getStream(this.page as any, {
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

			if (this.mode === "failsafe" && this.page) {
				this.page
					.evaluate(() => {
						if (typeof (window as any).startFallback === "function") {
							(window as any).startFallback();
						}
					})
					.catch((err: unknown) => console.error("[Engine] Failed to start fallback:", err));
			}

			console.log(`[Engine] Spawning Cloud Loop FFmpeg...`);
			const fullRtmpUrl = this.streamKey ? `${this.rtmpUrl}/${this.streamKey}` : this.rtmpUrl;

			const previewPath = path.join(os.tmpdir(), `clipify-preview-${this.overlayId}.jpg`);
			this.ffmpeg = spawn(this.ffmpegPath, ["-y", "-thread_queue_size", "1024", "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-b:v", "4500k", "-maxrate", "4500k", "-bufsize", "9000k", "-pix_fmt", "yuv420p", "-g", `${this.fps * 2}`, "-r", `${this.fps}`, "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-f", "flv", fullRtmpUrl, "-map", "0:v:0", "-f", "image2", "-update", "1", "-r", "1", previewPath], { windowsHide: true });

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
					console.error("[Engine] FFmpeg stdin error:", err);
				}
			});
			this.mediaStream.pipe(this.ffmpeg.stdin!);
			console.log(`[Engine] Cloud Loop successfully started to ${this.rtmpUrl}`);
		} catch (error) {
			console.error(`[Engine] Failed to start cloud loop stream:`, error);
			if (!this.isForwardingObs) await this.stop();
			throw error;
		}
	}

	private startObsForwarder() {
		const fullRtmpUrl = this.streamKey ? `${this.rtmpUrl}/${this.streamKey}` : this.rtmpUrl;

		console.log(`[Engine] Spawning FFmpeg to forward local OBS (port 1936) -> ${fullRtmpUrl}...`);

		const previewPath = path.join(os.tmpdir(), `clipify-preview-${this.overlayId}.jpg`);
		// FFmpeg acts as the RTMP server on port 1936. TCP Proxy connects to it.
		// -listen 1 tells FFmpeg to accept one incoming RTMP connection.
		this.obsForwarder = spawn(this.ffmpegPath, ["-y", "-listen", "1", "-i", "rtmp://127.0.0.1:1936", "-c", "copy", "-f", "flv", fullRtmpUrl, "-map", "0:v:0", "-f", "image2", "-update", "1", "-r", "1", previewPath], { windowsHide: true });

		this.monitorFFmpeg(this.obsForwarder, "OBS Forwarder");
		this.startPreviewUploader(previewPath);
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
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ overlayId: this.overlayId, secret: this.overlaySecret, image: dataUrl }),
				}).catch(() => {});
			} catch {
				// ignore read errors
			}
		}, 2000);
	}

	private async stopCloudLoopStream() {
		this.expectedCloudLoopExit = true;
		if (this.previewInterval) {
			clearInterval(this.previewInterval);
			this.previewInterval = null;
		}

		if (this.mediaStream) {
			this.mediaStream.destroy();
			this.mediaStream = null;
		}

		if (this.ffmpeg) {
			const child = this.ffmpeg;
			this.ffmpeg = null;
			if (child.stdin) {
				try {
					child.stdin.end();
				} catch {}
			}
			await this.killProcessAndWait(child, "Cloud Loop FFmpeg", "SIGKILL");
		}
	}

	private async stopObsForwarder() {
		if (this.obsForwarder) {
			const child = this.obsForwarder;
			this.obsForwarder = null;
			await this.killProcessAndWait(child, "OBS Forwarder");
		}
	}

	private async stopChromiumBackground() {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.page = null;
		}
	}

	async stop() {
		if (!this.isRunning) return;
		console.log(`[Engine] Stopping stream for overlay ${this.overlayId}...`);
		this.isRunning = false;

		if (this.mode === "failsafe") {
			proxyEvents.off("obsConnected", this.handleObsConnected);
			proxyEvents.off("obsDisconnected", this.handleObsDisconnected);
		}

		await this.stopCloudLoopStream();
		await this.stopChromiumBackground();
		await this.stopObsForwarder();

		console.log(`[Engine] Stream stopped.`);
	}
}
