import { EventEmitter } from "node:events";
import { Script } from "node:vm";

test.each([
	{ host: "linux", targetArch: "arm64", command: "/test/qemu-aarch64", prefix: ["/test/node target"] },
	{ host: "linux", targetArch: "x64", command: "/test/node target", prefix: [] },
	{ host: "win32", targetArch: "arm64", command: "/test/node target", prefix: [] },
])("packager launches $targetArch bytecode through the correct command on $host", async ({ host, targetArch, command, prefix }) => {
	jest.resetModules();
	const cp = (await import("node:child_process")).default;
	const response = new EventEmitter();
	const child = Object.assign(new EventEmitter(), { stdin: { on: jest.fn(), write: jest.fn() }, stderr: new EventEmitter(), stdio: [null, null, null, response], kill: jest.fn() });
	const spawn = jest.spyOn(cp, "spawn").mockReturnValue(child as never);
	const packager = await import("@yao-pkg/pkg/lib-es5/fabricator.js");
	const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
	const arch = Object.getOwnPropertyDescriptor(process, "arch")!;
	const previousQemu = process.env.PKG_QEMU_AARCH64;
	try {
		Object.defineProperty(process, "platform", { value: host, configurable: true });
		Object.defineProperty(process, "arch", { value: "x64", configurable: true });
		process.env.PKG_QEMU_AARCH64 = "/test/qemu-aarch64";
		const done = jest.fn();
		// The internal linuxstatic fabricator is missing from the packager's public Target type.
		const target = { binaryPath: "/test/node target", platform: "linuxstatic", arch: targetArch, nodeRange: "node24" } as never;
		packager.fabricate(["--no-lazy", "--trace_opt"], target, "fixture.js", Buffer.from("module.exports=1"), done);
		const frame = Buffer.alloc(5);
		frame.writeInt32LE(1, 0);
		frame[4] = 42;
		response.emit("data", frame);
		expect(done).toHaveBeenCalledWith(undefined, Buffer.from([42]));
		expect(spawn).toHaveBeenCalledWith(command, [...prefix, "--no-lazy", "-e", packager.fabricatorScript], expect.objectContaining({ stdio: ["pipe", "ignore", "pipe", "pipe"] }));
		expect(() => new Script(packager.fabricatorScript)).not.toThrow();
	} finally {
		packager.shutdown();
		spawn.mockRestore();
		Object.defineProperty(process, "platform", platform);
		Object.defineProperty(process, "arch", arch);
		if (previousQemu === undefined) delete process.env.PKG_QEMU_AARCH64;
		else process.env.PKG_QEMU_AARCH64 = previousQemu;
	}
});
