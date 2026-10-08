/** @jest-environment node */
import { withDatabaseRequest, withoutDatabaseRequest } from "@/db/request-scope";
test("bodyless response preserves its status and headers", async () => {
	const response = new Response(null, { status: 204, headers: { "x-fixture": "retained" } });
	expect(await withDatabaseRequest(new AbortController().signal, async () => response)).toBe(response);
});
test("streamed response preserves chunks and metadata until completion", async () => {
	const response = await withDatabaseRequest(new AbortController().signal, async () => new Response("fixture-content", { status: 201, headers: { "x-fixture": "retained" } }));
	expect(response.status).toBe(201);
	expect(response.headers.get("x-fixture")).toBe("retained");
	expect(await response.text()).toBe("fixture-content");
});
test("stream cancellation reaches the owned reader even when cancellation rejects", async () => {
	const cancel = jest.fn(() => Promise.reject(new Error("private cancellation error")));
	const response = await withDatabaseRequest(new AbortController().signal, async () => new Response(new ReadableStream({ cancel })));
	await expect(response.body!.cancel("fixture-reason")).resolves.toBeUndefined();
	expect(cancel).toHaveBeenCalledWith("fixture-reason");
});
test("stream read failure is a bounded safe error", async () => {
	const response = await withDatabaseRequest(
		new AbortController().signal,
		async () =>
			new Response(
				new ReadableStream({
					start(controller) {
						controller.error(new Error("private body error"));
					},
				}),
			),
	);
	await expect(response.text()).rejects.toThrow("MCP response unavailable");
});
test("operation failure is propagated with no stream", async () => {
	const failure = new Error("fixture operation failure");
	await expect(
		withDatabaseRequest(new AbortController().signal, async () => {
			throw failure;
		}),
	).rejects.toBe(failure);
});
test("already aborted request returns bounded invalid request and cancels its late body", async () => {
	const controller = new AbortController();
	controller.abort();
	const cancel = jest.fn();
	const response = await withDatabaseRequest(controller.signal, async () => new Response(new ReadableStream({ cancel })));
	expect(response.status).toBe(400);
	expect(await response.json()).toEqual({ error: "invalid_request" });
	expect(cancel).toHaveBeenCalledTimes(1);
});
test("caller abort interrupts a pending operation and closes a late failing body", async () => {
	const controller = new AbortController();
	let resolve!: (response: Response) => void;
	const pending = withDatabaseRequest(
		controller.signal,
		() =>
			new Promise<Response>((done) => {
				resolve = done;
			}),
	);
	controller.abort();
	expect((await pending).status).toBe(400);
	const cancel = jest.fn(() => Promise.reject(new Error("fixture cancellation")));
	resolve(new Response(new ReadableStream({ cancel })));
	await new Promise((done) => setImmediate(done));
	expect(cancel).toHaveBeenCalledTimes(1);
});
test("independent provider persistence result survives an enclosing response lifecycle", async () => {
	const response = await withDatabaseRequest(new AbortController().signal, async () => {
		const persisted = await withoutDatabaseRequest(async () => "persisted");
		return Response.json({ persisted });
	});
	expect(await response.json()).toEqual({ persisted: "persisted" });
});
