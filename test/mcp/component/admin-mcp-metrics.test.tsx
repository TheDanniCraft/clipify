jest.mock("@heroui/react", () => require("../../support/mcp/heroui-fixture").components);
import { render, screen, fireEvent } from "@testing-library/react";
import AdminMcpMetrics from "@/app/components/adminMcpMetrics";
import type { McpMetricsSnapshot } from "@/server/mcp/metrics";
const metric = {
	calls: { started_total: 3, completed_total: 3, success_total: 2, denied_total: 1, error_total: 0, cancelled_total: 0, inFlight: 0 },
	processStartedAt: "2026-10-08T00:00:00Z",
	processInstanceId: "fixture",
	sampledAt: "2026-10-08T00:01:00Z",
	duration: { count: 3, seconds_sum: 0.6, buckets: {} },
	reasons: { MISSING_SCOPE_total: 1 },
	tools: { get_overlay: { started_total: 2, completed_total: 2, success_total: 2, denied_total: 0, error_total: 0, cancelled_total: 0, lastUsedAt: null, duration: { count: 2, seconds_sum: 0.4, buckets: {} } }, create_playlist: { started_total: 1, completed_total: 1, success_total: 0, denied_total: 1, error_total: 0, cancelled_total: 0, lastUsedAt: null, duration: { count: 1, seconds_sum: 0.2, buckets: {} } } },
} as unknown as McpMetricsSnapshot;
test("admin shows process scope, real outcomes and sortable tool usage", () => {
	render(<AdminMcpMetrics metrics={metric} />);
	expect(screen.getByRole("heading", { name: "MCP activity" })).toBeVisible();
	expect(screen.getByText(/This process, since/)).toBeVisible();
	expect(screen.getByRole("grid", { name: "MCP tool usage" })).toBeVisible();
	expect(screen.getByText(/MISSING_SCOPE/)).toBeVisible();
	fireEvent.click(screen.getByRole("columnheader", { name: /Tool/ }));
	const rows = screen.getAllByRole("row");
	expect(rows[1]).toHaveTextContent("create_playlist");
});
test("no traffic renders no latency rather than NaN", () => {
	render(<AdminMcpMetrics metrics={{ ...metric, duration: { count: 0, seconds_sum: 0, buckets: {} }, tools: {}, reasons: {} }} />);
	expect(screen.getByText(/No completed calls/)).toBeVisible();
	expect(screen.getByText("No tool calls recorded.")).toBeVisible();
	expect(document.body).not.toHaveTextContent("NaN");
});
