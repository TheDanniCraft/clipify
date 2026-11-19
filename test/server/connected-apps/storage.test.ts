/** @jest-environment ./test/helpers/pgliteEnvironment.cjs */
import { drizzle } from "drizzle-orm/pglite";
let client: ReturnType<typeof drizzle>;
let transactionDepth = 0;
jest.mock("@/db/client", () => ({
	get db() {
		return {
			select: client.select.bind(client),
			transaction: (operation: (tx: unknown) => Promise<unknown>) =>
				client.transaction(async (tx) => {
					transactionDepth++;
					try {
						return await operation(tx);
					} finally {
						transactionDepth--;
					}
				}),
		};
	},
}));
const rate = jest.fn().mockResolvedValue({ allowed: true });
jest.mock("@/server/mcp/rate-limit", () => ({ consumeMcpRateLimit: (...args: unknown[]) => rate(...args) }));
import { withConnectedAppGrant, exportConnectedAppGrants } from "@/server/connected-apps/storage";
declare const PGlite: typeof import("@electric-sql/pglite").PGlite;
let database: InstanceType<typeof PGlite>;
const identity = { clientId: "app", creatorId: "creator", operation: "search_clips" };
beforeAll(async () => {
	database = new PGlite();
	client = drizzle(database);
	await database.exec(
		`CREATE SCHEMA auth; CREATE TABLE auth.oauth_client(client_id text primary key,disabled boolean);CREATE TABLE users(id varchar primary key,disabled boolean);CREATE TABLE creator_accounts(creator_id varchar primary key,status text);CREATE TABLE connected_app_grants(id uuid primary key default gen_random_uuid(),client_id text unique,creator_id varchar,operations text[],expires_at timestamptz,revoked_at timestamptz,provisioned_by text,created_at timestamptz default now());CREATE TABLE audit_events(id uuid primary key default gen_random_uuid(),occurred_at timestamptz default now(),actor_user_id text,actor_session_id text,account_organization_id text,target_type text,target_id text,action text,outcome text,reason text,correlation_id text,ip_prefix text,user_agent_family text,metadata jsonb);`,
	);
});
afterAll(async () => database.close());
beforeEach(async () => {
	rate.mockReset().mockResolvedValue({ allowed: true });
	await database.exec(`TRUNCATE connected_app_grants,auth.oauth_client,users,creator_accounts,audit_events;INSERT INTO auth.oauth_client VALUES('app',false);INSERT INTO users VALUES('creator',false);INSERT INTO creator_accounts VALUES('creator','active');INSERT INTO connected_app_grants(client_id,creator_id,operations,expires_at)VALUES('app','creator',ARRAY['search_clips'],now()+interval '1 hour');`);
});
it("executes and audits an enabled grant without impersonating a user", async () => {
	const result = await withConnectedAppGrant(identity, async () => {
		expect(transactionDepth).toBe(0);
		return { items: ["matching"] };
	});
	expect(result).toEqual({ items: ["matching"] });
	expect(rate).toHaveBeenCalledWith(expect.objectContaining({ network: expect.stringMatching(/^application:/), authUserId: expect.stringMatching(/^application:/), clientId: "app" }));
	const audit = await database.query<{ actor_user_id: null; metadata: { clientId: string } }>("select actor_user_id,metadata from audit_events");
	expect(audit.rows[0]).toMatchObject({ actor_user_id: null, metadata: { clientId: "app", creatorId: "creator", operation: "search_clips" } });
});
it.each(["UPDATE users SET disabled=true WHERE id='creator'", "UPDATE creator_accounts SET status='suspended' WHERE creator_id='creator'", "UPDATE auth.oauth_client SET disabled=true WHERE client_id='app'"])("rechecks authority changed during an operation: %s", async (sql) => {
	await expect(
		withConnectedAppGrant(identity, async () => {
			await database.exec(sql);
			return { items: ["must-not-leak"] };
		}),
	).rejects.toThrow("ACCESS_DENIED");
});
it("refuses foreign creators, revoked grants and exhausted shared budgets", async () => {
	const operation = jest.fn();
	await expect(withConnectedAppGrant({ ...identity, creatorId: "foreign" }, operation)).rejects.toThrow("ACCESS_DENIED");
	expect(operation).not.toHaveBeenCalled();
	await database.exec("UPDATE connected_app_grants SET revoked_at=now()");
	await expect(withConnectedAppGrant(identity, operation)).rejects.toThrow("ACCESS_DENIED");
	await database.exec("UPDATE connected_app_grants SET revoked_at=null");
	rate.mockResolvedValue({ allowed: false });
	await expect(withConnectedAppGrant(identity, operation)).rejects.toThrow("RATE_LIMITED");
	expect(operation).not.toHaveBeenCalled();
});

it("exports only creator-owned connection metadata without credentials", async () => {
	const own = await exportConnectedAppGrants("creator");
	expect(own).toHaveLength(1);
	expect(own[0]).toMatchObject({ clientId: "app", creatorId: "creator", operations: ["search_clips"] });
	expect(JSON.stringify(own)).not.toMatch(/client_secret|token|provisionedBy/);
	expect(await exportConnectedAppGrants("foreign")).toEqual([]);
});
