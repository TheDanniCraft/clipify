import { existsSync } from "node:fs";
import type { createMcpPostgresFixture } from "./postgres";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { overlaysTable, playlistsTable } from "@/db/schema";
import { StatusOptions, OverlayType } from "@types";
export async function runRetryFixture(fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>, principal: TrustedCreatorPrincipal, mode: string) {
	const helper = existsSync("src/server/resources/create-retry.ts") ? await import("@/server/resources/create-retry") : null;
	if (!helper) return { helperAvailable: false };
	const playlist = mode.startsWith("retries:playlist:");
	mode = mode.replace("retries:playlist:", "retries:");
	const input = { creatorId: "fixture-creator", retryKey: "retained-create", name: "Safe overlay" };
	let creations = 0;
	const create = async (tx: any) => {
		creations++;
		const [overlay] = playlist ? await tx.insert(playlistsTable).values({ ownerId: input.creatorId, name: input.name }).returning() : await tx.insert(overlaysTable).values({ ownerId: input.creatorId, name: input.name, secret: "private-create-secret", status: StatusOptions.Active, type: OverlayType.Featured }).returning();
		if (mode === "retries:rollback" && creations === 1) throw new Error("fixture-failure-before-commit");
		return overlay;
	};
	const call = (args = input) => fixture.db.transaction((tx) => helper.createWithRetry(tx, principal, playlist ? "create_playlist" : "create_overlay", args, create));
	let failure: string | undefined,
		results: any[] = [];
	if (mode === "retries:audit-failure") await fixture.pool.query("ALTER TABLE audit_events ADD CONSTRAINT fixture_audit_failure CHECK(false) NOT VALID");
	if (mode === "retries:concurrent") results = await Promise.all(Array.from({ length: 20 }, () => call()));
	else {
		try {
			results.push(await call());
		} catch (error) {
			failure = error instanceof Error ? error.message : "failure";
		}
		async function changeRetryPersistence() {
			if (mode === "retries:audit-failure") await fixture.pool.query("ALTER TABLE audit_events DROP CONSTRAINT fixture_audit_failure");
			if (mode === "retries:deleted") await fixture.pool.query(playlist ? "DELETE FROM playlists" : "DELETE FROM overlays");
			if (mode === "retries:expired") await fixture.pool.query("UPDATE mcp_mutation_retries SET created_at=now()-interval '25 hours',expires_at=now()-interval '1 hour'");
			if (mode === "retries:revoked") await fixture.pool.query("UPDATE mcp_connection_grants SET active=false,revoked_at=now() WHERE id=$1", [principal.grantId]);
		}
		await changeRetryPersistence();
		try {
			results.push(await call(mode === "retries:conflict" ? { ...input, name: "Changed intent" } : input));
		} catch (error) {
			failure = error instanceof Error ? error.message : "failure";
		}
	}
	const counts = await fixture.pool.query("SELECT (SELECT count(*) FROM " + (playlist ? "playlists" : "overlays") + ") AS resources,(SELECT count(*) FROM mcp_mutation_retries) AS retries,(SELECT count(*) FROM audit_events) AS audits");
	const privateState = await fixture.pool.query("SELECT safe_response FROM mcp_mutation_retries UNION ALL SELECT metadata FROM audit_events");
	return { storedSafe: !JSON.stringify(privateState.rows).includes("private-create-secret"), helperAvailable: true, creations, resources: Number(counts.rows[0].resources), retries: Number(counts.rows[0].retries), audits: Number(counts.rows[0].audits), resultIds: results.map((value) => value.id), resultsSafe: !JSON.stringify(results).includes("private-create-secret"), failure };
}
