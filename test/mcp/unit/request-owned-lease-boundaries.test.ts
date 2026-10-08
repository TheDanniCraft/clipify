/** @jest-environment node */
const mockConnect = jest.fn();
const mockCancelQuery = jest.fn();
const mockRelease = jest.fn();
const mockRawQuery = jest.fn();
const mockEnd = jest.fn();
const mockPoolErrorCallbacks: Array<() => void> = [];
const mockRaw = {
	query: mockRawQuery,
	fixture() {
		return this;
	},
};
jest.mock("pg", () => ({
	Pool: class {
		on(_event: string, callback: () => void) {
			mockPoolErrorCallbacks.push(callback);
			return this;
		}
		connect(callback?: (...args: any[]) => void) {
			return mockConnect(callback);
		}
		query(...args: unknown[]) {
			return mockCancelQuery(...args);
		}
		end() {
			return mockEnd();
		}
	},
}));
import { RequestAwarePool, withDatabaseRequest } from "@/db/request-scope";
beforeEach(() => {
	jest.clearAllMocks();
	mockConnect.mockReset();
	mockRawQuery.mockReset();
	mockCancelQuery.mockReset();
	mockEnd.mockReset();
	mockRawQuery.mockResolvedValue({ rows: [{ n: 1 }] });
	mockCancelQuery.mockResolvedValue({ rows: [] });
	mockEnd.mockResolvedValue(undefined);
	mockConnect.mockImplementation((callback) => (callback ? callback(undefined, mockRaw, mockRelease) : Promise.resolve(mockRaw)));
});
test("unscoped promise and callback acquisition preserve the native client", async () => {
	const pool = new RequestAwarePool({});
	expect(await pool.connect()).toBe(mockRaw);
	const callback = jest.fn();
	pool.connect(callback);
	expect(callback).toHaveBeenCalledWith(undefined, mockRaw, mockRelease);
	await pool.end();
});
test("owned string query carries an ownership marker and preserves parameters", async () => {
	const pool = new RequestAwarePool({});
	const response = await withDatabaseRequest(new AbortController().signal, async () => {
		const client = await pool.connect();
		expect((client as any).fixture()).toBe(mockRaw);
		expect(await client.query("SELECT $1", [7])).toEqual({ rows: [{ n: 1 }] });
		client.release();
		client.release();
		return new Response(null, { status: 204 });
	});
	expect(response.status).toBe(204);
	expect(mockRawQuery).toHaveBeenCalledWith(expect.stringMatching(/^\/\* clipify-mcp [\da-f-]+ \*\/ SELECT \$1$/), [7]);
	expect(mockRelease).toHaveBeenCalledTimes(1);
	expect(mockCancelQuery).not.toHaveBeenCalled();
	await pool.end();
});
test("owned named query config gains a marker without mutating caller config", async () => {
	const pool = new RequestAwarePool({});
	const config = { name: "caller-statement", text: "SELECT $1", values: [8] };
	await withDatabaseRequest(new AbortController().signal, async () => {
		const client = await pool.connect();
		await client.query(config);
		client.release();
		return new Response(null, { status: 204 });
	});
	expect(mockRawQuery).toHaveBeenCalledWith(expect.objectContaining({ name: undefined, text: expect.stringContaining("SELECT $1"), values: [8] }));
	expect(config).toEqual({ name: "caller-statement", text: "SELECT $1", values: [8] });
	await pool.end();
});
test.each([null, 42, { text: 42 }, { text: "SELECT 1", submit() {} }].map((query) => ({ query })))("unsupported owned query %p never reaches native SQL", async ({ query }) => {
	const pool = new RequestAwarePool({});
	await withDatabaseRequest(new AbortController().signal, async () => {
		const client = await pool.connect();
		expect(() => client.query(query as any)).toThrow("Unsupported request-owned database query");
		client.release();
		return new Response(null, { status: 204 });
	});
	expect(mockRawQuery).not.toHaveBeenCalled();
	await pool.end();
});
test.each([new Error("fixture acquisition error"), undefined].map((error) => ({ error })))("missing native lease fails once with %p", async ({ error }) => {
	const pool = new RequestAwarePool({});
	mockConnect.mockImplementation((callback) => callback(error, undefined, mockRelease));
	await expect(
		withDatabaseRequest(new AbortController().signal, async () => {
			await pool.connect();
			return new Response(null);
		}),
	).rejects.toThrow(error?.message ?? "Database lease unavailable");
	expect(mockRelease).not.toHaveBeenCalled();
	await pool.end();
});
test("late native acquisition is released after request abortion without delivery", async () => {
	const pool = new RequestAwarePool({});
	const controller = new AbortController();
	let callback!: (...args: any[]) => void;
	mockConnect.mockImplementation((done) => {
		callback = done;
	});
	const pending = withDatabaseRequest(controller.signal, async () => {
		await pool.connect();
		return new Response(null);
	});
	controller.abort();
	expect((await pending).status).toBe(400);
	callback(undefined, mockRaw, mockRelease);
	expect(mockRelease).toHaveBeenCalledTimes(1);
	await pool.end();
});
test("failed backend cancellation destroys the owned lease once and prevents later SQL", async () => {
	const pool = new RequestAwarePool({});
	const controller = new AbortController();
	mockCancelQuery.mockRejectedValue(new Error("fixture cancellation transport"));
	let ready!: () => void;
	let resume!: () => void;
	const acquired = new Promise<void>((done) => {
		ready = done;
	});
	const barrier = new Promise<void>((done) => {
		resume = done;
	});
	const pending = withDatabaseRequest(controller.signal, async () => {
		const client = await pool.connect();
		ready();
		await barrier;
		expect(() => client.query("SELECT 1")).toThrow("DATABASE_REQUEST_CANCELLED");
		client.release();
		return new Response(null, { status: 204 });
	});
	await acquired;
	controller.abort();
	expect((await pending).status).toBe(400);
	resume();
	await new Promise((done) => setImmediate(done));
	expect(mockRawQuery).not.toHaveBeenCalled();
	expect(mockRelease).toHaveBeenCalledTimes(1);
	expect(mockRelease).toHaveBeenCalledWith(true);
	expect(mockCancelQuery).toHaveBeenCalledWith(expect.stringContaining("pg_cancel_backend"), [expect.stringMatching(/^\/\* clipify-mcp [\da-f-]+ \*\/ %$/)]);
	await pool.end();
});

test("owned callback acquisition delivers a client and one native release", async () => {
	const pool = new RequestAwarePool({});
	await withDatabaseRequest(new AbortController().signal, async () => {
		await new Promise<void>((resolve, reject) =>
			pool.connect((error, client, release) => {
				if (error) {
					reject(error);
					return;
				}
				expect(client).toBeDefined();
				release();
				resolve();
			}),
		);
		return new Response(null, { status: 204 });
	});
	expect(mockRelease).toHaveBeenCalledTimes(1);
	await pool.end();
});
test("acquisition failure callback supplies a harmless release and pool background errors stay handled", async () => {
	const pool = new RequestAwarePool({});
	mockConnect.mockImplementation((callback) => callback(new Error("fixture connection failure"), undefined, mockRelease));
	await withDatabaseRequest(new AbortController().signal, async () => {
		await new Promise<void>((resolve) =>
			pool.connect((error, client, release) => {
				expect(error?.message).toBe("fixture connection failure");
				expect(client).toBeUndefined();
				expect(() => release()).not.toThrow();
				resolve();
			}),
		);
		return new Response(null, { status: 204 });
	});
	for (const callback of mockPoolErrorCallbacks) expect(() => callback()).not.toThrow();
	await pool.end();
});
test("already aborted request cannot acquire a native lease", async () => {
	const pool = new RequestAwarePool({});
	const controller = new AbortController();
	controller.abort();
	const response = await withDatabaseRequest(controller.signal, async () => {
		await pool.connect();
		return new Response(null);
	});
	expect(response.status).toBe(400);
	expect(mockConnect).not.toHaveBeenCalled();
	await pool.end();
});

test("release after abortion waits for cancellation acknowledgement before native reuse", async () => {
	const pool = new RequestAwarePool({});
	const controller = new AbortController();
	let acknowledge!: () => void;
	mockCancelQuery.mockImplementation(
		() =>
			new Promise<void>((done) => {
				acknowledge = done;
			}),
	);
	let client: any;
	let acquired!: () => void;
	const ready = new Promise<void>((done) => {
		acquired = done;
	});
	const pending = withDatabaseRequest(controller.signal, async () => {
		client = await pool.connect();
		acquired();
		return new Promise<Response>(() => {});
	});
	await ready;
	controller.abort();
	client.release();
	expect(mockRelease).not.toHaveBeenCalled();
	acknowledge();
	expect((await pending).status).toBe(400);
	expect(mockRelease).toHaveBeenCalledTimes(1);
	expect(mockRelease).toHaveBeenCalledWith(true);
	await pool.end();
});
test("abortion during the native handoff prevents delivery and acknowledges cancellation once", async () => {
	const pool = new RequestAwarePool({});
	const controller = new AbortController();
	mockConnect.mockImplementation((callback) => {
		callback(undefined, mockRaw, mockRelease);
		controller.abort();
	});
	const response = await withDatabaseRequest(controller.signal, async () => {
		await pool.connect();
		return new Response(null);
	});
	expect(response.status).toBe(400);
	expect(mockRelease).toHaveBeenCalledTimes(1);
	expect(mockCancelQuery).toHaveBeenCalledTimes(1);
	await pool.end();
});
