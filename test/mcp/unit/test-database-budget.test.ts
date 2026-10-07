/** @jest-environment node */
export {};
const { selectDatabaseWorkers } = require("../../../scripts/test-database-budget.cjs");

test.each([
	[8, 100, 3, 1, 4],
	[2, 100, 3, 1, 2],
	[8, 64, 3, 29, 1],
	[8, 100, 3, 49, 2],
	[8, 32, 3, 30, 1],
])("%sCPU/RAM workers and PostgreSQL%s/%sreserved/%sused yield%sworkers", (workers, max_connections, reserved_connections, active_connections, expected) => {
	expect(selectDatabaseWorkers(workers, { max_connections, reserved_connections, active_connections })).toBe(expected);
});

test.each([undefined, { max_connections: 100, reserved_connections: -1, active_connections: 1 }, { max_connections: "100", reserved_connections: 3, active_connections: 1 }, { max_connections: 0, reserved_connections: 0, active_connections: 0 }])("unknown or malformed capacity%j falls back to one worker", (capacity) => {
	expect(selectDatabaseWorkers(8, capacity)).toBe(1);
});

async function readCapacity(url: string, failure = false) {
	const previous = process.env.MCP_TEST_DATABASE_URL;
	const query = jest.fn(async () => {
		if (failure) throw new Error("controlled fixture capacity unavailable");
		return { rows: [{ max_connections: 100, reserved_connections: 3, active_connections: 7 }] };
	});
	const end = jest.fn(async () => undefined);
	const Pool = jest.fn(() => ({ query, end }));
	process.env.MCP_TEST_DATABASE_URL = url;
	jest.resetModules();
	jest.doMock("pg", () => ({ Pool }));
	try {
		const result = await require("../../../scripts/test-database-budget.cjs").readFixtureDatabaseCapacity();
		return { result, Pool, query, end };
	} finally {
		if (previous === undefined) delete process.env.MCP_TEST_DATABASE_URL;
		else process.env.MCP_TEST_DATABASE_URL = previous;
		jest.dontMock("pg");
		jest.resetModules();
	}
}

test.each(["postgresql://127.0.0.1:54419/clipify_mcp_fixture", "postgresql://localhost:5432/clipify_e2e", "postgres://[::1]:54419/clipify_mcp_fixture"])("only disposable loopback capacity is queried:%s", async (url) => {
	const result = await readCapacity(url);
	expect(result.result).toEqual({ max_connections: 100, reserved_connections: 3, active_connections: 7 });
	expect(result.Pool).toHaveBeenCalledWith(expect.objectContaining({ max: 1, connectionTimeoutMillis: 1000, query_timeout: 1000 }));
	expect(result.query).toHaveBeenCalledWith(expect.stringMatching(/^SELECT current_setting/));
	expect(result.end).toHaveBeenCalledTimes(1);
});

test.each(["postgresql://db.example.invalid/clipify_e2e", "postgresql://127.0.0.1:54419/clipify_production", "https://127.0.0.1/clipify_e2e", "invalid"])("other databases never receive a capacity connection:%s", async (url) => {
	const result = await readCapacity(url);
	expect(result.result).toBeUndefined();
	expect(result.Pool).not.toHaveBeenCalled();
});

test("failed capacity lookup releases its pool and returns unknown capacity", async () => {
	const result = await readCapacity("postgresql://127.0.0.1:54419/clipify_mcp_fixture", true);
	expect(result.result).toBeUndefined();
	expect(result.end).toHaveBeenCalledTimes(1);
});
