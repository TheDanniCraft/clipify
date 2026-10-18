/** @jest-environment node */
import { parseRunnerStandbyAppearance } from "@/app/lib/runnerStandby";
const sessionId = "11111111-1111-4111-8111-111111111111";
const assetId = "22222222-2222-4222-8222-222222222222";
const appearance = { backgroundColor: "#16324f", backgroundImageUrl: `/runner/presentation/${sessionId}/assets/${assetId}`, logoUrl: null, message: "Back soon <3" };

test("TDD-US4-CON013 U149 strength: bounded appearance keeps scoped assets and the saved next-start timezone", () => {
	const nextBroadcast = { startUtc: "2028-01-15T13:00:00.000Z", timezone: "Europe/Berlin" };
	const input = { ...appearance, nextBroadcast, unrelatedPrivateField: "discard" };
	expect(parseRunnerStandbyAppearance(input)).toEqual({ ...appearance, nextBroadcast });
	expect(input).toEqual({ ...appearance, nextBroadcast, unrelatedPrivateField: "discard" });
});

test("TDD-US4-CON013 U149 strength: clearing optional imagery and next start preserves explicit nulls", () => {
	const input = { ...appearance, backgroundImageUrl: null, logoUrl: appearance.backgroundImageUrl, message: "x".repeat(160), nextBroadcast: null };
	expect(parseRunnerStandbyAppearance(input)).toEqual(input);
	expect(parseRunnerStandbyAppearance(appearance)).not.toHaveProperty("nextBroadcast");
});

test.each([
	{ label: "absent appearance", input: null },
	{ label: "non-object appearance", input: 42 },
	{ label: "non-text color", input: { ...appearance, backgroundColor: 42 } },
	{ label: "invalid color", input: { ...appearance, backgroundColor: "red" } },
	{ label: "non-text message", input: { ...appearance, message: {} } },
	{ label: "oversized message", input: { ...appearance, message: "x".repeat(161) } },
	{ label: "external background URL", input: { ...appearance, backgroundImageUrl: "https://example.invalid/private.png" } },
	{ label: "non-text logo URL", input: { ...appearance, logoUrl: [] } },
])("TDD-US4-CON013 U149 strength: $label is rejected without an exception", ({ input }) => {
	expect(parseRunnerStandbyAppearance(input)).toBeNull();
});

test.each([false, "tomorrow", {}, { startUtc: 42 }, { startUtc: "not-a-date" }, { startUtc: "2028-01-15T13:00:00.000Z" }, { startUtc: "2028-01-15T13:00:00.000Z", timezone: 42 }, { startUtc: "2028-01-15T13:00:00.000Z", timezone: "x".repeat(129) }, { startUtc: "2028-01-15T13:00:00.000Z", timezone: "Invalid/Fixture" }])("TDD-US4-CON013 U149 strength: invalid next-start data %j cannot replace a valid appearance", (nextBroadcast) => {
	expect(parseRunnerStandbyAppearance({ ...appearance, nextBroadcast })).toBeNull();
});
