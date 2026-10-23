import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, createPublicKey } from "node:crypto";
import { build } from "esbuild";
import type { runRunnerFreeProProbe } from "./runner-free-pro-probe";

/** Actual CLI helpers, browser capture, encoder and loopback RTMP receivers.
 * The HTTP adapter forwards authenticated requests to the real application routes.
 */
export async function createMultistreamMedia(input: Parameters<typeof runRunnerFreeProProbe>[0], providers: string[]) {
	const directory = mkdtempSync(join(tmpdir(), "clipify-multistream-http-"));
	const clip = join(directory, "clip.mp4");
	execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=blue:s=320x180:r=15", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100", "-t", "12", "-vf", "drawbox=x=0:y=0:w=iw:h=ih:color=lime:t=fill:enable='gte(t,11.5)'", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", clip], { timeout: 15000 });
	const bridge = (await build({ entryPoints: ["packages/runner/src/presentation.ts"], platform: "browser", format: "esm", bundle: true, write: false })).outputFiles[0].text;
	let generation = "";
	const events: { kind: string; index: number; time: number; duration: number }[] = [];
	const html = (presentationGeneration = generation) => `<!doctype html><html><body style="margin:0;background:black"><span hidden data-runner-content-phase="standby" data-runner-content-epoch="0" data-runner-content-id="fixture-clip"></span><video id="clip" src="/clip.mp4?index=0" style="width:100vw;height:100vh"></video><script type="module">
 import {createPlaybackDrain} from '/bridge.mjs';
 const video=document.querySelector('video');let index=0,draining=false,heldMarker=-1,releasedMarker=-1;
 const notify=(kind)=>fetch('/event',{method:'POST',body:JSON.stringify({kind,index,time:video.currentTime,duration:video.duration})});
 const bridge=createPlaybackDrain({generation:${JSON.stringify(presentationGeneration)},readClips:()=>[{id:String(index),time:video.currentTime,duration:video.duration,started:video.currentTime>0,ended:video.ended}],preventNext:()=>{draining=true;}});
 window.clipifyRunnerPresentation=bridge;
 const fixtureContent=document.querySelector('[data-runner-content-phase]');let fixtureAudio;window.startRunnerPlayback=()=>{fixtureContent.dataset.runnerContentEpoch=String(Number(fixtureContent.dataset.runnerContentEpoch)+1);fixtureContent.dataset.runnerContentPhase='playback';fixtureContent.dataset.runnerContentId=String(index);if(!fixtureAudio){fixtureAudio=new AudioContext();const oscillator=fixtureAudio.createOscillator(),gain=fixtureAudio.createGain();gain.gain.value=0.01;oscillator.connect(gain).connect(fixtureAudio.destination);oscillator.start();}fixtureAudio.resume();video.play();};window.startFallback=window.startRunnerPlayback;window.stopFallback=()=>{video.pause();fixtureContent.dataset.runnerContentEpoch=String(Number(fixtureContent.dataset.runnerContentEpoch)+1);fixtureContent.dataset.runnerContentPhase='standby';};
 const frame=(now,metadata)=>{if(metadata.mediaTime>=11.5&&heldMarker!==index&&releasedMarker!==index&&!video.ended){heldMarker=index;video.pause();notify('marker_hold');}video.requestVideoFrameCallback(frame);};video.requestVideoFrameCallback(frame);
 window.releaseFinalMarker=()=>{if(!draining||heldMarker!==index||releasedMarker===index)return false;releasedMarker=index;video.play();return true;};
 video.addEventListener('playing',()=>notify('started'));
 video.addEventListener('ended',async()=>{if(releasedMarker!==index){heldMarker=index;video.currentTime=video.duration-1/15;video.pause();notify('marker_hold');return;}await notify('ended');bridge.notifyEnded(String(index));if(!draining&&bridge.canAdvance()){index++;video.src='/clip.mp4?index='+index;await video.play();}});
 </script></body></html>`;
	const heartbeat = (await import("@/app/api/runner/heartbeat/route")).POST;
	const terminal = (await import("@/app/api/runner/terminal/route")).POST;
	const presentation = (await import("@/app/api/runner/presentation/route")).POST;
	const presentationAuthority = await import("@/server/runner/presentation");
	async function serveAuthenticatedPresentation(request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse, url: URL) {
		const sessionId = url.pathname.slice("/runner/presentation/".length);
		const cookie = request.headers.cookie
			?.split(";")
			.map((value) => value.trim())
			.find((value) => value.startsWith(`${presentationAuthority.RUNNER_PRESENTATION_COOKIE}=`))
			?.slice(presentationAuthority.RUNNER_PRESENTATION_COOKIE.length + 1);
		const identity = presentationAuthority.verifyRunnerPresentationIdentity(cookie, sessionId);
		const execution = identity ? await presentationAuthority.resolveRunnerPresentationExecution(identity) : null;
		if (!identity || !execution) {
			response.writeHead(403).end("Presentation unavailable");
			return;
		}
		response.setHeader("Content-Type", "text/html");
		response.end(html(identity.executionGeneration).replace("<body style=", `<body data-runner-presentation-generation="${identity.executionGeneration}" data-runner-layout-status="clean" style=`));
		return;
	}
	const server = createServer(async (request, response) => {
		try {
			const url = new URL(request.url!, input.origin);
			if (url.pathname === "/clip.mp4") {
				response.setHeader("Content-Type", "video/mp4");
				response.end(readFileSync(clip));
				return;
			}
			if (url.pathname === "/bridge.mjs") {
				response.setHeader("Content-Type", "text/javascript");
				response.end(bridge);
				return;
			}
			let body = "";
			for await (const chunk of request) body += chunk;
			if (url.pathname === "/event") {
				events.push(JSON.parse(body));
				response.end("ok");
				return;
			}
			if (url.pathname === "/api/runner/presentation") {
				const address = server.address();
				if (!address || typeof address === "string") {
					response.writeHead(503).end();
					return;
				}
				const result = await presentation(new Request(`http://127.0.0.1:${address.port}${url.pathname}`, { method: "POST", headers: { Authorization: request.headers.authorization ?? "", "Content-Type": "application/json" }, body }));
				response.writeHead(result.status, Object.fromEntries(result.headers));
				response.end(await result.text());
				return;
			}
			if (url.pathname.startsWith("/runner/presentation/")) return await serveAuthenticatedPresentation(request, response, url);
			if (["/api/runner/heartbeat", "/api/runner/terminal"].includes(url.pathname)) {
				const result = await (url.pathname.endsWith("heartbeat") ? heartbeat : terminal)(new Request(url, { method: "POST", headers: { Authorization: request.headers.authorization || "", "Content-Type": "application/json" }, body }));
				response.writeHead(result.status, Object.fromEntries(result.headers));
				response.end(await result.text());
				return;
			}
			if (url.pathname.startsWith("/api/")) {
				response.end("{}");
				return;
			}
			response.setHeader("Content-Type", "text/html");
			response.end(html());
		} catch {
			response.writeHead(500);
			response.end("Fixture request failed");
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const child = spawn(process.execPath, ["packages/runner/test/support/multistream-cli-probe.mjs", JSON.stringify(providers)], { stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32", env: { ...process.env, NODE_V8_COVERAGE: "" } });
	type Message = Record<string, any>;
	const messages: Message[] = [];
	const pending = new Set<() => void>();
	let buffer = "",
		failure = "";
	child.stderr.on("data", (data) => {
		failure = (failure + String(data)).slice(-4000);
	});
	child.stdout.on("data", (data) => {
		buffer += String(data);
		const lines = buffer.split("\n");
		buffer = lines.pop()!;
		for (const line of lines)
			if (line.startsWith("CLIPIFY_MEDIA:")) {
				messages.push(JSON.parse(line.slice(14)));
				for (const notify of pending) notify();
			}
	});
	child.on("exit", () => {
		for (const notify of pending) notify();
	});
	const wait = (type: string, timeout = 45000): Promise<Message> =>
		new Promise((resolve, reject) => {
			const inspect = () => {
				const value = messages.find((message) => message.type === type);
				if (value) {
					clearTimeout(timer);
					pending.delete(inspect);
					resolve(value);
				} else if (child.exitCode !== null || child.signalCode !== null) {
					clearTimeout(timer);
					pending.delete(inspect);
					reject(new Error(`Media fixture exited before ${type}: ${failure.replace(/rtmps?:\/\/\S+/g, "[redacted]")}`));
				}
			};
			const timer = setTimeout(() => {
				pending.delete(inspect);
				reject(new Error(`Media fixture timed out waiting for ${type}`));
			}, timeout);
			pending.add(inspect);
			inspect();
		});
	const send = (message: Message) => child.stdin.write(JSON.stringify(message) + "\n");
	return {
		ready: () => wait("ready"),
		async start(executionGeneration: string, runnerId: string, token: string, publicKey: string, admissionId: string) {
			generation = executionGeneration;
			const keyId = createHash("sha256")
				.update(createPublicKey(publicKey).export({ type: "spki", format: "der" }))
				.digest("hex")
				.slice(0, 16);
			const address = server.address();
			if (!address || typeof address === "string") throw new Error("Missing fixture listener");
			send({ action: "start", generation: executionGeneration, admissionId, apiBase: `http://127.0.0.1:${address.port}`, runnerId, token, keys: { [keyId]: publicKey } });
			// The child gives Chromium a bounded 100-second startup window under
			// full-suite CPU pressure. Keep the parent alive long enough to receive
			// that result instead of timing out while the child is still healthy.
			return wait("playing", 115000);
		},
		async drain() {
			send({ action: "drain" });
			const result = await wait("result");
			return { ...result, clipCompleted: events.some((event) => event.kind === "ended" && event.time >= event.duration - 0.1), nextClipStarted: events.some((event) => event.kind === "started" && event.index > 0) };
		},
		async close() {
			if (child.exitCode === null && child.signalCode === null) {
				if (process.platform !== "win32" && child.pid) {
					try {
						process.kill(-child.pid, "SIGTERM");
					} catch {}
				} else child.kill("SIGTERM");
				await new Promise<void>((resolve) => {
					const timer = setTimeout(() => {
						if (process.platform !== "win32" && child.pid) {
							try {
								process.kill(-child.pid, "SIGKILL");
							} catch {}
						} else child.kill("SIGKILL");
						resolve();
					}, 5000);
					child.once("exit", () => {
						clearTimeout(timer);
						resolve();
					});
				});
			}
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
			rmSync(directory, { recursive: true, force: true });
		},
	};
}
