import { createHmac } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { fixtureDatabase, fixtureOrigin, fixtureCreator } from "./environment";

declare const Bun: { serve(options: { port: number; hostname: string; tls: { cert: Buffer; key: Buffer }; fetch(request: Request): Response | Promise<Response> }): unknown };

async function main() {
	const database = fixtureDatabase();
	const { Pool } = await import("pg");
	const pool = new Pool({ connectionString: database.href });
	const { initializeMcpFixtureSchema } = await import("../mcp/postgres");
	await initializeMcpFixtureSchema(pool);
	await pool.query("INSERT INTO auth.\"user\"(id,name,email,email_verified) VALUES('fixture-admin-auth','Fixture administrator','admin@connected-app.invalid',true),('fixture-viewer-auth','Fixture viewer','viewer@connected-app.invalid',true)");
	for (const [id, name, role] of [
		["fixture-admin", "Fixture admin", "admin"],
		[fixtureCreator, "Fixture creator", "user"],
		["999999999", "Foreign creator", "user"],
		["fixture-viewer", "Fixture viewer", "user"],
	]) {
		await pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES($1,$2,$3,'',$4,'free')", [id, `${id}@connected-app.invalid`, name, role]);
		await pool.query("INSERT INTO auth.organization(id,name,slug,created_at) VALUES($1,$2,$1,now())", [`${id}-org`, name]);
		await pool.query("INSERT INTO creator_accounts(organization_id,creator_id,status) VALUES($1,$2,'active')", [`${id}-org`, id]);
	}
	await pool.query("INSERT INTO creator_identity_links(creator_id,auth_user_id,source) VALUES('fixture-admin','fixture-admin-auth','admin_repair'),('fixture-viewer','fixture-viewer-auth','admin_repair')");
	for (const [id, title, owner] of [
		["FixtureMinecraftOne", "Minecraft castle", fixtureCreator],
		["FixtureCounterStrike", "Counter-Strike clutch", fixtureCreator],
		["FixtureMinecraftTwo", "Minecraft village", fixtureCreator],
		["FixtureForeignClip", "Minecraft private foreign clip", "999999999"],
	]) {
		const clip = { id, title, broadcaster_id: owner, broadcaster_name: "Fixture creator", duration: 30, view_count: 12, created_at: "2026-11-01T12:00:00.000Z", thumbnail_url: `https://static-cdn.jtvnw.net/${id}.jpg` };
		await pool.query("INSERT INTO \"twitchCache\"(type,key,value) VALUES('clip',$1,$2)", [`clip:${owner}:${id}`, JSON.stringify({ clip, lastValidatedAt: new Date().toISOString() })]);
	}
	await pool.query("INSERT INTO \"twitchCache\"(type,key,value) VALUES('clip',$1,$2)", [`clip-sync:${fixtureCreator}`, JSON.stringify({ backfillComplete: true })]);
	const { auth } = await import("@/auth/config");
	const context = await auth.$context;
	const { handleConnectedAppRequest } = await import("@/server/connected-apps/gateway");
	const { handleConnectedAppAdminRequest } = await import("@/server/connected-apps/admin");
	async function sessionCookie(userId: string) {
		const session = await context.internalAdapter.createSession(userId);
		if (!session || typeof context.secret !== "string") throw new Error("FIXTURE_SESSION_REQUIRED");
		const signed = `${session.token}.${createHmac("sha256", context.secret).update(session.token).digest("base64")}`;
		return `${context.authCookies.sessionToken.name}=${signed}`;
	}
	const adminCookie = await sessionCookie("fixture-admin-auth");
	const viewerCookie = await sessionCookie("fixture-viewer-auth");
	let ready = false;
	Bun.serve({
		port: 3108,
		hostname: "0.0.0.0",
		tls: { cert: await readFile("/fixture-secrets/ca.crt"), key: await readFile("/fixture-secrets/ca.key") },
		async fetch(request) {
			const path = new URL(request.url).pathname;
			if (path === "/health") return new Response(ready ? "ready" : "starting", { status: ready ? 200 : 503 });
			if (path.startsWith("/api/auth/")) {
				const response = await auth.handler(request);
				console.log(`fixture HTTP ${path}: ${response.status}`);
				return response;
			}
			if (path === "/api/connected-apps/admin" && request.method === "POST") return handleConnectedAppAdminRequest(request);
			if (path === "/api/connected-apps" && request.method === "POST") {
				const response = await handleConnectedAppRequest(request);
				console.log(`fixture HTTP ${path}: ${response.status}`);
				return response;
			}
			return new Response(null, { status: 404 });
		},
	});
	const response = await fetch(`${fixtureOrigin}/api/connected-apps/admin`, { method: "POST", headers: { "Content-Type": "application/json", Origin: fixtureOrigin, Cookie: adminCookie }, body: JSON.stringify({ action: "provision", name: "Isolated Babbler acceptance", creatorId: fixtureCreator, expiresAt: new Date(Date.now() + 3600_000).toISOString() }) });
	const result = await response.json();
	if (!response.ok || !result.ok || !result.data?.clientId || !result.data.clientSecret || !result.data.grantId) throw new Error(`FIXTURE_PROVISION_FAILED:${response.status}:${result.error?.code ?? "unexpected response"}`);
	for (const [name, value] of Object.entries({ client_id: result.data.clientId, client_secret: result.data.clientSecret, grant_id: result.data.grantId, admin_cookie: adminCookie, viewer_cookie: viewerCookie })) {
		await writeFile(`/fixture-secrets/${name}`, value as string, { mode: 0o600 });
		await chmod(`/fixture-secrets/${name}`, 0o444);
	}
	await pool.end();
	ready = true;
	console.log("Connected application fixture ready; no creator login or shared database credentials used.");
}
main().catch((error) => {
	console.error(error);
	process.exit(1);
});
