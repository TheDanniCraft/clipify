jest.mock("@heroui/react", () => require("../../support/mcp/heroui-fixture").components);
import { render, screen } from "@testing-library/react";
import AdminMcpClients from "@/app/components/adminMcpClients";
import type { McpClientStats } from "@/server/mcp/client-stats";
const stats: McpClientStats = { summary: { registeredClients: 23, authorizedClients: 2, activeClients30d: 1, calls30d: 5, applicationNames: 42 }, page: 2, pageSize: 20, sampledAt: "2026-10-08T00:00:00Z", items: [{ name: "Meta MCP", registeredClients: 2, authorizedClients: 1, activeConnections: 1, activeClients30d: 1, calls30d: 5, lastUsedAt: null }] };
test("admin includes Custom app names, unverified provenance and complete pagination", () => {
	render(<AdminMcpClients stats={stats} />);
	expect(screen.getByRole("grid", { name: "MCP client adoption" })).toBeVisible();
	expect(screen.getByText("Meta MCP")).toBeVisible();
	expect(screen.getByText(/self-reported, not verified/)).toBeVisible();
	expect(screen.getByRole("link", { name: "Previous" })).toHaveAttribute("href", "/admin?mcpClientsPage=1");
	expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/admin?mcpClientsPage=3");
});
test("unavailable adoption data is explicit instead of fabricated zero statistics", () => {
	render(<AdminMcpClients stats={null} />);
	expect(screen.getByText("Client statistics are currently unavailable.")).toBeVisible();
	expect(screen.queryByRole("grid")).not.toBeInTheDocument();
});
test("client-provided names remain plain text and final page has no Next", () => {
	render(<AdminMcpClients stats={{ ...stats, page: 3, items: [{ ...stats.items[0], name: "<script>untrusted</script>" }] }} />);
	expect(screen.getByText("<script>untrusted</script>")).toBeVisible();
	expect(document.querySelector("script")).toBeNull();
	expect(screen.queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
});
