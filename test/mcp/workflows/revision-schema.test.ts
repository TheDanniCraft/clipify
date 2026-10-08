/** @jest-environment node */
import { galleriesTable, settingsTable, runnersTable, streamSessionsTable } from "@/db/schema";
import { workflowInputSchemas } from "@/server/mcp/workflows/schemas";
describe("TDD-FOUNDATION-REV shared workflow concurrency", () => {
	test.each([
		["gallery", galleriesTable],
		["Creator Page", settingsTable],
		["runner", runnersTable],
		["stream session", streamSessionsTable],
	])("%s exposes a positive configuration revision", (_, table) => {
		expect((table as any).configurationRevision).toBeDefined();
		expect((table as any).configurationRevision.notNull).toBe(true);
		expect((table as any).configurationRevision.default).toBe(1);
	});
	test.each(["24/7", "failsafe"])("stream session supports the existing %s mode", (mode) => {
		expect(workflowInputSchemas.configure_stream_session.safeParse({ creatorId: "creator", sessionId: "00000000-0000-4000-8000-000000000001", runnerId: "00000000-0000-4000-8000-000000000002", overlayId: "00000000-0000-4000-8000-000000000003", expectedRevision: 1, mode }).success).toBe(true);
	});
});
