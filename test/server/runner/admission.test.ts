/** @jest-environment node */
import { flowProbe, runMcpProbe } from "../../support/mcp/probe";
import { authorize } from "@/auth/authorize";
import { workflowPermissions } from "@/server/mcp/workflows/catalogue";
import { deriveRunnerCapabilities } from "@/server/runner/capabilities";
import { runnerAccessFixtures, RUNNER_FIXTURE_NOW } from "../../support/runner/fixtures";
describe("Runner capability admission", () => {
	it("TDD-US1-FR001: a Free owner can register more than one device without a paid grant", () => {
		const owner = runnerAccessFixtures.free.build();
		const capabilities = deriveRunnerCapabilities({ proAccess: owner.effectivePro }, RUNNER_FIXTURE_NOW);
		expect(capabilities.basicAccess).toBe(true);
		expect(capabilities.maxRegisteredDevices).toBeNull();
	});

	it("TDD-US1-OPT001: Free registration resolves manual single-broadcast capabilities with unlimited hours", () => {
		expect(deriveRunnerCapabilities({ proAccess: false }, RUNNER_FIXTURE_NOW)).toMatchObject({ basicAccess: true, runnerPro: false, maxRegisteredDevices: null, maxActiveBroadcasts: 1, maxTargets: 1, scheduling: false, customStandby: false, attributionRequired: true, monthlyUsageLimit: null });
	});

	it("TDD-US1-OPT002: Pro registration resolves unrestricted Runner capabilities", () => {
		const capabilities = deriveRunnerCapabilities({ proAccess: true }, RUNNER_FIXTURE_NOW);
		expect(capabilities).toMatchObject({ basicAccess: true, runnerPro: true, maxRegisteredDevices: null, maxActiveBroadcasts: null, maxTargets: null, scheduling: true, customStandby: true, attributionRequired: false, monthlyUsageLimit: null, evaluatedAt: RUNNER_FIXTURE_NOW.toISOString(), validUntil: null, source: "pro", capabilityRevision: expect.any(String) });
	});

	it("TDD-US1-OPT003: retired Runner-only grants cannot unlock advanced Runner features", () => {
		const owner = runnerAccessFixtures.legacy.build();
		const endsAt = new Date("2026-10-15T12:00:00.000Z");
		const capabilities = deriveRunnerCapabilities({ proAccess: owner.effectivePro, validUntil: endsAt }, RUNNER_FIXTURE_NOW);
		expect(capabilities).toMatchObject({ basicAccess: true, runnerPro: false, maxActiveBroadcasts: 1, maxTargets: 1, scheduling: false, customStandby: false, attributionRequired: true, validUntil: endsAt.toISOString(), source: "free" });
		expect(owner.effectivePro).toBe(false);
	});

	it("TDD-US1-OPT004: retired agency Runner metadata cannot unlock advanced Runner features", () => {
		const owner = runnerAccessFixtures.agency.build();
		expect(deriveRunnerCapabilities({ proAccess: owner.effectivePro }, RUNNER_FIXTURE_NOW)).toMatchObject({ basicAccess: true, runnerPro: false, maxActiveBroadcasts: 1, scheduling: false, source: "free" });
		expect(owner.effectivePro).toBe(false);
	});

	it("TDD-US1-OPT005: an active Pro trial exposes Runner benefits with its trial expiry", () => {
		const owner = runnerAccessFixtures.trial.build();
		const trialEnd = new Date("2026-10-21T12:00:00.000Z");
		expect(deriveRunnerCapabilities({ proAccess: owner.effectivePro, proSource: "trial", validUntil: trialEnd }, RUNNER_FIXTURE_NOW)).toMatchObject({ runnerPro: true, maxTargets: null, attributionRequired: false, source: "trial", validUntil: trialEnd.toISOString() });
	});

	it("TDD-US1-OPT002 expiry: the snapshot carries the earliest known paid benefit deadline", () => {
		const early = new Date("2026-10-16T12:00:00.000Z");
		const later = new Date("2026-10-17T12:00:00.000Z");
		expect(deriveRunnerCapabilities({ proAccess: true, knownPaidExpiries: [later, null, early] }, RUNNER_FIXTURE_NOW).validUntil).toBe(early.toISOString());
	});

	it("TDD-US1-OPT002 revision: evaluation time cannot invalidate an unchanged capability policy", () => {
		const benefits = { proAccess: true };
		const first = deriveRunnerCapabilities(benefits, RUNNER_FIXTURE_NOW);
		const later = deriveRunnerCapabilities(benefits, new Date(RUNNER_FIXTURE_NOW.getTime() + 60000));
		const current = deriveRunnerCapabilities(benefits);
		expect(later.capabilityRevision).toBe(first.capabilityRevision);
		expect(current.capabilityRevision).toBe(first.capabilityRevision);
		expect(later.evaluatedAt).not.toBe(first.evaluatedAt);
		expect(deriveRunnerCapabilities({ proAccess: false }).capabilityRevision).not.toBe(first.capabilityRevision);
	});

	it("TDD-US1-EC003: paid benefits cannot give a read-only operator start edit or stop permission", () => {
		const operations = ["control_stream_session", "configure_stream_session", "control_stream_session"] as const;
		const decisions = operations.map((operation) => authorize({ session: { userId: "read-only-operator", authenticatedAt: RUNNER_FIXTURE_NOW }, creatorId: "protected-owner", resourceOwnerId: "protected-owner", lifecycle: "active", permission: workflowPermissions[operation], access: { kind: "direct", permissions: ["runner:read"] }, entitlements: ["pro", "runner"], now: RUNNER_FIXTURE_NOW }));
		expect(decisions).toEqual(operations.map(() => ({ allowed: false, code: "PERMISSION_DENIED" })));
	});
	it("TDD-US1-CON001 U137: racing starts wait for the owner row and commit one reservation", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_lock");
		expect(result.observedLocks).toBe(2);
		expect(result.beforeRelease).toBe(0);
		expect(result.accepted).toBe(1);
		expect(result.loserCodes).toEqual(["RUNNER_CONCURRENCY_LIMIT"]);
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it("TDD-US1-FR002 U2: denied fallback start rolls back its command and audit without touching the holder", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_clip_fallback");
		expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
		expect(result.holderUnchanged).toBe(true);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
		expect(result.writes).toBe(0);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-OPT006 U46: Clip playback retains its admission and rejects another command", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_clip");
		expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
		expect(result.holderUnchanged).toBe(true);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
		expect(result.writes).toBe(0);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-OPT007 U47: Live fallback forwarding live input retains its admission and rejects another command", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_fallback_forwarding");
		expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
		expect(result.holderUnchanged).toBe(true);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
		expect(result.writes).toBe(0);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-OPT008 U48: Live fallback playing clips retains its admission and rejects another command", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_fallback_clips");
		expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
		expect(result.holderUnchanged).toBe(true);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
		expect(result.writes).toBe(0);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-OPT009 U49: Live fallback showing standby retains its admission and rejects another command", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_fallback_standby");
		expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
		expect(result.holderUnchanged).toBe(true);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
		expect(result.writes).toBe(0);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-FR003 U3: operator Pro benefits cannot bypass a Free resource owner's occupied slot", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_policy-agency-pro-operator");
		expect(result.operatorPlan).toBe("pro");
		expect(result.ownerPlan).toBe("free");
		expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
		expect(result.holderUnchanged).toBe(true);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
		expect(result.writes).toBe(0);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-EC001 U23: a losing concurrent transaction rolls back its revision and mutation audit", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_lock");
		expect(result.beforeRelease).toBe(0);
		expect(result.observedLocks).toBe(2);
		expect(result.sessions).toHaveLength(2);
		expect(result.sessions).toEqual(
			expect.arrayContaining([
				{ desired_state: "running", actual_state: "stopped", configuration_revision: 2 },
				{ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 },
			]),
		);
		expect(result.successfulWrites).toBe(1);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-OPT087 U127: pre-output credential validation rolls back without reserving an owner slot", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:failed_before_output");
		expect(result.failureCode).toBe("INVALID_INPUT");
		expect(result.afterFailure).toEqual({ occupied: 0, desiredRunning: 0 });
		expect(result.failedSession).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
		expect(result.onlyRetryReserved).toBe(true);
		expect(result.writes).toBe(1);
		expect(result.retryApplied).toBe(false);
	});

	it("TDD-US1-OPT082 U122: denied start preserves broadcast state revision and successful audit count", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:denied_start");
		expect(result.selected.error).toEqual({ code: -32000, message: "access token is missing required scope: runner:control" });
		expect(result.unchanged).toBe(true);
		expect(result.writes).toBe(0);
		expect(result.safe).toBe(true);
	});

	it("TDD-US1-OPT083 U123: denied stop preserves broadcast state revision and successful audit count", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:denied_stop");
		expect(result.selected.error).toEqual({ code: -32000, message: "access token is missing required scope: runner:control" });
		expect(result.unchanged).toBe(true);
		expect(result.writes).toBe(0);
		expect(result.safe).toBe(true);
	});

	it("TDD-US1-OPT084 U124: denied destination preserves broadcast state revision and successful audit count", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:denied_destination");
		expect(result.selected.error).toEqual({ code: -32000, message: "access token is missing required scope: runner:update" });
		expect(result.unchanged).toBe(true);
		expect(result.writes).toBe(0);
		expect(result.safe).toBe(true);
	});

	it("TDD-US1-CON001 paid companion: owner-serialized Pro admission can reserve two independent generations", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_service_pro");
		expect(result.beforeRelease).toBe(0);
		expect(result.observedLocks).toBe(2);
		expect(result.accepted).toBe(2);
		expect(result.occupied).toBe(2);
		expect(result.loserCodes).toEqual([]);
		expect(result.desiredRunning).toBe(0);
	});

	it("TDD-US1-CON001 reservation identity companion: an existing same-session reservation retains its generation and original revision", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_service_retry");
		expect(result).toEqual({ sameId: true, sameGeneration: true, revision: 2, state: "reserved", dispatched: null, occupied: 1, desiredRunning: 0 });
	});
	it("TDD-US1-EC002 U24: stale offline health cannot release a dispatched owner admission or mutate the rejected command", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_offline");
		expect(result.offlineHealth).toBe(true);
		expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.holderUnchanged).toBe(true);
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
		expect(result.writes).toBe(0);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
	});

	it("TDD-US1-CON002 U138: cancelling a never-dispatched reservation releases occupancy while retaining its terminal identity", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_cancel_reserved");
		expect(result.startedAccepted).toBe(true);
		expect(result.initialUndispatched).toBe(true);
		expect(result.afterCancel).toEqual({ occupied: 0, desiredRunning: 0 });
		expect(result.cancelledState).toBe("failed_before_output");
		expect(result.cancelledReason).toBe("cancelled_before_dispatch");
		expect(result.closedAtRecorded).toBe(true);
		expect(result.cancelledIdentityPreserved).toBe(true);
		expect(result.stopApplied).toBe(true);
		expect(result.secondAccepted).toBe(true);
		expect(result.newGeneration).toBe(true);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-CON002 U236: a dispatched execution with a lost acknowledgement cannot be released by Stop intent", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_stop_dispatched");
		expect(result.dispatchedBeforeStop).toBe(true);
		expect(result.stopApplied).toBe(false);
		expect(result.cancelledState).toBe("draining");
		expect(result.closedAtRecorded).toBe(false);
		expect(result.cancelledIdentityPreserved).toBe(true);
		expect(result.afterCancel).toEqual({ occupied: 1, desiredRunning: 0 });
		expect(result.secondAccepted).toBe(false);
		expect(result.secondCode).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-CON002 U237: stale execution identity is rejected despite a current revision and cannot mutate a newer attempt", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_stale_generation");
		expect(result.differentGenerations).toBe(true);
		expect(result.staleCode).toBe("CONFLICT");
		expect(result.unchanged).toBe(true);
		expect(result.currentGenerationRetained).toBe(true);
		expect(result.matchingAccepted).toBe(true);
		expect(result.occupied).toBe(0);
	});

	it("TDD-US1-CON002 U238: unchanged Start retry reuses its admission and revision but cannot replay across a configuration edit", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_public_retry");
		expect(result.retry).toEqual(result.first);
		expect(result.retry.accepted).toBe(true);
		expect(result.afterRetry).toEqual({ configuration_revision: 2, desired_state: "running", actual_state: "stopped" });
		expect(result.admissions).toEqual([{ execution_generation: result.first.executionGeneration, configuration_revision: 2 }]);
		expect(result.staleAfterEditCode).toBe("CONFLICT");
		expect(result.afterEdit.configuration_revision).toBe(3);
		expect(result.occupied).toBe(1);
	});

	it("TDD-US1-CON003 U139 unlink: retired credentials remain terminal-only and generation-bound without releasing an active slot", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_revoke_unlink");
		expect(result.revoked).toBe(true);
		expect(result.credentialRotated).toBe(true);
		expect(result.terminalHashMatches).toBe(true);
		expect(result.plaintextStored).toBe(false);
		expect(result.revokedAtRecorded).toBe(true);
		expect(result.admissionState).toBe("draining");
		expect(result.identityPreserved).toBe(true);
		expect(result.stoppedAt).toBeNull();
		expect(result.occupied).toBe(1);
		expect(result.safe).toBe(true);
	});

	it("TDD-US1-CON003 U139 delete: device removal retains the unresolved generation and former terminal credential", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_revoke_delete");
		expect(result.deleted).toBe(true);
		expect(result.deviceReferenceCleared).toBe(true);
		expect(result.sessionReferenceRetained).toBe(true);
		expect(result.terminalHashMatches).toBe(true);
		expect(result.revokedAtRecorded).toBe(true);
		expect(result.admissionState).toBe("draining");
		expect(result.identityPreserved).toBe(true);
		expect(result.stoppedAt).toBeNull();
		expect(result.occupied).toBe(1);
		expect(result.plaintextStored).toBe(false);
		expect(result.safe).toBe(true);
	});

	it("TDD-US1-CON003 U139 repeated revocation: a rotated placeholder cannot overwrite the original terminal credential or extend revocation time", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_revoke_twice");
		expect(result.terminalHashMatches).toBe(true);
		expect(result.revocationTimePreserved).toBe(true);
		expect(result.admissionState).toBe("draining");
		expect(result.identityPreserved).toBe(true);
		expect(result.occupied).toBe(1);
		expect(result.stoppedAt).toBeNull();
		expect(result.plaintextStored).toBe(false);
	});

	it("TDD-US1-CON003 U139 dashboard unlink: verified browser action retains the same generation-bound terminal reconciliation", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-unlink-admission"]);
		expect(result.runnerOutcome).toEqual({ success: true });
		expect(result.runnerTerminal).toMatchObject({ state: "draining", hashMatches: true, revokedAtRecorded: true, generationRetained: true, stoppedAt: null, plaintextStored: false });
		expect(result.runnerSession).toMatchObject({ desired_state: "stopped", actual_state: "running", configuration_revision: 2 });
	});

	it("TDD-US1-CON003 U139 dashboard delete: removing the device cannot erase its unconfirmed execution or former terminal authority", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["runner-browser-delete-admission"]);
		expect(result.runnerOutcome).toEqual({ success: true });
		expect(result.runnerRecord).toBeUndefined();
		expect(result.runnerTerminal).toMatchObject({ state: "draining", hashMatches: true, revokedAtRecorded: true, generationRetained: true, runnerReference: null, stoppedAt: null, plaintextStored: false });
		expect(result.runnerSession).toMatchObject({ desired_state: "stopped", actual_state: "running", configuration_revision: 2 });
	});

	it("TDD-US1-CON003 U139 undispatched revocation: unlink cancels an unused reservation without waiting for nonexistent output closure", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_revoke_reserved");
		expect(result.revoked).toBe(true);
		expect(result.terminalHashMatches).toBe(true);
		expect(result.admissionState).toBe("failed_before_output");
		expect(result.terminalReason).toBe("revoked_before_dispatch");
		expect(result.stoppedAt).not.toBeNull();
		expect(result.occupied).toBe(0);
		expect(result.desiredRunning).toBe(0);
		expect(result.identityPreserved).toBe(true);
	});

	it("TDD-US1-CON003 U239: a matching all-output-closed receipt reconciles a deleted device's generation and permits a new reservation", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_terminal_ack");
		expect(result.endpointAvailable).toBe(true);
		expect(result.ack.status).toBe(200);
		expect(result.ack.body).toEqual({ accepted: true });
		expect(result.afterAck).toEqual({ occupied: 0, desiredRunning: 0 });
		expect(result.terminalState).toBe("stopped");
		expect(result.stoppedAtRecorded).toBe(true);
		expect(result.generationRetained).toBe(true);
		expect(result.oldSession).toEqual({ desired_state: "stopped", actual_state: "stopped" });
		expect(result.secondAccepted).toBe(true);
		expect(result.safe).toBe(true);
	});

	it("TDD-US1-DEC002 U200: a retired credential cannot close a different generation and remains usable for its matching receipt", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_terminal_wrong_generation");
		expect(result.wrongReceipt.status).toBe(401);
		expect(result.wrongReceipt.noStore).toBe(true);
		expect(result.afterWrong).toEqual({ occupied: 1, desiredRunning: 0 });
		expect(result.ack.status).toBe(200);
		expect(result.afterAck.occupied).toBe(0);
		expect(result.generationRetained).toBe(true);
		expect(result.secondAccepted).toBe(true);
	});

	it("TDD-US1-DEC002 U201: retired terminal authority cannot fetch assignments or renew and cannot mutate admission state", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_terminal_ack");
		expect(result.heartbeatStatus).toBe(401);
		expect(result.heartbeatNoStore).toBe(true);
		expect(result.heartbeatExposesJobs).toBe(false);
		expect(result.deniedHeartbeatUnchanged).toBe(true);
		expect(result.ack.status).toBe(200);
		expect(result.ack.body).toEqual({ accepted: true });
		expect(result.safe).toBe(true);
	});

	it("TDD-US1-DEC002 U184: replaying a terminal receipt cannot stop or mutate a newer same-session generation", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_terminal_replay");
		expect(result.heartbeatStatus).toBe(401);
		expect(result.ack.status).toBe(200);
		expect(result.secondAccepted).toBe(true);
		expect(result.replayed.status).toBe(200);
		expect(result.replayed.body).toEqual({ accepted: true });
		expect(result.replayPreservedNewAttempt).toBe(true);
		expect(result.afterReplay).toEqual({ occupied: 1, desiredRunning: 1 });
	});

	it("TDD-US1-CON003 U203: non-leased legacy uncertainty cannot expire from heartbeat age or the new lease recovery interval", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_no_lease");
		expect(result.nonLeasedLegacy).toBe(true);
		expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.holderUnchanged).toBe(true);
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
		expect(result.writes).toBe(0);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
	});

	it("TDD-US1-DEC001 U199: a supported Free generation recovers exactly at its final issued lease expiry plus 305 seconds", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_lease_recover");
		expect(result.accepted).toBe(true);
		expect(result.leaseStorageAvailable).toBe(true);
		expect(result.terminal.state).toBe("stopped");
		expect(result.terminal.terminal_reason).toBe("lease_recovered");
		expect(result.terminal.recovered_at).not.toBeNull();
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it("TDD-US1-DEC001 U198: the final issued lease deadline plus 305 seconds minus 1ms still occupies the Free slot", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_lease_early");
		expect(result.leaseStorageAvailable).toBe(true);
		expect(result.accepted).toBe(false);
		expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.terminal.state).toBe("uncertain");
		expect(result.terminal.recovered_at).toBeNull();
		expect(result.terminal.stopped_at).toBeNull();
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it.each(["unsupported", "missing_id", "missing_expiry", "undispatched", "paid"])("TDD-US1-DEC001 recovery prerequisite: %s cannot expire from a different policy's recovery deadline", (kind) => {
		const result = flowProbe(`catalogue:workflow:runner_free_pro:occupied_lease_ineligible_${kind}`);
		expect(result.leaseStorageAvailable).toBe(true);
		expect(result.accepted).toBe(false);
		expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.terminal.state).toBe("uncertain");
		expect(result.terminal.recovered_at).toBeNull();
		expect(result.terminal.stopped_at).toBeNull();
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it("TDD-US1-EC002 legacy rollout: an already broadcasting old session cannot disappear from occupancy just because it predates admissions", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_untracked");
		expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.legacyClaim).toEqual({ state: "uncertain", protocol_supports_lease: false, lease_id: null, lease_expires_at: null });
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
		expect(result.writes).toBe(0);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
	});

	it("TDD-US1-EC002 legacy Stop: stale stopped telemetry cannot turn a pending untracked attempt into proven closure", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_stop");
		expect(result.legacyStopApplied).toBe(false);
		expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.legacyClaim).toEqual({ state: "draining", protocol_supports_lease: false, lease_id: null, lease_expires_at: null });
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(0);
		expect(result.writes).toBe(1);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
	});

	it("TDD-US1-CON003 legacy unlink: capture unresolved output and its original terminal credential before rotation", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_unlink");
		expect(result.legacyCredentialRevoked).toBe(true);
		expect(result.legacyHashMatches).toBe(true);
		expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.legacyClaim).toEqual({ state: "draining", protocol_supports_lease: false, lease_id: null, lease_expires_at: null });
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(0);
		expect(result.writes).toBe(0);
		expect(result.safe).toBe(true);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
	});

	it("TDD-US1-CON003 legacy delete: removing an old device cannot erase its generation or terminal credential", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_delete");
		expect(result.legacyDeleted).toBe(true);
		expect(result.legacyDeviceReferenceCleared).toBe(true);
		expect(result.legacyHashMatches).toBe(true);
		expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.legacyClaim).toEqual({ state: "draining", protocol_supports_lease: false, lease_id: null, lease_expires_at: null });
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(0);
		expect(result.writes).toBe(0);
		expect(result.safe).toBe(true);
		expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
	});

	it("TDD-US1-CON002 pending drain restart: the same session cannot revive a dispatched generation before closure", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_restart_draining");
		expect(result.stopApplied).toBe(false);
		expect(result.restartCode).toBe("RUNNER_RECOVERY_REQUIRED");
		expect(result.unchanged).toBe(true);
		expect(result.after.session).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 3 });
		expect(result.after.admission.state).toBe("draining");
		expect(result.after.writes).toBe(2);
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(0);
	});

	it("TDD-US1-DEC001 signed dispatch: commit the supported Free generation and exact 300s deadline before returning its permit", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_lease_issue");
		expect(result.started).toBe(true);
		expect(result.status).toBe(200);
		expect(result.noStore).toBe(true);
		expect(result.verified).toBe(true);
		expect(result.beforeState).toBe("reserved");
		expect(result.storedState).toBe("starting");
		expect(result.dispatched).toBe(true);
		expect(result.leaseStored).toBe(true);
		expect(result.deadlineMatches).toBe(true);
		expect(result.ttl).toBe(300000);
		expect(result.generationRetained).toBe(true);
		expect(result.jobIdentity).toBe(true);
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it("TDD-US1-DEC001 renewal: commit the final issued deadline without allocating a second lease or generation", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_lease_renew");
		expect(result.status).toBe(200);
		expect(result.verified).toBe(true);
		expect(result.sameLease).toBe(true);
		expect(result.sameGeneration).toBe(true);
		expect(result.sameDispatch).toBe(true);
		expect(result.extension).toBe(100000);
		expect(result.deadlineMatches).toBe(true);
		expect(result.freshNonce).toBe(true);
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it("TDD-US1-DEC001 active ACK: only a matching dispatched generation changes its applied running state", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_lease_active_ack");
		expect(result.status).toBe(200);
		expect(result.state).toBe("active");
		expect(result.started).toBe(true);
		expect(result.observed).toBe(true);
		expect(result.dispatchRetained).toBe(true);
		expect(result.generationRetained).toBe(true);
		expect(result.actual).toEqual({ actual_state: "running", desired_state: "running", configuration_revision: 2 });
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it("TDD-US1-DEC001 closed ACK: release only the exact dispatched generation after explicit all-output closure", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_lease_stop_ack");
		expect(result.status).toBe(200);
		expect(result.state).toBe("stopped");
		expect(result.closed).toBe(true);
		expect(result.reason).toBe("all_outputs_closed");
		expect(result.generationRetained).toBe(true);
		expect(result.deadlineRetained).toBe(true);
		expect(result.noOutputCredentials).toBe(true);
		expect(result.actual).toEqual({ actual_state: "stopped", desired_state: "stopped", configuration_revision: 3 });
		expect(result.occupied).toBe(0);
		expect(result.desiredRunning).toBe(0);
	});

	it.each(["admissionId", "sessionId", "executionGeneration", "leaseId", "configurationRevision", "allOutputsClosed", "other_device", "foreign_owner"])("TDD-US1-DEC001 closed ACK rejection: %s cannot mutate the matching live claim", (field) => {
		const result = flowProbe(`catalogue:workflow:runner_free_pro:admission_lease_bad_ack_${field}`);
		expect(result.status).toBe(field === "allOutputsClosed" ? 400 : 200);
		expect(result.unchanged).toBe(true);
		expect(result.after.session).toEqual({ actual_state: "stopped", desired_state: "running", configuration_revision: 2 });
		expect(result.after.admission).toMatchObject({ state: "starting", configuration_revision: 2, started_at: null, stopped_at: null });
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it.each(["before", "at", "after"])("TDD-US1-DEC001 renewal boundary: %s exact expiry cannot revive or release an expired generation", (boundary) => {
		const result = flowProbe(`catalogue:workflow:runner_free_pro:admission_lease_boundary_${boundary}`),
			valid = boundary === "before";
		expect(result.status).toBe(200);
		expect(result.validNext).toBe(valid);
		expect(result.hasOutputCredentials).toBe(valid);
		expect(result.state).toBe(valid ? "starting" : "draining");
		expect(result.deadlineDelta).toBe(valid ? 299999 : 0);
		expect(result.sameGeneration).toBe(true);
		expect(result.sameLease).toBe(true);
		expect(result.closed).toBe(false);
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});

	it("TDD-US1-DEC001 normal terminal replay: an old closed lease cannot stop a newer same-device same-session execution", () => {
		const result = flowProbe("catalogue:workflow:runner_free_pro:admission_lease_normal_replay");
		expect(result.closedStatus).toBe(200);
		expect(result.startedAgain).toBe(true);
		expect(result.nextAttemptPresent).toBe(true);
		expect(result.differentGeneration).toBe(true);
		expect(result.dispatchedStatus).toBe(200);
		expect(result.activeStatus).toBe(200);
		expect(result.replayStatus).toBe(200);
		expect(result.unchanged).toBe(true);
		expect(result.after.session).toEqual({ desired_state: "running", actual_state: "running", configuration_revision: 4 });
		expect(result.after.admission).toMatchObject({ state: "active", configuration_revision: 4, stopped_at: null });
		expect(result.after.old).toMatchObject({ state: "stopped", terminal_reason: "all_outputs_closed" });
		expect(result.occupied).toBe(1);
		expect(result.desiredRunning).toBe(1);
	});
});
