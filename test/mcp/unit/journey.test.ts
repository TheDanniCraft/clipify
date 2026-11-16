/** @jest-environment node */
jest.mock("@/server/umami", () => ({ trackServerProductEvent: jest.fn() }));
import { trackServerProductEvent } from "@/server/umami";
import { safeResultState, trackMcpAuthenticatedRequest, trackMcpToolResult } from "@/server/mcp/journey";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
const principal = { kind: "oauth", authUserId: "account", clientId: "https://chatgpt.com/oauth/client.json" } as TrustedCreatorPrincipal;
beforeEach(() => jest.clearAllMocks());
test("protocol stages mean authenticated requests, not task completion", () => {
	trackMcpAuthenticatedRequest(principal, "initialize");
	expect(trackServerProductEvent).toHaveBeenLastCalledWith("account", "mcp_authenticated_request", { channel: "ai", client: "chatgpt", stage: "initialize" });
	trackMcpAuthenticatedRequest(principal, "tools/list");
	expect(trackServerProductEvent).toHaveBeenLastCalledWith("account", "mcp_authenticated_request", expect.objectContaining({ stage: "tools_list" }));
	trackMcpAuthenticatedRequest(principal, "untrusted request text");
	expect(trackServerProductEvent).toHaveBeenCalledTimes(2);
});
test("tool measurements include only bounded result labels", () => {
	trackMcpToolResult(principal, { tool: "search_clips", outcome: "success", resultState: "queued" });
	expect(trackServerProductEvent).toHaveBeenCalledWith("account", "mcp_tool_result", expect.objectContaining({ tool: "search_clips", result_state: "queued", client: "chatgpt" }));
	trackMcpToolResult({ ...principal, clientId: "private-client-name" }, { tool: "search_clips", outcome: "denied", reason: "private message", resultState: "private identifier" });
	expect(trackServerProductEvent).toHaveBeenLastCalledWith("account", "mcp_tool_result", expect.objectContaining({ client: "other", reason: undefined, result_state: undefined }));
	expect(safeResultState("constructor")).toBeUndefined();
	trackMcpToolResult(principal, { tool: "private prompt", outcome: "denied" });
	expect(trackServerProductEvent).toHaveBeenCalledTimes(2);
});

test("optional analytics outages never fail a tool or connection", () => {
	jest.mocked(trackServerProductEvent).mockImplementationOnce(() => {
		throw new Error("measurement offline");
	});
	expect(() => trackMcpAuthenticatedRequest(principal, "initialize")).not.toThrow();
});
