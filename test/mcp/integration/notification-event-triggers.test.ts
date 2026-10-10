/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
test("PostgreSQL fallback notifications are atomic and deduplicate app writes", () => {
	const result = spawnSync(process.execPath, ["--import", "tsx", "--test", join(process.cwd(), "test/support/notifications/database-triggers.ts")], { encoding: "utf8", timeout: 30000 });
	expect(result.error).toBeUndefined();
	expect(result.stdout + result.stderr).toContain("# fail 0");
	expect(result.status).toBe(0);
}, 35000);
