import { spawn, type ChildProcess } from "child_process";

export type RunnerOutputTarget = { id: string; rtmpUrl: string; streamKey: string | null };
export type RunnerOutputState = "connecting" | "streaming" | "retrying" | "failed" | "stopped";

/** Fan out a shared encode into bounded, independent stream-copy outputs. */
export class RunnerOutputs {
	private outputs: { id: string; state: RunnerOutputState; child: ChildProcess; queue: Buffer[]; bytes: number; blocked: boolean; closed: boolean; retry?: ReturnType<typeof setTimeout> }[] = [];
	private stopped = false;
	constructor(
		private readonly ffmpeg: string,
		private readonly targets: readonly RunnerOutputTarget[],
		private readonly monitor: (child: ChildProcess) => void,
		private readonly mayOpenOutput: () => boolean = () => true,
	) {}
	connect(source: ChildProcess) {
		for (const target of this.targets) {
			const output = { id: target.id, state: "connecting" as RunnerOutputState, child: null as unknown as ChildProcess, queue: [] as Buffer[], bytes: 0, blocked: false, closed: false, retry: undefined as ReturnType<typeof setTimeout> | undefined };
			this.outputs.push(output);
			let retries = 0;
			const start = () => {
				if (this.stopped) return;
				if (!this.mayOpenOutput()) {
					output.closed = true;
					output.state = "stopped";
					return;
				}
				const url = target.streamKey ? `${target.rtmpUrl}/${target.streamKey}` : target.rtmpUrl;
				const child = spawn(this.ffmpeg, ["-hide_banner", "-loglevel", "warning", "-progress", "pipe:2", "-stats_period", "1", "-f", "mpegts", "-probesize", "32768", "-analyzeduration", "1000000", "-i", "pipe:0", "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-f", "flv", url], { windowsHide: true });
				output.child = child;
				output.closed = false;
				output.blocked = false;
				output.state = retries ? "retrying" : "connecting";
				this.monitor(child);
				let progress = "";
				child.stderr?.on("data", (data: Buffer) => {
					if (output.child !== child || output.closed || this.stopped) return;
					const lines = (progress + data.toString()).split("\n");
					progress = (lines.pop() ?? "").slice(-128);
					if (lines.some((line) => /^out_time_us=[1-9]\d*$/.test(line))) {
						output.state = "streaming";
						retries = 0;
					}
				});
				const failed = () => {
					if (output.child !== child || output.closed || this.stopped) return;
					output.closed = true;
					output.state = "retrying";
					output.queue = [];
					output.bytes = 0;
					if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
					if (retries >= 5) {
						output.state = "failed";
						return;
					}
					retries++;
					output.retry = setTimeout(start, 1000);
					output.retry.unref?.();
				};
				child.stdin?.on("error", failed);
				child.on("error", failed);
				child.on("close", failed);
				child.stdin?.on("drain", () => {
					if (output.child !== child || output.closed) return;
					output.blocked = false;
					while (!output.blocked && output.queue.length) {
						const data = output.queue.shift()!;
						output.bytes -= data.length;
						output.blocked = child.stdin?.write(data) === false;
					}
				});
			};
			start();
		}
		source.stdout?.on("data", (data: Buffer) => {
			for (const output of this.outputs) {
				if (output.closed || !output.child.stdin || output.child.stdin.destroyed) continue;
				if (!output.blocked) output.blocked = output.child.stdin.write(data) === false;
				else {
					output.queue.push(data);
					output.bytes += data.length;
					if (output.bytes > 4 * 1024 * 1024) {
						output.queue = [];
						output.bytes = 0;
						output.child.kill("SIGKILL");
					}
				}
			}
		});
	}
	snapshot() {
		return this.outputs.map(({ id, state }) => ({ id, state }));
	}
	async close(flush: boolean, closeWithinMs = 5000) {
		this.stopped = true;
		const outputs = this.outputs;
		for (const output of outputs) {
			clearTimeout(output.retry);
			output.state = "stopped";
		}
		this.outputs = [];
		await Promise.all(
			outputs.map(async (output) => {
				const child = output.child;
				if (child.exitCode !== null || child.signalCode !== null) return;
				await new Promise<void>((resolve) => {
					const timer = setTimeout(() => child.kill("SIGKILL"), Math.max(0, closeWithinMs));
					child.once("close", () => {
						clearTimeout(timer);
						resolve();
					});
					if (!flush) {
						child.kill("SIGKILL");
						return;
					}
					const finish = () => {
						for (const data of output.queue) child.stdin?.write(data);
						output.queue = [];
						output.bytes = 0;
						child.stdin?.end();
					};
					if (output.blocked) child.stdin?.once("drain", finish);
					else finish();
				});
			}),
		);
	}
}
