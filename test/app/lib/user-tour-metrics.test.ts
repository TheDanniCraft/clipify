/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("onboarding health aggregates real PostgreSQL JSON state without leaking account data", () => {
	const result = spawnSync(process.execPath, ["--import", "tsx", "--test-reporter=tap", "--test", join(process.cwd(), "test/support/user-tour-metrics.ts")], { encoding: "utf8", timeout: 30000 });
	expect(result.error).toBeUndefined();
	expect(result.stdout + result.stderr).toContain("# fail 0");
	expect(result.status).toBe(0);
}, 35000);
