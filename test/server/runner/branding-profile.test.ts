/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("TDD-US4-FR017 U278: a first owned preference persists its corner and one profile revision", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_save_first");
	expect(result.available).toBe(true);
	expect(result.result).toMatchObject({ success: true, profile: { watermarkCorner: "top_left", revision: 1 } });
	expect(result.rows).toEqual([{ id: result.result.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});

test("TDD-US4-FR017 U285: a valid edit keeps profile identity and advances its persisted revision once", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_save_update");
	expect(result.updateThrew).toBe(false);
	expect(result.result).toMatchObject({ success: true, profile: { id: result.original.profile.id, watermarkCorner: "bottom_right", revision: 2 } });
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "bottom_right", revision: 2 }]);
});

test("TDD-US4-FR017 U279: a stale appearance edit returns a conflict and preserves the saved revision", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_stale_revision");
	expect(result.updateThrew).toBe(false);
	expect(result.result).toMatchObject({ success: false, code: "CONFLICT" });
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});

test("TDD-US4-FR017 U279: simultaneous edits at one revision commit once and return one normal conflict", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_revision_race");
	expect(result.observedLocks).toBeGreaterThanOrEqual(2);
	expect(result.settledBeforeRelease).toBe(0);
	expect(result.concurrent.every((outcome: { threw: boolean }) => !outcome.threw)).toBe(true);
	const accepted = result.concurrent.filter((outcome: { value: { success: boolean } }) => outcome.value?.success === true);
	expect(accepted).toHaveLength(1);
	expect(result.concurrent.filter((outcome: { value: { code?: string } }) => outcome.value?.code === "CONFLICT")).toHaveLength(1);
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: accepted[0].value.profile.watermarkCorner, revision: 2 }]);
});

test("TDD-US4-FR017 U280: revoked owner membership denies a normal save without changing the profile", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_foreign_save");
	expect(result.updateThrew).toBe(false);
	expect(result.result).toMatchObject({ success: false, code: "ACCESS_DENIED" });
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});

test("TDD-US4-FR017 U280: an authorized creator receives a normal refusal for another owner's Runner", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_foreign_runner");
	expect(result.updateThrew).toBe(false);
	expect(result.result).toMatchObject({ success: false, code: "RESOURCE_UNAVAILABLE" });
	expect(result.foreignProfileCount).toBe(0);
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});

test("TDD-US4-FR017 U287: simultaneous first preferences create one profile and return one normal conflict", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_create_race");
	expect(result.observedLocks).toBeGreaterThanOrEqual(2);
	expect(result.settledBeforeRelease).toBe(0);
	expect(result.concurrent.every((outcome: { threw: boolean }) => !outcome.threw)).toBe(true);
	const accepted = result.concurrent.filter((outcome: { value: { success: boolean } }) => outcome.value?.success === true);
	expect(accepted).toHaveLength(1);
	expect(result.concurrent.filter((outcome: { value: { code?: string } }) => outcome.value?.code === "CONFLICT")).toHaveLength(1);
	expect(result.rows).toEqual([{ id: accepted[0].value.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: accepted[0].value.profile.watermarkCorner, revision: 1 }]);
});

test("TDD-US4-FR017 U281: an unknown corner returns a normal input error without changing the profile", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_invalid_corner");
	expect(result.updateThrew).toBe(false);
	expect(result.result).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});

test("TDD-US4-FR017 U282: a failed transaction retains the old preference after a real staged update", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_storage_failure");
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
	expect(result.uncommittedPreference).toEqual({ watermarkCorner: "bottom_right", revision: 2 });
	expect(result.updateThrew || (result.result?.success === false && result.result?.code === "SERVICE_UNAVAILABLE")).toBe(true);
});

test("TDD-US4-FR017 U284: an owned Runner reads default bottom-right settings without inserting a profile", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_read_default");
	expect(result.available).toBe(true);
	expect(result.result).toMatchObject({ success: true, profile: { id: null, watermarkCorner: "bottom_right", revision: 0 } });
	expect(result.rows).toEqual([]);
	expect(JSON.stringify(result.result)).not.toContain(result.privateRunnerToken);
	expect(result.result.profile).not.toHaveProperty("token");
});

test("TDD-US4-FR017 U286: an owned saved read returns its persisted corner and revision without credentials", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_read_saved");
	expect(result.available).toBe(true);
	expect(result.result).toMatchObject({ success: true, profile: { id: result.original.profile.id, watermarkCorner: "top_left", revision: 1 } });
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
	expect(JSON.stringify(result.result)).not.toContain(result.privateRunnerToken);
	expect(result.result.profile).not.toHaveProperty("token");
});

test("TDD-US4-FR017 U283: revoked owner membership refuses a saved appearance read without exposing the profile", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_read_foreign");
	expect(result.result).toMatchObject({ success: false, code: "ACCESS_DENIED" });
	expect(result.result).not.toHaveProperty("profile");
	expect(JSON.stringify(result.result)).not.toContain(result.privateRunnerToken);
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});

test("TDD-US4-FR017: a malformed appearance read returns a normal input error and preserves its existing profile", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:branding_read_invalid");
	expect(result.updateThrew).toBe(false);
	expect(result.result).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.rows).toEqual([{ id: result.original.profile.id, ownerId: "fixture-creator", runnerId: result.runnerId, watermarkCorner: "top_left", revision: 1 }]);
});
