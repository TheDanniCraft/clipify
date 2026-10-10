/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

test("notification failure transitions work against PostgreSQL", () => {
	const result = spawnSync(process.execPath, ["--import", "tsx", "--test", join(process.cwd(), "test/support/notifications/outbox-failures.ts")], { encoding: "utf8", timeout: 30000 });
	expect(result.error).toBeUndefined();
	expect(result.stdout + result.stderr).toContain("# fail 0");
	expect(result.status).toBe(0);
}, 35000);
