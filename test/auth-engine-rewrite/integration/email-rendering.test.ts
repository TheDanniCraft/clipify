/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("real React Email renderer produces branded HTML and plain text", () => {
	const result = spawnSync(process.execPath, ["--import", "tsx", "--test", join(process.cwd(), "test/support/email/rendering.ts")], { encoding: "utf8", timeout: 20000 });
	expect(result.error).toBeUndefined();
	expect(result.stdout + result.stderr).toContain("# fail 0");
	expect(result.status).toBe(0);
}, 25000);
