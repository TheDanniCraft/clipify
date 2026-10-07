/** @jest-environment node */
export {};
jest.mock("server-only", () => ({}));
const resultRows = jest.fn();
const connect = jest.fn();
const token = jest.fn();
jest.mock("@/db/client", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: () => ({ execute: () => resultRows() }) }) }) }) }, dbPool: { options: { max: 3 }, connect: (...args: unknown[]) => connect(...args) } }));
jest.mock("@/db/request-scope", () => ({ withoutDatabaseRequest: (operation: () => unknown) => operation() }));
jest.mock("@/auth/config", () => ({ auth: { api: { getAccessToken: (...args: unknown[]) => token(...args) } } }));
import { getBetterAuthProviderAccessToken, withSerializedProviderCredential } from "@/server/provider-credentials";
import type { Pool } from "pg";
beforeEach(() => jest.resetAllMocks());
test("creator without identity link cannot request credentials", async () => {
	resultRows.mockResolvedValue([]);
	expect(await getBetterAuthProviderAccessToken("creator")).toBeNull();
	expect(resultRows).toHaveBeenCalledTimes(1);
	expect(connect).not.toHaveBeenCalled();
	expect(token).not.toHaveBeenCalled();
});
test("linked identity without Twitch account cannot request credentials", async () => {
	resultRows.mockResolvedValueOnce([{ authUserId: "actor" }]).mockResolvedValueOnce([]);
	expect(await getBetterAuthProviderAccessToken("creator")).toBeNull();
	expect(connect).not.toHaveBeenCalled();
	expect(token).not.toHaveBeenCalled();
});
test.each([0, 1, -1, 1.5, Number.POSITIVE_INFINITY])("pool maximum %p refuses credential work before acquiring a connection", async (max) => {
	const pool = { options: { max }, connect: jest.fn() } as unknown as Pool;
	const operation = jest.fn();
	await expect(withSerializedProviderCredential(pool, "account", operation)).rejects.toThrow("PROVIDER_CREDENTIAL_CAPACITY_UNAVAILABLE");
	expect(pool.connect).not.toHaveBeenCalled();
	expect(operation).not.toHaveBeenCalled();
});
test("pool without explicit maximum uses bounded admission and releases its lock", async () => {
	const query = jest.fn().mockResolvedValue({ rows: [] });
	const release = jest.fn();
	const pool = { options: {}, connect: jest.fn().mockResolvedValue({ query, release }) } as unknown as Pool;
	expect(await withSerializedProviderCredential(pool, "account", async () => "done")).toBe("done");
	expect(query).toHaveBeenCalledWith("SELECT pg_advisory_unlock(hashtextextended($1, 0))", ["clipify:twitch:account"]);
	expect(release).toHaveBeenCalledWith(false);
});
