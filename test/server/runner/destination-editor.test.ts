/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test.each([
	["delete", true, undefined],
	["delete_referenced", false, "RESOURCE_IN_USE"],
	["delete_stale", false, "CONFLICT"],
])("TDD-US2-FR009 U9 / TDD-US2-CON005 U248: %s preserves references and rejects stale destructive edits", (variant, deleted, code) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_${variant}`);
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.deleteAvailable).toBe(true);
	expect(result.attempted).toMatchObject({ success: deleted, ...(code ? { code } : {}) });
	expect(result.stored).toHaveLength(deleted ? 0 : 1);
	expect(result.reopened.destinations).toHaveLength(deleted ? 0 : 1);
	expect(result.sessionReferences).toBe(variant === "delete_referenced" ? 1 : 0);
	if (!deleted) expect(result.unchanged).toBe(true);
	if (variant === "delete_referenced") expect(result.attempted.references.sessions).toHaveLength(1);
	expect(result.safe).toBe(true);
});

test("TDD-US2-FR009 U9 / TDD-US2-CON005 U141: saving a named destination persists encrypted credential bytes and safe revisioned editor data", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_editor");
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.saved).toMatchObject({ success: true, destination: { name: "My Twitch", credentialConfigured: true, configurationRevision: 1 } });
	expect(result.stored).toHaveLength(1);
	expect(result.stored[0]).toMatchObject({ id: expect.any(String), name: "My Twitch", credentialRevision: 1, configurationRevision: 1, encrypted: true });
	expect(result.safe).toBe(true);
});

test.each([
	["invalid_url", "TDD-US2-OPT013 U53"],
	["missing_youtube", "TDD-US2-OPT014 U54"],
	["missing_twitch", "TDD-US2-OPT015 U55"],
	["duplicate", "TDD-US2-OPT016 U56"],
])("TDD-US2-EC004 U26 / %s %s: invalid edits preserve the authoritative row including encrypted bytes", (variant) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_${variant}`);
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.attempted).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.unchanged).toBe(true);
	expect(result.stored).toHaveLength(1);
	expect(result.safe).toBe(true);
});

test.each([
	[0, false, "TDD-US2-BND001 U152"],
	[1, true, "TDD-US2-BND002 U153"],
	[80, true, "TDD-US2-BND003 U154"],
	[81, false, "TDD-US2-BND004 U155"],
])("destination name length %s accepts=%s %s with other inputs valid", (length, accepted) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_bound_${length}`);
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.attempted).toMatchObject({ success: accepted, ...(accepted ? {} : { code: "INVALID_INPUT" }) });
	expect(result.stored).toHaveLength(accepted ? 2 : 1);
	expect(result.unchanged).toBe(true);
	if (accepted) expect(result.stored.find((row: { name: string }) => row.name === "x".repeat(length))).toMatchObject({ credentialRevision: 1, configurationRevision: 1, cleared: true });
});

test.each([
	["keep", "TDD-US2-OPT017 U57 / TDD-US2-CON005 U244", 1],
	["replace", "TDD-US2-OPT018 U58 / TDD-US2-CON005 U245", 2],
	["clear", "TDD-US2-OPT019 U59 / TDD-US2-CON005 U246", 2],
])("%s %s updates only the owned credential and configuration revisions", (variant, _trace, credentialRevision) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_${variant}`);
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.attempted).toMatchObject({ success: true });
	expect(result.stored).toHaveLength(1);
	expect(result.stored[0]).toMatchObject({ credentialRevision, configurationRevision: 2, encrypted: variant === "keep", replacementEncrypted: variant === "replace", cleared: variant === "clear" });
	expect(result.reopened.destinations[0]).toMatchObject({ credentialConfigured: variant !== "clear" });
	if (variant === "clear") expect(result.clearedStart.result?.structuredContent?.error?.code).toBe("INVALID_INPUT");
	expect(result.safe).toBe(true);
});

test("TDD-US2-CON005 U235 property: arbitrary foreign owner reads cannot expose a saved destination or its credential", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_foreign");
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.foreignReadsDenied).toBe(true);
	expect(result.unchanged).toBe(true);
	expect(result.safe).toBe(true);
});

test("TDD-US2-CON005 U248: a real database failure rolls back the attempted name and credential replacement", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_rollback");
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.attempted).toMatchObject({ success: false, code: "SERVICE_UNAVAILABLE" });
	expect(result.unchanged).toBe(true);
	expect(result.stored).toHaveLength(1);
	expect(result.stored[0]).toMatchObject({ name: "My Twitch", credentialRevision: 1, configurationRevision: 1, encrypted: true });
});

test("TDD-US2-FR009 U9 / TDD-US2-CON005 U141: repeated legacy saves normalize one stable encrypted destination", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_legacy_repeat");
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.second).toMatchObject({ success: true });
	expect(result.firstCount).toBe(1);
	expect(result.count).toBe(1);
	expect(result.references).toBe(1);
	expect(result.stable).toBe(true);
	expect(result.encrypted).toBe(true);
	expect(result.credentialRevision).toBe(1);
	expect(result.safe).toBe(true);
});

test("TDD-US2-CON005 U245: changing a converted legacy key updates the same destination", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_legacy_rekey");
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.second).toMatchObject({ success: true });
	expect(result.count).toBe(1);
	expect(result.stable).toBe(true);
	expect(result.encrypted).toBe(true);
	expect(result.credentialRevision).toBe(2);
	expect(result.safe).toBe(true);
});

test("TDD-US2-CON005 U248: a failed legacy conversion rolls back scalar configuration and all references", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_legacy_rollback");
	expect(result.authenticated).toBe(true);
	expect(result.attempted).toMatchObject({ success: false, code: "SERVICE_UNAVAILABLE" });
	expect(result.unchanged).toBe(true);
	expect(result.targets).toBe(0);
	expect(result.references).toBe(0);
});

test("TDD-US2-FR009 U9 / TDD-US2-CON005 U248: legacy edits cannot implicitly replace another broadcast's shared credential", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_legacy_shared");
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.attempted).toMatchObject({ success: false, code: "CONFLICT" });
	expect(result.unchanged).toBe(true);
	expect(result.targetUnchanged).toBe(true);
	expect(result.references).toBe(2);
});

test("TDD-US2-FR009 U9 / TDD-US2-CON005 U248: scalar legacy edits preserve an existing multiple-target selection", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_legacy_multiple");
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.attempted).toMatchObject({ success: false, code: "CONFLICT" });
	expect(result.unchanged).toBe(true);
	expect(result.targets).toBe(2);
	expect(result.references).toBe(2);
});

test("TDD-US2-FR009 U9: referenced targets reject individual action deletion while complete owner deletion cascades", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_legacy_owner_delete");
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.directDeletionBlocked).toBe(true);
	expect(result.ownerDeleted).toBe(true);
	expect(result.targets).toBe(0);
	expect(result.references).toBe(0);
});

test("TDD-US2-EC004 U26 / TDD-US2-CON005 U235: invalid request matrix preserves credentials and global targets remain owner-scoped", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_validation_matrix");
	expect(result.authenticated).toBe(true);
	expect(result.invalid).toEqual(
		[
			["missing revision", "INVALID_INPUT"],
			["invalid owner", "INVALID_INPUT"],
			["unknown destination", "RESOURCE_UNAVAILABLE"],
			["stale revision", "CONFLICT"],
			["foreign runner", "RESOURCE_UNAVAILABLE"],
			["malformed URL", "INVALID_INPUT"],
			["control character URL", "INVALID_INPUT"],
			["fragment URL", "INVALID_INPUT"],
			["key supplied with keep", "INVALID_INPUT"],
			["missing replacement key", "INVALID_INPUT"],
			["control character key", "INVALID_INPUT"],
			["new provider without key", "INVALID_INPUT"],
			["duplicate name", "INVALID_INPUT"],
		].map(([name, code]) => ({ name, success: false, code })),
	);
	expect(result.reads).toMatchObject([
		{ success: false, code: "INVALID_INPUT" },
		{ success: false, code: "RESOURCE_UNAVAILABLE" },
	]);
	expect(result.removals).toMatchObject([
		{ success: false, code: "INVALID_INPUT" },
		{ success: false, code: "RESOURCE_UNAVAILABLE" },
	]);
	expect(result.global).toMatchObject({ success: true, destination: { runnerId: null } });
	expect(result.globalEdit).toMatchObject({ success: true, destination: { name: "Renamed global", runnerId: null, configurationRevision: 2 } });
	expect(result.all.destinations).toHaveLength(2);
	expect(result.scoped.destinations).toHaveLength(2);
	expect(result.unchanged).toBe(true);
	expect(result.safe).toBe(true);
});

test.each([
	["reuse", 1, "Reusable Twitch", true],
	["collision", 2, "Twitch 2", false],
])("TDD-US2-FR009 U9 legacy %s preserves existing owned target metadata", (variant, total, name, reused) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_legacy_${variant}`);
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.total).toBe(total);
	expect(result.targets).toMatchObject([{ name, keyConfigured: true, keyPreserved: true }]);
	expect(result.reused).toBe(reused);
	expect(result.peerUnchanged).toBe(true);
});

test.each([
	["youtube", "YouTube", true],
	["custom", "Custom RTMP", false],
])("TDD-US2-FR009 U9 legacy %s conversion preserves provider and credential intent", (provider, name, keyConfigured) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_legacy_${provider}`);
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.total).toBe(1);
	expect(result.targets).toMatchObject([{ provider, name, keyConfigured, keyPreserved: keyConfigured ? true : null }]);
	if (provider === "custom") expect(result.start).toMatchObject({ success: true, accepted: true });
});

test("TDD-US2-CON005 U246: metadata remains editable after explicit credential removal while Start stays blocked", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_clear_metadata");
	expect(result.authenticated).toBe(true);
	expect(result.attempted).toMatchObject({ success: true });
	expect(result.reopened.destinations).toMatchObject([{ name: "Renamed without key", credentialConfigured: false, credentialRevision: 2, configurationRevision: 3 }]);
	expect(result.stored).toMatchObject([{ cleared: true, credentialRevision: 2 }]);
	expect(result.clearedStart.result?.structuredContent?.error?.code).toBe("INVALID_INPUT");
	expect(result.safe).toBe(true);
});

test("TDD-US2-FR009 U9 / TDD-US2-CON005 U141: actual MCP edits normalize one stable protected legacy target", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_legacy_mcp_repeat");
	expect(result.authenticated).toBe(true);
	expect(result.first).toMatchObject({ success: true });
	expect(result.second).toMatchObject({ success: true });
	expect(result.firstCount).toBe(1);
	expect(result.count).toBe(1);
	expect(result.references).toBe(1);
	expect(result.stable).toBe(true);
	expect(result.encrypted).toBe(true);
	expect(result.credentialRevision).toBe(1);
	expect(result.safe).toBe(true);
});

test("TDD-US2-CON005 U248: failed actual MCP conversion rolls back the preceding session mutation", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_legacy_mcp_rollback");
	expect(result.authenticated).toBe(true);
	expect(result.attempted).toMatchObject({ success: false, code: "SERVICE_UNAVAILABLE" });
	expect(result.unchanged).toBe(true);
	expect(result.count).toBe(0);
	expect(result.references).toBe(0);
	expect(result.safe).toBe(true);
});

test.each(["dashboard", "mcp"])("TDD-US2-CON005 U244: %s metadata edits keep the authoritative named credential and endpoint", (entry) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_legacy_authority_${entry}`);
	expect(result.authenticated).toBe(true);
	expect(result.attempted).toMatchObject({ success: true });
	expect(result.keyPreserved).toBe(true);
	expect(result.endpointPreserved).toBe(true);
	expect(result.providerPreserved).toBe(true);
	expect(result.credentialRevision).toBe(2);
	expect(result.configurationRevision).toBe(2);
	expect(result.scalarSynchronized).toBe(true);
	expect(result.safe).toBe(true);
});

test.each([
	["dashboard", "youtube", true, 1, 2],
	["clear", "custom", false, 2, 2],
	["mcp_change", "youtube", false, 2, 2],
	["mcp_same", "twitch", true, 1, 1],
])("TDD-US2-CON005 U244/U246: explicit endpoint intent %s preserves or clears the current key correctly", (entry, provider, keyPreserved, credentialRevision, configurationRevision) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_legacy_endpoint_${entry}`);
	expect(result.authenticated).toBe(true);
	expect(result.attempted).toMatchObject({ success: true });
	expect(result.endpointChanged).toBe(true);
	expect(result.provider).toBe(provider);
	expect(result.keyPreserved).toBe(keyPreserved);
	expect(result.cleared).toBe(!keyPreserved);
	expect(result.credentialRevision).toBe(credentialRevision);
	expect(result.configurationRevision).toBe(configurationRevision);
	expect(result.scalarSynchronized).toBe(true);
	if (entry === "mcp_change") expect(result.attempted).toMatchObject({ credentialsRequired: true, credentialsConfigured: false });
	if (entry === "mcp_same") expect(result.attempted).toMatchObject({ credentialsRequired: false, credentialsConfigured: true });
});

test("confirmed deletion detaches a stopped saved broadcast and clears its legacy endpoint", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_delete_detach");
	expect(result.attempted).toMatchObject({ success: true });
	expect(result.stored).toHaveLength(0);
	expect(result.reopened.destinations).toHaveLength(0);
	expect(result.sessionReferences).toBe(0);
	expect(result.savedBroadcast).toEqual({ rtmp_url: "", has_key: false, configuration_revision: 2 });
	expect(result.safe).toBe(true);
});

test.each(["active", "cached", "uncertain", "running", "desired", "snapshot", "schedule", "stale", "rollback"])("confirmed deletion preserves a destination and its saved selection when %s prevents removal", (variant) => {
	const result = flowProbe(`catalogue:workflow:runner_free_pro:destinations_delete_detach_${variant}`);
	expect(result.attempted).toMatchObject({ success: false, ...(variant === "stale" ? { code: "CONFLICT" } : variant !== "rollback" ? { code: "RESOURCE_IN_USE" } : {}) });
	expect(result.unchanged).toBe(true);
	expect(result.sessionReferences).toBe(variant === "snapshot" ? 0 : 1);
	expect(result.savedBroadcast).toEqual({ rtmp_url: "rtmp://live.twitch.tv/app", has_key: true, configuration_revision: 1 });
	expect(result.safe).toBe(true);
});

test("confirmed deletion retains other selected destinations and their compatible endpoint", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_delete_detach_multiple");
	expect(result.attempted).toMatchObject({ success: true });
	expect(result.sessionReferences).toBe(0);
	expect(result.remainingTargets).toEqual(["Backup"]);
	expect(result.savedBroadcast).toEqual({ rtmp_url: "rtmp://127.0.0.1:1943/backup", has_key: false, configuration_revision: 2 });
	expect(result.reopened.destinations.map((row: { name: string }) => row.name)).toEqual(["Backup"]);
	expect(result.safe).toBe(true);
});
