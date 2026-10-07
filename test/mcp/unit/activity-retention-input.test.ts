/** @jest-environment node */
export {};
let prune: ((input: Record<string, unknown>, client: unknown) => Promise<unknown>) | undefined;
let operational: typeof prune;
let revoked: typeof prune;
try {
	const cleanup = require("@/server/mcp/cleanup");
	prune = cleanup.pruneMcpActivity;
	operational = cleanup.pruneMcpOperationalRecords;
	revoked = cleanup.pruneRevokedMcpCredentials;
} catch {}
const saved = process.env.MCP_ACTIVITY_RETENTION_DAYS;
describe("TDD-PRIVACY-003 retention input boundaries", () => {
	afterEach(() => {
		if (saved === undefined) delete process.env.MCP_ACTIVITY_RETENTION_DAYS;
		else process.env.MCP_ACTIVITY_RETENTION_DAYS = saved;
	});
	test.each(["0", "-1", "366", "1.5", "", "unbounded"])("invalid retention %s cannot enter a transaction", async (days) => {
		process.env.MCP_ACTIVITY_RETENTION_DAYS = days;
		expect(prune).toEqual(expect.any(Function));
		const transaction = jest.fn();
		await expect(prune!({}, { transaction })).rejects.toThrow("INVALID_INPUT");
		expect(transaction).not.toHaveBeenCalled();
	});
	test.each([{ batchSize: 0 }, { batchSize: 501 }, { batchSize: 1.5 }, { now: new Date(NaN) }, { now: new Date(-8640000000000000) }])("invalid input %j cannot enter a transaction", async (input) => {
		delete process.env.MCP_ACTIVITY_RETENTION_DAYS;
		expect(prune).toEqual(expect.any(Function));
		const transaction = jest.fn();
		await expect(prune!(input, { transaction })).rejects.toThrow("INVALID_INPUT");
		expect(transaction).not.toHaveBeenCalled();
	});
});

describe("operational cleanup rejects unbounded sweeps before database access", () => {
	test.each([0, 501, 1.5, Number.MAX_SAFE_INTEGER + 1])("invalid batch %s is rejected by both sweep types", async (batchSize) => {
		for (const sweep of [operational, revoked]) {
			expect(sweep).toEqual(expect.any(Function));
			const transaction = jest.fn();
			await expect(sweep!({ batchSize }, { transaction })).rejects.toThrow("INVALID_INPUT");
			expect(transaction).not.toHaveBeenCalled();
		}
	});
	test("an invalid operational timestamp cannot start a sweep", async () => {
		const transaction = jest.fn();
		await expect(operational!({ now: new Date(NaN) }, { transaction })).rejects.toThrow("INVALID_INPUT");
		expect(transaction).not.toHaveBeenCalled();
	});
	test("omitted operational input uses a bounded transaction and returns independent counts", async () => {
		const execute = jest
			.fn()
			.mockResolvedValueOnce({ rows: [{ id: "client" }] })
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ id: "counter" }, { id: "counter-2" }] });
		const transaction = jest.fn((work) => work({ execute }));
		await expect(operational!(undefined as any, { transaction })).resolves.toEqual({ clients: 1, retries: 0, counters: 2 });
		expect(transaction).toHaveBeenCalledTimes(1);
		expect(execute).toHaveBeenCalledTimes(3);
	});
	test("omitted revoked input returns independent access refresh and consent counts", async () => {
		const execute = jest
			.fn()
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce({ rows: [{ id: "refresh" }] })
			.mockResolvedValueOnce({ rows: [{ id: "consent" }] });
		const transaction = jest.fn((work) => work({ execute }));
		await expect(revoked!(undefined as any, { transaction })).resolves.toEqual({ accessTokens: 0, refreshTokens: 1, consents: 1 });
		expect(execute).toHaveBeenCalledTimes(3);
	});
});
