/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
describe("TDD-ACTIVITY-001 authenticated call activity", () => {
	test.each(["resources:playlist-get", "resources:overlays"])("successful read %s records only approved activity fields", (mode) => {
		const result = flowProbe(mode);
		expect(result.protocolStatus).toBe(200);
		expect(result.activityRecords).toHaveLength(1);
		const event = result.activityRecords[0];
		expect(event.outcome).toBe("success");
		expect(event.actor_user_id).toEqual(expect.any(String));
		expect(event.actor_session_id).toBeNull();
		expect(event.metadata).toMatchObject({ creatorId: "fixture-creator", tool: mode === "resources:playlist-get" ? "get_playlist" : "list_overlays", generation: 1 });
		expect(Object.keys(event.metadata).sort()).toEqual(["clientId", "creatorId", "generation", "grantId", "tool"]);
	});
	test.each([
		["resources:overlay-get:denied", "ACCESS_DENIED"],
		["resources:overlays:unknown", "INVALID_INPUT"],
		["resources:overlay-delete:no-scope", "MISSING_SCOPE"],
	])("%s records safe denial without target metadata", (mode, reason) => {
		const result = flowProbe(mode);
		expect(result.activityRecords).toHaveLength(1);
		const event = result.activityRecords[0];
		expect(event.outcome).toBe("denied");
		expect(event.reason).toBe(reason);
		expect(event.target_id).toBeNull();
		expect(event.actor_session_id).toBeNull();
		expect(Object.keys(event.metadata).sort()).toEqual(["clientId", "generation", "grantId", "tool"]);
		expect(JSON.stringify(event)).not.toMatch(/private-input-value|private-foreign-secret|fixture-cookie|Bearer/);
	});
});
