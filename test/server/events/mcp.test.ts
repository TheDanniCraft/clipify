/** @jest-environment node */
import { eventToolSchemas, eventToolPermissions, eventToolAnnotations } from "@/server/mcp/events/schemas";
import { eventTools } from "@/server/mcp/events/tools";
import { toolInputSchemas } from "@/server/mcp/schemas";
import { toolPermissions } from "@/server/mcp/permissions";
import { MCP_SCOPES } from "@/server/mcp/scopes";
import { nominateAwardCandidates } from "@/server/events/review";
jest.mock("@/server/events/review", () => ({ nominateAwardCandidates: jest.fn() }));
const principal = { kind: "session" as const, authUserId: "actor", sessionId: "test", authenticatedAt: new Date() };
it("registers every event tool with an explicit scope and truthful effect hints", () => {
	for (const name of Object.keys(eventToolSchemas) as (keyof typeof eventToolSchemas)[]) {
		expect(toolInputSchemas).toHaveProperty(name);
		expect(toolPermissions[name]).toBe(eventToolPermissions[name]);
		expect(MCP_SCOPES).toContain(eventToolPermissions[name]);
		expect(eventToolAnnotations(name).idempotentHint).toBe(!["create_event", "add_event_candidate", "group_event_candidates", "rotate_event_presenter"].includes(name));
	}
	expect(eventToolAnnotations("rotate_event_presenter").destructiveHint).toBe(true);
});
it("routes nominations through the same service with the trusted principal and maps denials safely", async () => {
	const tool = eventTools(principal).find((tool) => tool.name === "nominate_event_candidates")!;
	const input = { creatorId: "host", eventId: crypto.randomUUID(), categoryId: crypto.randomUUID(), candidateIds: [crypto.randomUUID()] };
	jest.mocked(nominateAwardCandidates).mockResolvedValue({ ok: false, code: "ACCESS_DENIED" });
	await expect(tool.run(input)).rejects.toThrow("ACCESS_DENIED");
	expect(nominateAwardCandidates).toHaveBeenCalledWith(principal, input.creatorId, input.eventId, input.categoryId, input.candidateIds);
	expect(eventToolSchemas.nominate_event_candidates.safeParse({ ...input, authUserId: "forged" }).success).toBe(false);
});
