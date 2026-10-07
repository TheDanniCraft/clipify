import { runMcpProbe } from "../../support/mcp/probe";
import { flowProbe } from "../../support/mcp/probe";

describe("already connected clients resolve committed authority on their next mutation", () => {
	test.each([
		["TDD-US3-033", "upgrade", null],
		["TDD-US3-034", "downgrade", "FEATURE_RESTRICTED"],
		["TDD-US3-035", "trial-expiry", "FEATURE_RESTRICTED"],
		["TDD-US3-036", "grant-expiry", "FEATURE_RESTRICTED"],
		["TDD-US3-037", "team-removal", "ACCESS_DENIED"],
		["TDD-US3-038", "agency-unlink", "ACCESS_DENIED"],
		["TDD-US3-039", "suspension", "ACCESS_DENIED"],
	])("%s rechecks %s without reconnecting", (_id, transition, code) => {
		const result = flowProbe(`resources:overlay-update:transition-${transition}`);
		expect(result.transitionObservation).toEqual({ baselineStatus: 200, baselineOverlayCount: 1, changeCommitted: true, reusedOriginalToken: true });
		expect(result.protocolStatus).toBe(200);
		if (code) {
			expect(result.resourceResult.error.code).toBe(code);
			expect(result.persistedOverlay).toEqual({ name: "Existing overlay", player_volume: 50, configuration_revision: 1 });
		} else {
			expect(result.resourceResult.overlay).toMatchObject({ name: "Edited by agent", playerVolume: 70, configurationRevision: 2 });
			expect(result.persistedOverlay).toEqual({ name: "Edited by agent", player_volume: 70, configuration_revision: 2 });
		}
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|secret|token|rewardId/);
	});
});

describe("TDD-US3-019 MCP paid overlay settings", () => {
	test.each(["free", "free-filter", "free-styling"])("rejects %s paid changes atomically", (mode) => {
		const result = flowProbe(`resources:overlay-update:${mode}`);
		expect(result.resourceResult?.error?.code).toBe("FEATURE_RESTRICTED");
		expect(result.persistedOverlay).toMatchObject({ name: "Existing overlay", player_volume: 50, configuration_revision: 1 });
	});
	test("allows a Free creator to edit basic metadata", () => {
		const result = flowProbe("resources:overlay-update:free-basic");
		expect(result.resourceResult?.overlay).toMatchObject({ name: "Free name edit", playerVolume: 50, configurationRevision: 2 });
	});
});

describe("creator effective entitlement overrides the actor personal Free plan", () => {
	test.each([
		["TDD-US3-020", "subscription", "billing"],
		["TDD-US3-021", "trial", "reverse_trial"],
		["TDD-US3-022", "grant", "grant"],
		["TDD-US3-023", "allocation", "agency"],
	])("%s allows a second overlay through %s", (_id, source, entitlementSource) => {
		const result = flowProbe(`resources:overlay-create:entitlement-${source}`);
		expect(result.protocolStatus).toBe(200);
		expect(result.commercialObservation).toEqual({ actorPersonalPlan: "free", ownerEffectivePlan: "pro", ownerEntitlementSource: entitlementSource });
		expect(result.resourceResult.created).toMatchObject({ creatorId: "fixture-creator", name: "Agent overlay", configurationRevision: 1 });
		expect(result.resourceResult.replayed).toEqual(result.resourceResult.created);
		expect(result.resourceCount).toBe(2);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-overlay-secret|secret|token|rewardId/);
	});
});

test("TDD-US3-052 inverse actor Pro cannot expand a target creator Free quota", () => {
	const result = flowProbe("resources:overlay-create:entitlement-inverse-actor");
	expect(result.commercialObservation).toMatchObject({ actorPersonalPlan: "pro", ownerEffectivePlan: "free" });
	expect(result.resourceResult.created.error.code).toBe("PLAN_LIMIT_REACHED");
	expect(result.resourceResult.replayed.error.code).toBe("PLAN_LIMIT_REACHED");
	expect(result.resourceCount).toBe(1);
});

test("TDD-US3-006 browser second-overlay denial reports current usage and limit", () => {
	const result = runMcpProbe("browser-playlist-delete-probe", ["overlay-create-quota-feedback"]);
	expect(result.creationFeedbackAvailable).toBe(true);
	expect(result.creationFeedback).toEqual({ overlay: null, error: { code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 } });
	expect(result.overlayCount).toBe(1);
});

describe("TDD-US3-052 current entitlement expiry and state boundaries", () => {
	test.each(["trial-expired", "grant-expired", "grant-future", "grant-revoked", "allocation-expired", "allocation-future"])("%s cannot retain Pro creation limits", (source) => {
		const result = flowProbe(`resources:overlay-create:entitlement-${source}`);
		expect(result.commercialObservation).toMatchObject({ actorPersonalPlan: "free", ownerEffectivePlan: "free" });
		expect(result.resourceResult.created.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage: 1, limit: 1 });
		expect(result.resourceResult.replayed.error.code).toBe("PLAN_LIMIT_REACHED");
		expect(result.resourceCount).toBe(1);
	});
	test("scheduled agency removal retains current access until its actual end", () => {
		const result = flowProbe("resources:overlay-create:entitlement-allocation-removal-active");
		expect(result.commercialObservation).toMatchObject({ ownerEffectivePlan: "pro", ownerEntitlementSource: "agency" });
		expect(result.resourceResult.created).toMatchObject({ creatorId: "fixture-creator", configurationRevision: 1 });
		expect(result.resourceResult.replayed).toEqual(result.resourceResult.created);
		expect(result.resourceCount).toBe(2);
	});
});

test("TDD-US3-024 a downgraded creator can read a retained paid overlay without clearing saved settings", () => {
	const result = flowProbe("resources:overlay-get:retained");
	expect(result.protocolStatus).toBe(200);
	expect(result.resourceResult.overlay).toMatchObject({ id: "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6", name: "Retained paid overlay", playerVolume: 83, themeAccentColor: "#123456", configurationRevision: 1 });
	expect(result.retainedStateUnchanged).toBe(true);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-retained-secret|secret|token/);
});
test("TDD-US3-025 a retained overlay update is rejected without clearing saved paid settings", () => {
	const result = flowProbe("resources:overlay-update:retained");
	expect(result.protocolStatus).toBe(200);
	expect(result.resourceResult.error.code).toBe("FEATURE_RESTRICTED");
	expect(result.retainedStateUnchanged).toBe(true);
});

test("TDD-US3-027 a retained playlist remains readable with saved items intact", () => {
	const result = flowProbe("resources:playlist-get:retained");
	expect(result.protocolStatus).toBe(200);
	expect(result.resourceResult.playlist).toMatchObject({ id: "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6", name: "Retained playlist", configurationRevision: 1 });
	expect(result.resourceResult.items).toEqual([{ id: "RetainedClip", position: 0, title: "Saved retained clip", duration: 12 }]);
	expect(result.retainedPlaylistStateUnchanged).toBe(true);
});
test("TDD-US3-028 a retained playlist update is denied without changing its name or items", () => {
	const result = flowProbe("resources:playlist-update:retained");
	expect(result.protocolStatus).toBe(200);
	expect(result.resourceResult.error.code).toBe("FEATURE_RESTRICTED");
	expect(result.retainedPlaylistStateUnchanged).toBe(true);
});

test("TDD-US3-026 MCP activation cannot run a retained overlay outside the allowance", () => {
	const result = flowProbe("resources:overlay-update:retained-run");
	expect(result.resourceResult.error.code).toBe("FEATURE_RESTRICTED");
	expect(result.retainedStateUnchanged).toBe(true);
	expect(result.retainedRuntimeObservation).toEqual({ allowed: false, reason: "plan-restricted", primaryAllowed: true, effectivePlaylistId: null });
});
test("TDD-US3-029 selecting a retained playlist through MCP does not enable its runtime items", () => {
	const result = flowProbe("resources:overlay-update:retained-playlist-run");
	expect(result.resourceResult.overlay).toMatchObject({ type: "Playlist", playlistId: "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6", configurationRevision: 2 });
	expect(result.retainedPlaylistStateUnchanged).toBe(true);
	expect(result.retainedRuntimeObservation).toEqual({ allowed: true, reason: null, primaryAllowed: true, effectivePlaylistId: null, retainedClipCount: 0, storedPlaylistId: "13903b5b-ce6a-4a98-9c8c-f8ead02ec8c6" });
});

describe("TDD-US3-040 unavailable resources reveal no private existence or contents", () => {
	test.each(["overlay-get:missing", "overlay-get:foreign", "playlist-get:missing", "overlay-update:missing", "playlist-update:missing", "overlay-delete:missing", "playlist-delete:missing", "playlist-add:missing", "playlist-remove:missing", "playlist-reorder:missing"])("%s returns only the public unavailable error", (variant) => {
		const result = flowProbe(`resources:${variant}`);
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult.error).toMatchObject({ code: "RESOURCE_UNAVAILABLE", correlationId: expect.stringMatching(/^[a-f0-9-]{36}$/) });
		expect(Object.keys(result.resourceResult.error).sort()).toEqual(["code", "correlationId", "message"]);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/Private overlay|foreign-owner|private-foreign|Existing playlist|First clip|private-overlay-secret|ownerId|rewardId/);
	});
});

test("TDD-US3-041 persistence failure rolls back resource, child and reference writes without a success reply", () => {
	const result = flowProbe("resources:playlist-delete:audit-failure");
	expect(result.resourceResult.error.code).toBe("SERVICE_UNAVAILABLE");
	expect(result.resourceResult.deletedId).toBeUndefined();
	expect(result.deletionState).toEqual({ playlists: 1, items: 2, overlay: { playlist_id: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", configuration_revision: 1 }, gallery: { playlist_id: "a1dca8b8-089a-47ce-b649-1c32bb3842c1", published: true } });
	expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
	expect(JSON.stringify(result.resourceResult)).not.toMatch(/controlled delete audit failure|audit_events|reject_playlist_delete|password|secret/);
});

describe("TDD-US3-042 provider timeout cannot produce mutation success or partial writes", () => {
	test.each(["headers", "body"])("stalled provider %s preserves saved items and audit", (phase) => {
		const result = flowProbe(`resources:playlist-add:provider-timeout-${phase}`);
		expect(result.resourceResult.error.code).toBe("SERVICE_UNAVAILABLE");
		expect(result.resourceResult.playlist).toBeUndefined();
		expect(result.persistedPlaylist.configuration_revision).toBe(1);
		expect(result.persistedItems).toEqual([
			{ clip_id: "ClipFirst", position: 0 },
			{ clip_id: "ClipSecond", position: 1 },
		]);
		expect(result.externalClipRequests).toBe(1);
		expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/controlled provider deadline|private-|ownerId|secret/);
	});
});

describe("TDD-US3-054 documented business failures keep stable public codes and private causes", () => {
	test.each([
		["overlay-update:free", "FEATURE_RESTRICTED"],
		["overlay-get:denied", "ACCESS_DENIED"],
		["playlist-add:stale", "CONFLICT"],
		["playlist-add:invalid-provider", "INVALID_INPUT"],
		["playlist-add:limit", "PLAN_LIMIT_REACHED"],
		["playlist-add:provider-error", "SERVICE_UNAVAILABLE"],
	])("%s maps to %s without partial writes", (variant, code) => {
		const result = flowProbe(`resources:${variant}`);
		expect(result.protocolStatus).toBe(200);
		expect(result.resourceResult.error.code).toBe(code);
		expect(result.resourceResult.error.correlationId).toMatch(/^[a-f0-9-]{36}$/);
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-|controlled provider failure|ownerId|rewardId|SELECT|INSERT|password/);
		if (variant.startsWith("playlist-add")) {
			expect(result.persistedPlaylist.configuration_revision).toBe(1);
			expect(result.persistedItems).toHaveLength(variant.endsWith(":limit") ? 50 : 2);
		}
		expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
	});
});

describe("TDD-US3-051 current Free resource quota explicit count boundaries", () => {
	test.each(["overlay", "playlist"].flatMap((kind) => ["zero", "below", "exact", "above"].map((boundary) => [kind, boundary])))("%s creation at %s boundary preserves authoritative count and retry", (kind, boundary) => {
		const result = flowProbe(`resources:${kind}-create:boundary-${boundary}`);
		const usage = boundary === "above" ? 2 : boundary === "exact" ? 1 : 0;
		expect(result.protocolStatus).toBe(200);
		if (usage >= 1) {
			expect(result.resourceResult.created.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage, limit: 1 });
			expect(result.resourceResult.replayed.error).toMatchObject({ code: "PLAN_LIMIT_REACHED", usage, limit: 1 });
			expect(result.activityRecords.filter((entry: { outcome: string }) => entry.outcome === "success")).toEqual([]);
		} else {
			expect(result.resourceResult.created).toMatchObject({ creatorId: "fixture-creator", configurationRevision: 1 });
			expect(result.resourceResult.replayed).toEqual(result.resourceResult.created);
		}
		expect(kind === "overlay" ? result.resourceCount : result.playlistCount).toBe(Math.max(1, usage));
		expect(JSON.stringify(result.resourceResult)).not.toMatch(/private-|ownerId|secret|token/);
	});
});

describe("canonical twenty independent browser and MCP quota races", () => {
	test.each([
		["TDD-US3-030", "browser", 20, 0],
		["TDD-US3-031", "mcp", 0, 20],
		["TDD-US3-032", "mixed", 10, 10],
	])("%s %s requests share exactly one Free overlay allowance", (_id, mode, browserRequests, mcpRequests) => {
		const result = flowProbe(`catalogue:quota-races:${mode}`);
		expect(result).toMatchObject({ resources: 1, successes: 1, browserRequests, mcpRequests });
		expect(result.outcomes).toHaveLength(20);
		expect(result.outcomes.every((row: { status: number }) => row.status === 200)).toBe(true);
		expect(result.denials).toHaveLength(19);
		expect(new Set(result.denials)).toEqual(new Set(["PLAN_LIMIT_REACHED"]));
	});
});

test("TDD-US3-051 failed insert releases quota and retry reservation before a successful retry", () => {
	const result = flowProbe("catalogue:quota-invariants:rollback");
	expect(result.first).toEqual({ status: 200, success: false, code: "SERVICE_UNAVAILABLE" });
	expect(result.rolledBack).toEqual({ resources: 0, retries: 0, successful_audits: 0 });
	expect(result.retry).toEqual({ status: 200, success: true, code: null });
	expect(result.final).toEqual({ resources: 1, retries: 1, successful_audits: 1 });
});
test("TDD-US3-051 simultaneous browser delete and MCP create preserve one-resource invariant", () => {
	const result = flowProbe("catalogue:quota-invariants:delete-create");
	expect(result.deleted).toBe(true);
	expect(result.originalPresent).toBe(false);
	expect(result.created.status).toBe(200);
	expect(result.created.code).toBe(result.created.success ? null : "PLAN_LIMIT_REACHED");
	expect(result.final.resources).toBe(result.created.success ? 1 : 0);
});
test("TDD-US3-056 actual PostgreSQL creator lock permits unrelated creator progress", () => {
	expect(flowProbe("catalogue:quota-invariants:isolation")).toEqual({ reached: true, blockedStillPending: true, independentCreated: true, releasedCreated: true, firstCreatorCount: 1, independentCount: 1 });
});

describe("canonical browser shared commercial policies", () => {
	test.each(["volume", "filter", "styling"])("TDD-US3-007 browser paid %s preserves saved Free settings", (setting) => {
		expect(runMcpProbe("browser-playlist-delete-probe", [`commercial:paid-${setting}`]).commercialObservation).toEqual({ saved: false, unchanged: true });
	});
	test.each([
		["TDD-US3-008", "subscription"],
		["TDD-US3-009", "trial"],
		["TDD-US3-010", "grant"],
		["TDD-US3-011", "allocation"],
	])("%s browser creation honors creator %s over actor Free", (_id, source) => {
		expect(runMcpProbe("browser-playlist-delete-probe", [`commercial:create-${source}`]).commercialObservation).toEqual({ created: true, error: null, resources: 2, actorPersonalPlan: "free" });
	});
	test.each([
		["TDD-US3-012", "overlay-read", { available: true, savedAccent: "#123456", unchanged: true }],
		["TDD-US3-013", "overlay-update", { saved: false, unchanged: true }],
		["TDD-US3-014", "overlay-run", { saved: false, runtimeAllowed: false, unchanged: true }],
		["TDD-US3-015", "playlist-read", { clipIds: ["RetainedClip"], unchanged: true }],
		["TDD-US3-016", "playlist-update", { saved: false, unchanged: true }],
		["TDD-US3-017", "playlist-run", { saved: true, runtimeClips: 0, effectivePlaylistId: null, storedRetainedSelection: true, unchanged: true }],
	])("%s retained browser %s follows current resource policy", (_id, operation, expected) => {
		expect(runMcpProbe("browser-playlist-delete-probe", [`commercial:${operation}`]).commercialObservation).toEqual(expected);
	});
});
