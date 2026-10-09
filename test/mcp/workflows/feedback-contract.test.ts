/** @jest-environment node */
import { toolInputSchemas } from "@/server/mcp/schemas";
import { toolPermissions } from "@/server/mcp/permissions";
import { mcpOperationLabels } from "@lib/mcpOperationLabels";
import { toolAnnotations } from "@/server/mcp/risk";

test("feedback is an explicit external write using the existing creator read permission", () => {
	expect((toolPermissions as Record<string, string>).submit_feedback).toBe("creator:read");
	expect(toolAnnotations("submit_feedback" as any)).toEqual({ readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true });
});
test("feedback requires user intent and bounded content, without accepting credentials or transcripts", () => {
	const schema = (toolInputSchemas as Record<string, any>).submit_feedback;
	expect(schema).toBeDefined();
	const input = { creatorId: "creator", kind: "bug", message: " Queue did not advance. ", confirmed: true, retryKey: "feedback-1" };
	expect(schema.parse(input).message).toBe("Queue did not advance.");
	for (const patch of [{ confirmed: false }, { confirmed: undefined }, { message: " " }, { message: "x".repeat(2001) }, { kind: "error" }, { retryKey: "" }, { screenshot: "data:image/png" }, { transcript: [] }, { clientId: "other-client" }, { email: "test@example.invalid" }]) expect(schema.safeParse({ ...input, ...patch }).success).toBe(false);
});

test("public activity labels cover the exact registered tool catalogue", () => {
	expect(Object.keys(mcpOperationLabels).sort()).toEqual(Object.keys(toolInputSchemas).sort());
	expect(mcpOperationLabels.submit_feedback).toBe("Submit feedback");
});
