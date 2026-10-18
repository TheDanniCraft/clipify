import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

test("CLI coverage adapter retains original source counters across fixtures without crediting interactive startup", async () => {
	const sourcePath = resolve(__dirname, "../index.ts"),
		source = readFileSync(sourcePath, "utf8");
	const adapter = resolve(__dirname, "../../test/support/cli-adapter.ts");
	const compile = existsSync(adapter) ? jest.requireActual(adapter).compileRunnerCli : undefined;
	const state = globalThis as typeof globalThis & { __coverage__?: Record<string, { hash: string; s: Record<string, number>; statementMap: Record<string, { start: { line: number } }> }> };
	const previous = state.__coverage__?.[sourcePath];
	if (state.__coverage__) delete state.__coverage__[sourcePath];
	const dependency = (name: string) => (name.startsWith("./") ? {} : jest.requireActual(name));
	try {
		const metadata = await compile?.(source.replace("main().catch(console.error);", "export {pollHeartbeat};"), dependency, { exports: {} }, { coverage: true });
		const first = state.__coverage__?.[sourcePath];
		expect(first).toBeDefined();
		expect(Object.values(first?.s ?? {}).some((value) => value > 0)).toBe(true);
		expect(metadata.entryCounterId).not.toBeNull();
		expect(first!.statementMap[metadata.entryCounterId]).toBeDefined();
		expect(first!.s[metadata.entryCounterId]).toBe(0);
		await compile(source.replace("main().catch(console.error);", "export {main};"), dependency, { exports: {} }, { coverage: true });
		expect(state.__coverage__?.[sourcePath]).toBe(first);
	} finally {
		if (state.__coverage__) {
			if (previous) state.__coverage__[sourcePath] = previous;
			else delete state.__coverage__[sourcePath];
		}
	}
});
