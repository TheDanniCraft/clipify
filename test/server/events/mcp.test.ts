/** @jest-environment node */
import { eventToolSchemas, eventToolPermissions, eventToolAnnotations } from "@/server/mcp/events/schemas";
import { eventTools } from "@/server/mcp/events/tools";
import { toolInputSchemas } from "@/server/mcp/schemas";
import { toolPermissions } from "@/server/mcp/permissions";
import { MCP_SCOPES } from "@/server/mcp/scopes";
import { listAwardEvents, saveAwardPresentation } from "@/server/events/persistence";
import { readAwardTieResults, chooseAwardTieWinner } from "@/server/events/ties";
import { nominateAwardCandidates } from "@/server/events/review";
jest.mock("@/server/events/review", () => ({ nominateAwardCandidates: jest.fn() }));
jest.mock("@/server/events/persistence", () => ({ listAwardEvents: jest.fn(), saveAwardPresentation: jest.fn() }));
jest.mock("@/server/events/ties", () => ({ readAwardTieResults: jest.fn(), chooseAwardTieWinner: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
const principal = { kind: "session" as const, authUserId: "actor", sessionId: "test", authenticatedAt: new Date() };
it("registers every event tool with an explicit scope and truthful effect hints", () => {
	for (const name of Object.keys(eventToolSchemas) as (keyof typeof eventToolSchemas)[]) {
		expect(toolInputSchemas).toHaveProperty(name);
		expect(toolPermissions[name]).toBe(eventToolPermissions[name]);
		expect(MCP_SCOPES).toContain(eventToolPermissions[name]);
		expect(eventToolAnnotations(name).idempotentHint).toBe(!["create_event", "create_event_example", "add_event_candidate", "group_event_candidates", "rotate_event_presenter"].includes(name));
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

it.each([
	["NOT_FOUND", "RESOURCE_UNAVAILABLE"],
	["AUTHENTICATION_REQUIRED", "ACCESS_DENIED"],
	["CONFLICT", "CONFLICT"],
	[undefined, "SERVICE_UNAVAILABLE"],
])("maps service failure %s without leaking its private details", async (code, expected) => {
	const tool = eventTools(principal).find((tool) => tool.name === "list_events")!;
	jest.mocked(listAwardEvents).mockResolvedValue({ ok: false, code, detail: "private database credentials" } as never);
	await expect(tool.run({ creatorId: "host" })).rejects.toThrow(new RegExp(`^${expected}$`));
});
it("lists only the requested creator through the trusted principal and rejects forged identity", async () => {
	const tool = eventTools(principal).find((tool) => tool.name === "list_events")!;
	const result = { ok: true as const, events: [] };
	jest.mocked(listAwardEvents).mockResolvedValue(result);
	await expect(tool.run({ creatorId: "host" })).resolves.toEqual(result);
	expect(listAwardEvents).toHaveBeenCalledWith(principal, "host");
	jest.mocked(listAwardEvents).mockClear();
	await expect(tool.run({ creatorId: "host", authUserId: "forged" })).rejects.toThrow();
	expect(listAwardEvents).not.toHaveBeenCalled();
});
it("saves presentation settings separately from published voting rules with the expected revision", async () => {
	const tool = eventTools(principal).find((tool) => tool.name === "update_event_presentation")!;
	const input = { creatorId: "host", eventId: crypto.randomUUID(), expectedRevision: 7, slides: [], presentation: { showChat: true, hiddenAccounts: ["@Bot", "bot"], commandPrefixes: ["!", "?"] } };
	jest.mocked(saveAwardPresentation).mockResolvedValue({ ok: false, code: "CONFLICT" });
	await expect(tool.run(input)).rejects.toThrow("CONFLICT");
	expect(saveAwardPresentation).toHaveBeenCalledWith(principal, "host", input.eventId, 7, { slides: [], presentation: { showChat: true, hiddenAccounts: ["bot"], commandPrefixes: ["!", "?"] } });
});
it("reads leading ties and forwards only the explicit category winner to the team decision service", async () => {
	const target = { creatorId: "host", eventId: crypto.randomUUID() };
	jest.mocked(readAwardTieResults).mockResolvedValue({ ok: false, code: "INVALID_INPUT" });
	await expect(
		eventTools(principal)
			.find((tool) => tool.name === "get_event_ties")!
			.run(target),
	).rejects.toThrow("INVALID_INPUT");
	expect(readAwardTieResults).toHaveBeenCalledWith(principal, "host", target.eventId);
	const choice = { ...target, categoryId: crypto.randomUUID(), candidateId: crypto.randomUUID() };
	jest.mocked(chooseAwardTieWinner).mockResolvedValue({ ok: false, code: "INVALID_INPUT" });
	await expect(
		eventTools(principal)
			.find((tool) => tool.name === "choose_event_tie_winner")!
			.run(choice),
	).rejects.toThrow("INVALID_INPUT");
	expect(chooseAwardTieWinner).toHaveBeenCalledWith(principal, "host", target.eventId, choice.categoryId, choice.candidateId);
});

jest.mock("@/server/events/preview", () => ({ createAwardPreview: jest.fn() }));
it("returns the same read-only preview capability through MCP and rejects forged ownership", async () => {
	const { createAwardPreview } = await import("@/server/events/preview");
	const tool = eventTools(principal).find((tool) => tool.name === "get_event_preview")!;
	const input = { creatorId: "host", eventId: crypto.randomUUID() };
	jest.mocked(createAwardPreview).mockResolvedValue({ ok: true, token: "preview-token" });
	await expect(tool.run(input)).resolves.toEqual({ ok: true, previewPath: `/events/${input.eventId}/preview#preview-token` });
	expect(createAwardPreview).toHaveBeenCalledWith(principal, input.creatorId, input.eventId);
	expect(eventToolPermissions.get_event_preview).toBe("event:update");
	await expect(tool.run({ ...input, authUserId: "forged" })).rejects.toThrow();
});
