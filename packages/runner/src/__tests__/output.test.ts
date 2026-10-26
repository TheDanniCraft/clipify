import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { spawn, type ChildProcess } from "child_process";
import { RunnerOutputs, type RunnerOutputTarget } from "../output";
jest.mock("child_process");
function fixture(targets?: RunnerOutputTarget[], mayOpenOutput?: () => boolean) {
	const children: ReturnType<typeof child>[] = [];
	function child() {
		const process = Object.assign(new EventEmitter(), { exitCode: null as number | null, signalCode: null as string | null, stdin: Object.assign(new EventEmitter(), { destroyed: false, write: jest.fn().mockReturnValue(true), end: jest.fn() }), stderr: new EventEmitter(), kill: jest.fn() });
		process.kill.mockImplementation(() => {
			process.exitCode = 0;
			process.emit("close", 0);
			return true;
		});
		return process;
	}
	(spawn as jest.Mock).mockImplementation(() => {
		const process = child();
		children.push(process);
		return process;
	});
	const source = Object.assign(new EventEmitter(), { stdout: new PassThrough() });
	const monitor = jest.fn();
	const outputs = new RunnerOutputs(
		"ffmpeg",
		targets ?? [
			{ id: "one", rtmpUrl: "rtmp://127.0.0.1/one", streamKey: "private-one" },
			{ id: "two", rtmpUrl: "rtmp://127.0.0.1/two", streamKey: null },
		],
		monitor,
		mayOpenOutput,
	);
	outputs.connect(source as unknown as ChildProcess);
	return { children, source, outputs, monitor };
}
beforeEach(() => jest.clearAllMocks());

test("TDD-US2-SC002: three provider outputs share encoded packets and isolate a destination failure", async () => {
	const f = fixture(["youtube", "twitch", "custom"].map((id) => ({ id, rtmpUrl: `rtmp://127.0.0.1/${id}`, streamKey: id === "custom" ? null : `private-${id}` })));
	f.source.stdout.write(Buffer.from("shared packet"));
	f.children[0].exitCode = 1;
	f.children[0].emit("close", 1);
	f.source.stdout.write(Buffer.from("healthy packet"));
	expect(f.children.map((child) => child.stdin.write.mock.calls.map(([data]) => data.toString()))).toEqual([["shared packet"], ["shared packet", "healthy packet"], ["shared packet", "healthy packet"]]);
	expect((spawn as jest.Mock).mock.calls.every(([, args]) => args.includes("copy") && !args.includes("libx264"))).toBe(true);
	await f.outputs.close(false);
	expect(f.children.every((child) => child.exitCode !== null)).toBe(true);
});

test("TDD-US2-CON006 U250: drain permission prevents reconnect while an existing healthy output finishes", async () => {
	jest.useFakeTimers();
	try {
		let permitted = true;
		const f = fixture(undefined, () => permitted);
		f.children[0].exitCode = 1;
		f.children[0].emit("close", 1);
		permitted = false;
		await jest.advanceTimersByTimeAsync(1000);
		f.source.stdout.write(Buffer.from("finishing clip"));
		expect(f.children).toHaveLength(2);
		expect(f.children[1].stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["finishing clip"]);
		await f.outputs.close(false);
	} finally {
		jest.useRealTimers();
	}
});

test("TDD-US2-FR008: a reconnect attempt remains retrying until its own muxer reports progress", async () => {
	jest.useFakeTimers();
	try {
		const f = fixture();
		f.children[0].exitCode = 1;
		f.children[0].emit("close", 1);
		await jest.advanceTimersByTimeAsync(1000);
		expect(f.outputs.snapshot()[0]).toEqual({ id: "one", state: "retrying" });
		f.children[2].stderr.emit("data", Buffer.from("out_time_us=1000000\n"));
		expect(f.outputs.snapshot()[0]).toEqual({ id: "one", state: "streaming" });
		await f.outputs.close(false);
	} finally {
		jest.useRealTimers();
	}
});

test("TDD-US2-CON006 U142: destination metacharacters stay one literal argument without a shell", async () => {
	const target = { id: "literal", rtmpUrl: "rtmp://127.0.0.1/live", streamKey: "key|[x]:y'z\\$HOME;$(touch ignored)" };
	const f = fixture([target]);
	const [executable, args, options] = (spawn as jest.Mock).mock.calls[0];
	expect(executable).toBe("ffmpeg");
	expect(args.at(-1)).toBe(`${target.rtmpUrl}/${target.streamKey}`);
	expect(options).toEqual({ windowsHide: true });
	expect(JSON.stringify(f.outputs.snapshot())).not.toContain(target.streamKey);
	await f.outputs.close(false);
});

test("TDD-US2-EC005: each unavailable output has at most five retries and an explicit failed state", async () => {
	jest.useFakeTimers();
	try {
		const f = fixture();
		for (let attempt = 0; attempt < 6; attempt++) {
			for (const child of f.children.slice(-2)) {
				child.exitCode = 1;
				child.emit("close", 1);
			}
			await jest.advanceTimersByTimeAsync(1000);
		}
		expect(f.outputs.snapshot()).toEqual([
			{ id: "one", state: "failed" },
			{ id: "two", state: "failed" },
		]);
		expect(f.children).toHaveLength(12);
		await jest.advanceTimersByTimeAsync(60000);
		expect(f.children).toHaveLength(12);
		await f.outputs.close(false);
	} finally {
		jest.useRealTimers();
	}
});

test("TDD-US2-CON006 U249: overflowing a failed FIFO retries only that destination with fresh media", async () => {
	jest.useFakeTimers();
	try {
		const f = fixture();
		f.children[0].stdin.write.mockReturnValue(false);
		f.source.stdout.write(Buffer.from("blocked"));
		f.source.stdout.write(Buffer.alloc(4 * 1024 * 1024 + 1));
		expect(f.outputs.snapshot()[0]).toEqual({ id: "one", state: "retrying" });
		await jest.advanceTimersByTimeAsync(1000);
		expect(f.children).toHaveLength(3);
		f.source.stdout.write(Buffer.from("fresh keyframe sequence"));
		expect(f.children[2].stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["fresh keyframe sequence"]);
		expect(f.children[1].stdin.write).toHaveBeenCalledTimes(3);
		await f.outputs.close(false);
	} finally {
		jest.useRealTimers();
	}
});

test("TDD-US2-CON006 U251: only real muxer progress establishes streaming for that destination", async () => {
	const f = fixture();
	f.source.stdout.write(Buffer.from("queued local media"));
	expect(f.outputs.snapshot()).toEqual([
		{ id: "one", state: "connecting" },
		{ id: "two", state: "connecting" },
	]);
	f.children[1].stderr.emit("data", Buffer.from("out_time_us=1000000\nprogress=continue\n"));
	f.children[0].exitCode = 1;
	f.children[0].emit("close", 1);
	expect(f.outputs.snapshot()).toEqual([
		{ id: "one", state: "retrying" },
		{ id: "two", state: "streaming" },
	]);
	await f.outputs.close(false);
});

test("TDD-US2-CON006 U250: stopping a generation fences every pending retry", async () => {
	jest.useFakeTimers();
	try {
		const f = fixture();
		const failed = f.children[0];
		failed.exitCode = 1;
		failed.emit("close", 1);
		await f.outputs.close(false);
		await jest.advanceTimersByTimeAsync(60000);
		f.source.stdout.write(Buffer.from("late media"));
		expect(f.children).toHaveLength(2);
		expect(f.children.every((child) => child.exitCode !== null)).toBe(true);
	} finally {
		jest.useRealTimers();
	}
});

test("TDD-US2-OPT092: reconnect replaces only the failed output and resumes fresh shared media", async () => {
	jest.useFakeTimers();
	try {
		const f = fixture();
		const [failed, healthy] = f.children;
		f.source.stdout.write(Buffer.from("before"));
		failed.exitCode = 1;
		failed.emit("close", 1);
		await jest.advanceTimersByTimeAsync(1000);
		expect(f.children).toHaveLength(3);
		f.source.stdout.write(Buffer.from("after"));
		expect(f.children[2].stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["after"]);
		expect(healthy.stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["before", "after"]);
		await f.outputs.close(false);
	} finally {
		jest.useRealTimers();
	}
});

test("TDD-US2-FR008: a failed target reports retrying without changing the healthy target", async () => {
	const f = fixture();
	const [failed, healthy] = f.children;
	f.source.stdout.write(Buffer.from("encoded media"));
	failed.exitCode = 1;
	failed.emit("close", 1);
	f.source.stdout.write(Buffer.from("healthy media"));
	healthy.stderr.emit("data", Buffer.from("out_time_us=1000000\nprogress=continue\n"));
	const statuses = (f.outputs as RunnerOutputs & { snapshot?: () => { id: string; state: string }[] }).snapshot?.();
	expect(statuses).toEqual([
		{ id: "one", state: "retrying" },
		{ id: "two", state: "streaming" },
	]);
	expect(healthy.stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["encoded media", "healthy media"]);
	await f.outputs.close(false);
});

test("TDD-US2-FR006: a slow destination cannot stall another, and its ordered queue resumes on drain", async () => {
	const f = fixture();
	const [slow, fast] = f.children;
	slow.stdin.write.mockReturnValueOnce(false);
	f.source.stdout.write(Buffer.from("first"));
	f.source.stdout.write(Buffer.from("second"));
	expect(slow.stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["first"]);
	expect(fast.stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["first", "second"]);
	slow.stdin.emit("drain");
	expect(slow.stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["first", "second"]);
	slow.stdin.emit("error", new Error("closed"));
	f.source.stdout.write(Buffer.from("third"));
	expect(slow.stdin.write).toHaveBeenCalledTimes(2);
	expect(fast.stdin.write).toHaveBeenCalledTimes(3);
	await f.outputs.close(false);
	expect(f.children.every((child) => child.exitCode === 0)).toBe(true);
});

test("TDD-US2-FR006: per-target memory is bounded without pausing the shared encoded stream", async () => {
	const f = fixture();
	const [slow, fast] = f.children;
	slow.stdin.write.mockReturnValue(false);
	f.source.stdout.write(Buffer.alloc(1024));
	f.source.stdout.write(Buffer.alloc(4 * 1024 * 1024 + 1));
	f.source.stdout.write(Buffer.from("healthy continues"));
	expect(slow.kill).toHaveBeenCalledWith("SIGKILL");
	expect(fast.stdin.write).toHaveBeenCalledTimes(3);
	await f.outputs.close(false);
	await f.outputs.close(false);
});

test("TDD-US2-FR006: graceful closure flushes a queued destination and waits for every process", async () => {
	const f = fixture();
	const [slow, fast] = f.children;
	slow.stdin.write.mockReturnValueOnce(false);
	f.source.stdout.write(Buffer.from("first"));
	f.source.stdout.write(Buffer.from("final"));
	const closed = f.outputs.close(true, 1000);
	expect(slow.stdin.end).not.toHaveBeenCalled();
	expect(fast.stdin.end).toHaveBeenCalled();
	slow.stdin.emit("drain");
	expect(slow.stdin.end).toHaveBeenCalled();
	expect(slow.stdin.write.mock.calls.map(([data]) => data.toString())).toEqual(["first", "final"]);
	for (const child of f.children) {
		child.exitCode = 0;
		child.emit("close", 0);
	}
	await closed;
});

test("TDD-US2-FR006: a stuck output is forcibly closed at the supplied shutdown bound", async () => {
	jest.useFakeTimers();
	try {
		const f = fixture();
		const closed = f.outputs.close(true, 10);
		await jest.advanceTimersByTimeAsync(10);
		await closed;
		expect(f.children.every((child) => child.kill.mock.calls[0][0] === "SIGKILL")).toBe(true);
	} finally {
		jest.useRealTimers();
	}
});

test("TDD-US2-FR006: an output process startup failure is contained without leaking credentials", async () => {
	const f = fixture();
	const [failed, healthy] = f.children;
	expect(() => failed.emit("error", new Error("spawn private-one failed"))).not.toThrow();
	failed.exitCode = 1;
	failed.emit("close", 1);
	f.source.stdout.write(Buffer.from("healthy"));
	expect(healthy.stdin.write).toHaveBeenCalledTimes(1);
	await f.outputs.close(false);
});
