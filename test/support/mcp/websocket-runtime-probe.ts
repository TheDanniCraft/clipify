import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { createMcpPostgresFixture } from "./postgres";
async function main() {
	const fixture = await createMcpPostgresFixture();
	process.env.DATABASE_URL = fixture.url;
	process.env.APP_ENV = "test";
	process.env.DISABLE_BACKGROUND_JOBS = "true";
	process.env.BETTER_AUTH_SECRET = "isolated-websocket-provider-secret-32chars";
	process.env.NEXT_PUBLIC_BASE_URL = "http://127.0.0.1:3107";
	const idle = process.argv[2].startsWith("idle-");
	const activity = process.argv[2].startsWith("activity-");
	const mode = process.argv[2].replace(/^(idle|activity)-/, ""),
		overlayId = randomUUID();
	try {
		await fixture.pool.query(`INSERT INTO auth.organization(id,name,slug,created_at) VALUES('runtime-org','Runtime','runtime-org',now()); INSERT INTO users(id,email,username,avatar,role,plan) VALUES('runtime-owner','runtime@example.invalid','Runtime','','user','pro'); INSERT INTO creator_accounts(creator_id,organization_id,status) VALUES('runtime-owner','runtime-org','active')`);
		await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'runtime-owner','isolated-runtime-secret','Runtime','active','Featured')", [overlayId]);
		const { handleMessage } = await import("@/app/actions/websocket");
		const { addSubscriber, overlaySubscribers, getActiveOverlayOwnerIds } = await import("@/app/store/overlaySubscribers");
		const closes: number[] = [],
			messages: string[] = [];
		const source: any = Object.assign(new EventEmitter(), {
			readyState: 1,
			close(code: number) {
				closes.push(code);
			},
			send(_message: string) {},
			ping() {},
			terminate() {},
		});
		let heartbeat: (() => unknown) | undefined;
		if (idle) {
			const original = globalThis.setInterval;
			globalThis.setInterval = ((callback: () => unknown) => {
				heartbeat = callback;
				return 1 as any;
			}) as any;
			try {
				const { UPGRADE } = await import("@/app/ws/route");
				UPGRADE(source, { clients: new Set([source]) } as any);
			} finally {
				globalThis.setInterval = original;
			}
		}
		await handleMessage(Buffer.from(JSON.stringify({ type: "subscribe", data: { overlayId, secret: "isolated-runtime-secret" } })), source);
		if (closes.length || source.overlayId !== overlayId) throw new Error("Runtime fixture subscription failed");
		source.sourceActive = true;
		const controller: any = {
			role: "controller",
			readyState: 1,
			send(message: string) {
				messages.push(message);
			},
		};
		addSubscriber("runtime-owner", overlayId, controller);
		if (mode === "paused") await fixture.pool.query("UPDATE overlays SET status='paused' WHERE id=$1", [overlayId]);
		if (mode === "deleted") await fixture.pool.query("DELETE FROM overlays WHERE id=$1", [overlayId]);
		if (mode === "disabled") await fixture.pool.query("UPDATE users SET disabled=true WHERE id='runtime-owner'");
		if (mode === "suspended") await fixture.pool.query("UPDATE creator_accounts SET status='suspended'");
		if (mode === "rotated") await fixture.pool.query("UPDATE overlays SET secret='rotated-isolated-secret' WHERE id=$1", [overlayId]);
		if (mode === "restricted") {
			await fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type,created_at) VALUES($1,'runtime-owner','earlier-isolated-secret','Earlier','active','Featured',now()-interval '1 day')", [randomUUID()]);
			await fixture.pool.query("UPDATE users SET plan='free' WHERE id='runtime-owner'");
		}
		if (idle) {
			if (!heartbeat) throw new Error("Fixture heartbeat not installed");
			await heartbeat();
		} else await handleMessage(Buffer.from(JSON.stringify(activity ? { type: "source_activity", data: { active: true } } : { type: "state_update", data: { kind: "heartbeat" } })), source);
		console.log(JSON.stringify({ closes, messages, sourceActive: source.sourceActive, registered: overlaySubscribers.get(overlayId)?.has(source) ?? false, activeOwners: [...getActiveOverlayOwnerIds()] }));
	} finally {
		const { dbPool } = await import("@/db/client");
		await dbPool.end();
		await fixture.close();
	}
}
void main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
