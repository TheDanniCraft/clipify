import { test } from "node:test";
import assert from "node:assert/strict";
import { createMcpPostgresFixture } from "./mcp/postgres";

test("creator clip queries constrain the indexed key prefix rather than scan other creators", async () => {
	const fixture = await createMcpPostgresFixture();
	try {
		await fixture.pool.query(`CREATE COLLATION cache_prefix_locale (provider = icu, locale = 'en-US');
		 ALTER TABLE "twitchCache" ALTER COLUMN key TYPE varchar COLLATE cache_prefix_locale;
		 INSERT INTO "twitchCache" (type,key,value)
		 SELECT 'clip','clip:'||owner||':'||clip,'{"clip":{"id":"sample","created_at":"2026-11-01T00:00:00Z","view_count":10}}'
		 FROM generate_series(1,1000) owner CROSS JOIN generate_series(1,50) clip;
		 ANALYZE "twitchCache";`);
		const query = `SELECT count(*)::int FROM "twitchCache" WHERE type='clip' AND key LIKE $1
		 AND (expires_at IS NULL OR expires_at>now())
		 AND coalesce((value::jsonb->>'unavailable')::boolean,false)=false`;
		const plan = await fixture.pool.query(`EXPLAIN (FORMAT JSON) ${query}`, ["clip:274:%"]);
		const serialized = JSON.stringify(plan.rows);
		assert.match(serialized, /twitch_cache_type_key_prefix_idx/);
		assert.match(serialized, /Index Cond/);
		assert.doesNotMatch(serialized, /Seq Scan/);
		assert.equal((await fixture.pool.query(query, ["clip:274:%"])).rows[0].count, 50);
		assert.equal((await fixture.pool.query(query, ["clip:2740:%"])).rows[0].count, 0);
	} finally {
		await fixture.close();
	}
});
