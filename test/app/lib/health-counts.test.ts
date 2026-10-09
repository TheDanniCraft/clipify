/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("combined health counts execute correctly against PostgreSQL with fresh boundary values", () => {
	const result = spawnSync(process.execPath, ["--import", "tsx", "--test", join(process.cwd(), "test/support/health-counts.ts")], { encoding: "utf8", timeout: 30000 });
	expect(result.error).toBeUndefined();
	expect(result.stdout + result.stderr).toContain("# fail 0");
	expect(result.status).toBe(0);
}, 35000);
