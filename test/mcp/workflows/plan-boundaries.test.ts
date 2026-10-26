/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("Free remote control cannot dispatch a live player command", () => {
	const row = flowProbe("catalogue:workflow:control_overlay:free");
	expect(row.result?.structuredContent.error.code).toBe("FEATURE_RESTRICTED");
	expect(row.commands.filter((item: any) => item.type === "command")).toEqual([]);
	expect(row.writes).toBe(0);
});

test("Pro without a standalone Runner grant can register a device", () => {
	const row = flowProbe("catalogue:workflow:create_runner:no_runner_access");
	expect(row.result?.isError).not.toBe(true);
	expect(row.result?.structuredContent).toMatchObject({ creatorId: "fixture-creator", name: "New runner", status: "offline", enrollmentRequired: true });
	expect(row.writes).toBe(1);
	expect(row.safe).toBe(true);
});

test("creation retry returns the same gallery and records both successful calls", () => {
	const row = flowProbe("catalogue:workflow:create_gallery:replay");
	expect(row.result?.isError).not.toBe(true);
	expect(row.replay?.isError).not.toBe(true);
	expect(row.replay?.structuredContent).toEqual(row.result?.structuredContent);
	expect(row.writes).toBe(2);
});
