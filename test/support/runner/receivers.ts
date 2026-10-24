import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";

export async function loopbackReceiverPort() {
	const server = createServer();
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (!address || typeof address === "string") throw new Error("No fixture port");
	await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
	return address.port;
}
export async function runnerMediaFixture(ffmpeg = "ffmpeg") {
	const directory = await mkdtemp(join(tmpdir(), "clipify-runner-media-"));
	const children = new Set<ChildProcess>();
	const start = (args: string[]) => {
		const child = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
		children.add(child);
		child.once("close", () => children.delete(child));
		return child;
	};
	const wait = async (child: ChildProcess) => {
		const [code] = await once(child, "close");
		if (code !== 0) throw new Error(`Fixture FFmpeg failed (${code})`);
	};
	return {
		directory,
		generateClip: async () => {
			const path = join(directory, "clip.mp4");
			await wait(start(["-y", "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=15", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", path]));
			return path;
		},
		receiver: async () => {
			const port = await loopbackReceiverPort();
			const url = `rtmp://127.0.0.1:${port}/live/fixture`;
			const child = start(["-listen", "1", "-i", url, "-c", "copy", "-f", "null", "-"]);
			return { url, child };
		},
		close: async () => {
			await Promise.all(
				[...children].map(async (child) => {
					const closed = once(child, "close");
					child.kill("SIGTERM");
					const timer = setTimeout(() => child.kill("SIGKILL"), 2000);
					try {
						await closed;
					} finally {
						clearTimeout(timer);
					}
				}),
			);
			await rm(directory, { recursive: true, force: true });
		},
	};
}
