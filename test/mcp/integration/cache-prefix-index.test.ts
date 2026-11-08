/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("creator cache prefix reads use the schema index under a non-C collation", () => {
	const result = spawnSync(process.execPath, ["--import", "tsx", "--test-reporter=tap", "--test", join(process.cwd(), "test/support/cache-prefix-index.ts")], { encoding: "utf8", timeout: 60000 });
	expect(result.error).toBeUndefined();
	expect(result.stdout + result.stderr).toContain("# fail 0");
	expect(result.status).toBe(0);
}, 65000);
