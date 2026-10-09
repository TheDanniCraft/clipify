/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("real Next proxy preserves completion, disconnect cancellation and error handling", () => {
	const result = spawnSync(process.execPath, ["--test", join(process.cwd(), "test/support/proxy/lifecycle.cjs")], { encoding: "utf8", timeout: 15000 });
	expect(result.error).toBeUndefined();
	expect(result.status).toBe(0);
	expect(result.stdout).toContain("# pass 5");
});
