/** @jest-environment node */
import { trackMcpDispatch, trackMcpRequest, reportMcpToolOutcome } from "@/server/mcp/metrics-dispatch";
import { getMcpMetricsSnapshot } from "@/server/mcp/metrics";
beforeEach(() => {
	globalThis.__clipifyMcpMetrics = undefined;
});
const request = () => new Request("https://clipify.example/mcp", { method: "POST" });
test("HTTP 200 domain errors count as tool failure rather than HTTP failure", async () => {
	await (
		await trackMcpRequest(request(), () =>
			trackMcpDispatch(request(), { method: "tools/call", params: { name: "get_overlay" } }, async () => {
				reportMcpToolOutcome("denied", "RESOURCE_UNAVAILABLE");
				reportMcpToolOutcome("denied", "RESOURCE_UNAVAILABLE");
				return Response.json({ isError: true });
			}),
		)
	).text();
	const s = getMcpMetricsSnapshot();
	expect(s.calls).toMatchObject({ started_total: 1, completed_total: 1, denied_total: 1, inFlight: 0 });
	expect(s.requests.status_2xx_total).toBe(1);
});
test("boundary rate limits and concurrent calls cannot double count or mix outcomes", async () => {
	await Promise.all([
		trackMcpDispatch(request(), { method: "tools/call", params: { name: "create_overlay" } }, async () => {
			await Promise.resolve();
			return new Response(null, { status: 429 });
		}),
		trackMcpDispatch(request(), { method: "tools/call", params: { name: "get_overlay" } }, async () => {
			reportMcpToolOutcome("success");
			return new Response(null, { status: 200 });
		}),
	]);
	const s = getMcpMetricsSnapshot();
	expect(s.calls.completed_total).toBe(2);
	expect(s.calls.success_total).toBe(1);
	expect(s.calls.denied_total).toBe(1);
	expect(s.reasons.RATE_LIMITED_total).toBe(1);
});
test("exceptions and cancelled requests complete observation and propagate behavior", async () => {
	await expect(
		trackMcpRequest(request(), () =>
			trackMcpDispatch(request(), { method: "tools/call", params: { name: "get_overlay" } }, async () => {
				throw Error("private diagnostic");
			}),
		),
	).rejects.toThrow("private diagnostic");
	const controller = new AbortController();
	const req = new Request(request(), { signal: controller.signal });
	await trackMcpDispatch(req, { method: "tools/call", params: { name: "get_overlay" } }, async () => {
		controller.abort();
		return new Response(null, { status: 200 });
	});
	const s = getMcpMetricsSnapshot();
	expect(s.calls).toMatchObject({ error_total: 1, cancelled_total: 1, inFlight: 0 });
	expect(s.requests.status_5xx_total).toBe(1);
	expect(JSON.stringify(s)).not.toContain("private diagnostic");
});
test("discovery is an operation, not a tool call; unknown tool is bounded", async () => {
	await trackMcpDispatch(request(), { method: "tools/list" }, async () => new Response(null));
	await trackMcpDispatch(request(), { method: "tools/call", params: { name: "arbitrary-secret-name" } }, async () => {
		reportMcpToolOutcome("denied", "INVALID_INPUT");
		return new Response(null, { status: 400 });
	});
	const s = getMcpMetricsSnapshot();
	expect(s.operations.tools_list_total).toBe(1);
	expect(s.calls.started_total).toBe(1);
	expect(s.tools.unknown.denied_total).toBe(1);
	expect(JSON.stringify(s)).not.toContain("arbitrary-secret-name");
});
test("streaming completion waits for the tool result rather than optimistic HTTP 200", async () => {
	const response = await trackMcpDispatch(
		request(),
		{ method: "tools/call", params: { name: "create_overlay" } },
		async () =>
			new Response(
				new ReadableStream({
					pull(controller) {
						controller.enqueue(new TextEncoder().encode('data: {"jsonrpc":"2.0","id":1,"result":{"isError":true,"structuredContent":{"error":{"code":"PLAN_LIMIT_REACHED"}}}}\n\n'));
						controller.close();
					},
				}),
				{ headers: { "Content-Type": "text/event-stream" } },
			),
	);
	expect(getMcpMetricsSnapshot().calls).toMatchObject({ completed_total: 0, inFlight: 1 });
	await response.text();
	expect(getMcpMetricsSnapshot().calls).toMatchObject({ success_total: 0, denied_total: 1, inFlight: 0 });
	expect(getMcpMetricsSnapshot().reasons.PLAN_LIMIT_REACHED_total).toBe(1);
});
test.each([
	[401, "AUTHENTICATION_REQUIRED"],
	[403, "ACCESS_DENIED"],
	[400, "INVALID_INPUT"],
	[500, "SERVICE_UNAVAILABLE"],
])("HTTP %s records its real boundary outcome", async (status, reason) => {
	await trackMcpDispatch(request(), { method: "tools/call", params: { name: "get_overlay" } }, async () => new Response(null, { status }));
	expect(getMcpMetricsSnapshot().reasons[reason + "_total"]).toBe(1);
});
test("insufficient scope challenge is distinct from general denial", async () => {
	await trackMcpDispatch(request(), { method: "tools/call", params: { name: "get_overlay" } }, async () => new Response(null, { status: 403, headers: { "www-authenticate": 'Bearer error="insufficient_scope"' } }));
	expect(getMcpMetricsSnapshot().reasons.MISSING_SCOPE_total).toBe(1);
	reportMcpToolOutcome("error", "SERVICE_UNAVAILABLE");
	expect(getMcpMetricsSnapshot().calls.error_total).toBe(0);
});
test("cancelled thrown execution releases its in-flight slot", async () => {
	const controller = new AbortController();
	controller.abort();
	const req = new Request(request(), { signal: controller.signal });
	await expect(
		trackMcpDispatch(req, { method: "tools/call", params: { name: "get_overlay" } }, async () => {
			throw Error("aborted");
		}),
	).rejects.toThrow("aborted");
	expect(getMcpMetricsSnapshot().calls).toMatchObject({ cancelled_total: 1, inFlight: 0 });
});
test("malformed non-tool messages never become executed calls", async () => {
	for (const body of [null, "invalid", {}, { method: "notifications/initialized" }]) await trackMcpDispatch(request(), body, async () => new Response(null));
	expect(getMcpMetricsSnapshot().calls.started_total).toBe(0);
	expect(getMcpMetricsSnapshot().operations.other_total).toBe(1);
});
test.each([
	['{"error":{"code":-32603}}', "error", "SERVICE_UNAVAILABLE"],
	['event: message\ndata: {"error":{"code":-32602}}\n\n', "denied", "INVALID_INPUT"],
	['{"result":{"isError":true}}', "denied", "other"],
	['{"result":{"isError":true,"structuredContent":{"error":{"code":123}}}}', "denied", "other"],
	['event: message\ndata: invalid\ndata: {"result":{"ok":true}}\n\n', "success", undefined],
])("wire result is observed without changing its bytes", async (wire, outcome, reason) => {
	const response = await trackMcpDispatch(request(), { method: "tools/call", params: { name: "get_overlay" } }, async () => new Response(wire));
	expect(await response.text()).toBe(wire);
	expect(getMcpMetricsSnapshot().calls[(outcome + "_total") as "success_total"]).toBe(1);
	if (reason) expect(getMcpMetricsSnapshot().reasons[reason + "_total"]).toBe(1);
});
test("stream failure is propagated and counted; no private diagnostics enter snapshots", async () => {
	const response = await trackMcpDispatch(
		request(),
		{ method: "tools/call", params: { name: "get_overlay" } },
		async () =>
			new Response(
				new ReadableStream({
					start(controller) {
						controller.error(Error("private stream failure"));
					},
				}),
			),
	);
	await expect(response.text()).rejects.toThrow("private stream failure");
	expect(getMcpMetricsSnapshot().calls).toMatchObject({ error_total: 1, inFlight: 0 });
	expect(JSON.stringify(getMcpMetricsSnapshot())).not.toContain("private stream failure");
});
test("cancelled consumer completes once and forwards cancellation to the original stream", async () => {
	const cancel = jest.fn();
	const response = await trackMcpDispatch(request(), { method: "tools/call", params: { name: "get_overlay" } }, async () => new Response(new ReadableStream({ cancel })));
	await response.body!.cancel("consumer stopped");
	expect(cancel).toHaveBeenCalledWith("consumer stopped");
	expect(getMcpMetricsSnapshot().calls).toMatchObject({ cancelled_total: 1, inFlight: 0, completed_total: 1 });
});
