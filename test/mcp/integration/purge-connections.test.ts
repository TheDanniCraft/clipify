/** @jest-environment node */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
test("inactive connection cleanup preserves active authority and audit history in PostgreSQL", () => {
	const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", join(process.cwd(), "test/mcp/integration/purge-connections-probe.ts")], { encoding: "utf8", timeout: 30000 });
	expect(result.error).toBeUndefined();
	expect(result.stdout + result.stderr).toContain("# fail 0");
	expect(result.status).toBe(0);
}, 35000);
