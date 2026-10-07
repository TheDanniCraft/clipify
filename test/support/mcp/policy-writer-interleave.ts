import type { Pool } from "pg";

/** Observe a real independent policy writer at the final resource-write boundary. */
export function interleaveOwnerPolicyWriter(writerPool: Pool, ownerId: string, change: "plan" | "disabled" | "membership-remove" | "membership-role" | "custom-role" | "custom-role-remove" | "agency-ceiling" | "agency-revoke" | "agency-delete" | "grant-revoke" | "grant-remove" | "grant-expire" | "global-grant-revoke" | "global-grant-remove" | "global-grant-expire" | "allocation-revoke" | "allocation-remove" | "allocation-expire", actorId?: string) {
	const pool = (globalThis as any).__dbPool as Pool;
	if (!pool) throw new Error("Application query pool unavailable");
	const originalQuery = pool.query.bind(pool),
		originalConnect = pool.connect.bind(pool);
	let started = false,
		blocked: boolean | undefined,
		completed = false,
		pending: Promise<unknown> | undefined;
	let failure: unknown;
	async function before(args: any[]) {
		const sql = typeof args[0] === "string" ? args[0] : args[0]?.text;
		if (started || typeof sql !== "string" || !sql.startsWith('update "overlays"')) return;
		started = true;

		if ((change.startsWith("membership") || change === "agency-revoke") && !actorId) throw new Error("Policy fixture actor unavailable");
		const policies: Record<typeof change, { sql: string; values: unknown[] }> = {
			plan: { sql: "UPDATE users SET plan='free' WHERE id=$1", values: [ownerId] },
			disabled: { sql: "UPDATE users SET disabled=true WHERE id=$1", values: [ownerId] },
			"membership-remove": { sql: "DELETE FROM auth.member WHERE user_id=$1 AND organization_id='creator-org'", values: [actorId] },
			"membership-role": { sql: "UPDATE auth.member SET role='analyst' WHERE user_id=$1 AND organization_id='creator-org'", values: [actorId] },
			"custom-role": { sql: "UPDATE auth.organization_role SET permission=$2 WHERE organization_id=$1 AND role='runtime-editor'", values: ["creator-org", JSON.stringify({ creator: ["read"], overlay: [] })] },
			"custom-role-remove": { sql: "DELETE FROM auth.organization_role WHERE organization_id=$1 AND role='runtime-editor'", values: ["creator-org"] },
			"agency-ceiling": { sql: "UPDATE agency_creator_links SET permission_ceiling=$1::jsonb WHERE agency_organization_id='policy-agency-org' AND creator_organization_id='creator-org'", values: [JSON.stringify(["creator:read", "overlay:read"])] },
			"agency-revoke": { sql: "UPDATE agency_creator_links SET status='revoked',revoked_by=$1,revoked_at=now() WHERE agency_organization_id='policy-agency-org' AND creator_organization_id='creator-org'", values: [actorId] },
			"agency-delete": { sql: "DELETE FROM agency_creator_links WHERE agency_organization_id=$1 AND creator_organization_id='creator-org'", values: ["policy-agency-org"] },
			"grant-revoke": { sql: "UPDATE entitlement_grants SET revoked_at=now() WHERE user_id=$1 AND entitlement='pro_access'", values: [ownerId] },
			"grant-remove": { sql: "DELETE FROM entitlement_grants WHERE user_id=$1 AND entitlement='pro_access'", values: [ownerId] },
			"grant-expire": { sql: "UPDATE entitlement_grants SET ends_at=now() WHERE user_id=$1 AND entitlement='pro_access'", values: [ownerId] },
			"global-grant-revoke": { sql: "UPDATE entitlement_grants SET revoked_at=now() WHERE user_id IS NULL AND entitlement='pro_access'", values: [] },
			"global-grant-remove": { sql: "DELETE FROM entitlement_grants WHERE user_id IS NULL AND entitlement='pro_access'", values: [] },
			"global-grant-expire": { sql: "UPDATE entitlement_grants SET ends_at=now() WHERE user_id IS NULL AND entitlement='pro_access'", values: [] },
			"allocation-revoke": { sql: "UPDATE agency_license_allocations SET status='ended' WHERE creator_id=$1 AND product='creator_pro'", values: [ownerId] },
			"allocation-remove": { sql: "DELETE FROM agency_license_allocations WHERE creator_id=$1 AND product='creator_pro'", values: [ownerId] },
			"allocation-expire": { sql: "UPDATE agency_license_allocations SET ends_at=now() WHERE creator_id=$1 AND product='creator_pro'", values: [ownerId] },
		};
		const writer = await writerPool.connect();
		const pid = Number((await writer.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
		pending = writer
			.query(policies[change].sql, policies[change].values)
			.then((result) => {
				if (result.rowCount !== 1) throw new Error("Policy fixture must update exactly one intended row");
				completed = true;
			})
			.finally(() => writer.release());
		pending.catch((error) => {
			failure = error;
		});
		const deadline = performance.now() + 3000;
		while (!completed) {
			if (failure) throw failure;
			const state = await writerPool.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [pid]);
			if (state.rows[0]?.wait_event_type === "Lock") {
				blocked = true;
				return;
			}
			if (performance.now() > deadline) throw new Error("Policy fixture neither committed nor reached actual row-lock wait");
			await new Promise((resolve) => setTimeout(resolve, 10));
		}
		blocked = false;
	}
	function query(original: any, args: any[]) {
		const callback = args.at(-1);
		if (typeof callback === "function") {
			void before(args).then(
				() => original(...args),
				(error) => callback(error),
			);
			return;
		}
		return before(args).then(() => original(...args));
	}
	const wrap = (client: any) =>
		new Proxy(client, {
			get(target, key) {
				const value = Reflect.get(target, key);
				if (key === "query") return (...args: any[]) => query(value.bind(target), args);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
	(pool as any).query = (...args: any[]) => query(originalQuery, args);
	(pool as any).connect = (callback?: any) => (typeof callback === "function" ? originalConnect((error, client, release) => callback(error, client ? wrap(client) : client, release)) : originalConnect().then(wrap));
	return {
		async finish() {
			await pending;
			return { started, blocked, completed };
		},
		restore() {
			pool.query = originalQuery;
			pool.connect = originalConnect;
		},
	};
}
