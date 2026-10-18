/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
test.each(["deferred", "legacy", "failure"])("DEF-US4-219: installed WebSocket adapter handles %s route loading", (variant) => {
	const run = spawnSync(process.execPath, [resolve("test/support/runner-next-ws-lazy-probe.cjs"), variant], { encoding: "utf8", timeout: 10000 });
	expect({ status: run.status, stderr: run.stderr }).toMatchObject({ status: 0 });
	const line = run.stdout.trim().split("\n").at(-1)!;
	const result = JSON.parse(line);
	expect(result.error).toBeNull();
	expect(result.ensureCalls).toBe(variant === "legacy" ? 0 : 1);
	expect(result.openedBeforeReady).toBe(variant === "legacy" ? 1 : 0);
	expect(result.upgraded).toBe(variant === "failure" ? 0 : 1);
	expect(result.ended).toBe(variant === "failure" ? 1 : 0);
});
