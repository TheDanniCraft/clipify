import { parseArgs } from "node:util";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

async function main() {
	const { values, positionals } = parseArgs({ allowPositionals: true, options: { creator: { type: "string" }, name: { type: "string" }, out: { type: "string" }, grant: { type: "string" }, expires: { type: "string" } } });
	const action = positionals[0];
	if (positionals.length !== 1 || !["provision", "revoke"].includes(action)) throw new Error("INVALID_INPUT");
	const base = new URL(process.env.CLIPIFY_BASE_URL ?? "");
	if (base.username || base.password || base.search || base.hash || base.pathname !== "/" || (base.protocol !== "https:" && !(base.protocol === "http:" && process.env.CLIPIFY_ALLOW_INSECURE_HTTP === "true" && ["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)))) throw new Error("INVALID_INPUT");
	const cookie = await readFile(process.env.CLIPIFY_ADMIN_COOKIE_FILE ?? "", "utf8");
	if (!cookie.trim()) throw new Error("AUTHENTICATION_REQUIRED");
	if (action === "provision" && (!values.creator || !values.name || !values.out)) throw new Error("INVALID_INPUT");
	if (action === "revoke" && !values.grant) throw new Error("INVALID_INPUT");
	if (action === "provision") await mkdir(values.out, { mode: 0o700 });
	let issued = false;
	try {
		const body = action === "revoke" ? { action, grantId: values.grant } : { action, creatorId: values.creator, name: values.name, expiresAt: values.expires ?? new Date(Date.now() + 30 * 86400000).toISOString() };
		const response = await fetch(new URL("/api/connected-apps/admin", base), { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/json", Origin: base.origin, Cookie: cookie.trim() }, body: JSON.stringify(body) });
		const reader = response.body?.getReader();
		if (!reader) throw new Error("SERVICE_UNAVAILABLE");
		let size = 0;
		const chunks = [];
		try {
			while (true) {
				const next = await reader.read();
				if (next.done) break;
				size += next.value.length;
				if (size > 16384) {
					await reader.cancel();
					throw new Error("SERVICE_UNAVAILABLE");
				}
				chunks.push(next.value);
			}
		} finally {
			reader.releaseLock();
		}
		const result = JSON.parse(Buffer.concat(chunks, size).toString("utf8"));
		if (!response.ok || result.ok !== true) throw new Error(typeof result.error?.code === "string" && /^[A-Z_]{1,64}$/.test(result.error.code) ? result.error.code : "SERVICE_UNAVAILABLE");
		if (action === "provision") {
			const data = result.data;
			if (!data || typeof data.clientId !== "string" || typeof data.clientSecret !== "string" || typeof data.grantId !== "string") throw new Error("SERVICE_UNAVAILABLE");
			issued = true;
			const files = { "client-id": data.clientId, "client-secret": data.clientSecret, "creator-id": values.creator, "connection.json": JSON.stringify({ grantId: data.grantId, creatorId: values.creator, baseUrl: base.origin, expiresAt: body.expiresAt }, null, 2) };
			for (const [name, content] of Object.entries(files)) await writeFile(join(values.out, name), content, { mode: 0o600, flag: "wx" });
			console.log(JSON.stringify({ ok: true, grantId: data.grantId, credentialsDirectory: values.out }));
		} else console.log(JSON.stringify({ ok: true, revoked: true }));
	} catch (error) {
		if (action === "provision" && !issued) await rm(values.out, { recursive: true, force: true });
		throw error;
	}
}
main().catch((error) => {
	const code = error instanceof Error && /^[A-Z_]{1,64}$/.test(error.message) ? error.message : "SERVICE_UNAVAILABLE";
	console.error(JSON.stringify({ ok: false, error: { code } }));
	process.exitCode = 1;
});
