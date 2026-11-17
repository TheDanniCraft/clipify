/** @jest-environment node */
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, writeFile, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const exec = promisify(execFile);
it("writes one-time application credentials privately without logging them", async () => {
	const directory = await mkdtemp(join(tmpdir(), "clipify-operator-"));
	const cookie = join(directory, "session");
	await writeFile(cookie, "better-auth.session_token=fixture-admin", { mode: 0o600 });
	const server = createServer((request, response) => {
		expect(request.url).toBe("/api/connected-apps/admin");
		expect(request.headers.cookie).toContain("fixture-admin");
		expect(request.headers.origin).toMatch(/^http:\/\/127.0.0.1:/);
		response.setHeader("Content-Type", "application/json");
		response.end(JSON.stringify({ ok: true, data: { clientId: "client", clientSecret: "secret-never-log", grantId: "grant", creatorId: "creator" } }));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		const address = server.address() as { port: number };
		const result = await exec(process.execPath, ["scripts/connected-apps.mjs", "provision", "--creator", "creator", "--name", "Awards", "--out", join(directory, "connection")], { cwd: process.cwd(), env: { ...process.env, CLIPIFY_BASE_URL: `http://127.0.0.1:${address.port}`, CLIPIFY_ADMIN_COOKIE_FILE: cookie, CLIPIFY_ALLOW_INSECURE_HTTP: "true" } });
		expect(result.stdout + result.stderr).not.toContain("secret-never-log");
		expect(await readFile(join(directory, "connection", "client-secret"), "utf8")).toBe("secret-never-log");
		expect((await stat(join(directory, "connection", "client-secret"))).mode & 0o777).toBe(0o600);
	} finally {
		await new Promise<void>((resolve) => server.close(() => resolve()));
		await rm(directory, { recursive: true, force: true });
	}
});
