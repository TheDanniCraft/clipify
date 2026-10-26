/** @jest-environment node */
import { providerScopes, resolveStreamDetails, streamDetailsSchema } from "@/server/runner/provider-contract";
import { TWITCH_REQUIRED_SCOPES } from "@/auth/providers/twitch";

test("PC-1 requests key and metadata together without expanding Twitch sign-in", () => {
	expect(providerScopes("twitch")).toEqual(["channel:read:stream_key", "channel:manage:broadcast"]);
	expect(TWITCH_REQUIRED_SCOPES).not.toContain("channel:read:stream_key");
});
test("PC-3 disabled details do not modify provider state; blank title follows the event title", () => {
	expect(resolveStreamDetails(false, "Holiday", { title: "Custom" })).toBeNull();
	expect(resolveStreamDetails(true, "Holiday", { title: "  " })).toEqual({ title: "Holiday" });
	expect(resolveStreamDetails(true, "Holiday", { title: " Custom ", description: "", categoryId: "" })).toEqual({ title: "Custom" });
});
test("PC-3 rejects duplicate destination settings, non-channel categories and oversized titles", () => {
	const repeated = { destinationId: "11111111-1111-4111-8111-111111111111" };
	expect(streamDetailsSchema.safeParse([repeated, repeated]).success).toBe(false);
	expect(streamDetailsSchema.safeParse([{ destinationId: "bad", title: "x" }]).success).toBe(false);
	expect(streamDetailsSchema.safeParse([{ destinationId: "11111111-1111-4111-8111-111111111111", title: "x".repeat(101) }]).success).toBe(false);
	expect(streamDetailsSchema.safeParse([{ destinationId: "11111111-1111-4111-8111-111111111111", categoryId: "https://evil.example" }]).success).toBe(false);
});
test("PC-3 specified fields are retained while an absent title inherits the event name", () => {
	expect(resolveStreamDetails(true, "Vacation", { description: "Some clips", categoryId: "509658", thumbnailAssetId: "11111111-1111-4111-8111-111111111111" })).toEqual({ title: "Vacation", description: "Some clips", categoryId: "509658", thumbnailAssetId: "11111111-1111-4111-8111-111111111111" });
});
test("PC-4 retains the selected category label for reopening the editor without sending it as broadcast metadata", () => {
	const detail = { destinationId: "11111111-1111-4111-8111-111111111111", categoryId: "509658", categoryName: "Just Chatting" };
	expect(streamDetailsSchema.parse([detail])).toEqual([detail]);
	expect(resolveStreamDetails(true, "Vacation", detail)).toEqual({ title: "Vacation", categoryId: "509658" });
});
