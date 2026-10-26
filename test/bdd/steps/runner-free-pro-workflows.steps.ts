import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);
Given("an authenticated Free Runner creator", async ({ mcpWorld }) => {
	mcpWorld.input = { access: "free" };
});
When("they register two Runner devices through MCP", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:runner_free_pro:register_${mcpWorld.input?.access ?? "free"}`) };
});
Then("both Runner devices remain registered without a purchase", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.count).toBe(2);
	expect(result.first.result?.isError).not.toBe(true);
	expect(result.second.result?.isError).not.toBe(true);
	expect(result.safe).toBe(true);
	expect(result.setup.result?.isError).not.toBe(true);
	expect(result.setup.result?.structuredContent).toMatchObject({ platform: "linux", installationRequired: true, enrollmentRequired: true });
});

Given("a Runner creator with {string} access", async ({ mcpWorld }, access: string) => {
	if (!["free", "pro", "legacy", "agency", "trial"].includes(access)) throw new Error("Unknown Runner fixture access");
	mcpWorld.input = { access };
});

Given("an operator without Runner control permission", async ({ mcpWorld }) => {
	mcpWorld.input = { access: "read-only" };
});
When("they start edit or stop the runner", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:denied_operations") };
});
Then("the operation is rejected without changing the broadcast", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.outcomes).toHaveLength(3);
	for (const [index, outcome] of result.outcomes.entries()) {
		expect(outcome.error).toEqual({ code: -32000, message: `access token is missing required scope: ${index === 1 ? "runner:update" : "runner:control"}` });
	}
	expect(result.unchanged).toBe(true);
	expect(result.writes).toBe(0);
	expect(result.safe).toBe(true);
});

Given("two supported devices belong to one Free Runner creator", async ({ mcpWorld }) => {
	mcpWorld.input = { access: "free" };
});
When("dashboard and MCP request a start concurrently", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_race") };
});
Then("one start is accepted and the other explains the Free owner limit", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.accepted).toBe(1);
	expect(result.loserCodes).toEqual(["RUNNER_CONCURRENCY_LIMIT"]);
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
	expect(result.safe).toBe(true);
});

Given("a Free Runner creator with an active clip broadcast", async ({ mcpWorld }) => {
	mcpWorld.input = { access: "free", active: "clip" };
});
When("they start live fallback on another Runner device", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_clip_fallback") };
});
Then("the owner limit is explained and the active clip broadcast is unchanged", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
	expect(result.message).toContain("one active broadcast");
	expect(result.holderUnchanged).toBe(true);
	expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
	expect(result.writes).toBe(0);
	expect(result.safe).toBe(true);
});

Given("a Free Runner creator already broadcasting in {string}", async ({ mcpWorld }, phase: string) => {
	mcpWorld.input = { phase };
});
When("a second Runner device requests a start", async ({ mcpWorld }) => {
	const modes: Record<string, string> = { "Clip playback": "clip", "Live fallback forwarding live input": "fallback_forwarding", "Live fallback playing clips": "fallback_clips", "Live fallback showing standby": "fallback_standby" };
	const variant = modes[String(mcpWorld.input?.phase)];
	expect(variant).toBeTruthy();
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:runner_free_pro:occupied_${variant}`) };
});
Then("the existing broadcast remains and the owner limit is explained", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
	expect(result.message).toContain("one active broadcast");
	expect(result.holderUnchanged).toBe(true);
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
	expect(result.writes).toBe(0);
	expect(result.safe).toBe(true);
	expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
});

Given("a Pro operator managing a Free creator with an occupied broadcast slot", async ({ mcpWorld }) => {
	mcpWorld.input = { operator: "pro", owner: "free" };
});
When("the Pro operator starts another broadcast for that creator", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_policy-agency-pro-operator") };
});
Then("the Free creator's limit applies without changing the broadcast", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.operatorPlan).toBe("pro");
	expect(result.ownerPlan).toBe("free");
	expect(result.code).toBe("RUNNER_CONCURRENCY_LIMIT");
	expect(result.message).toContain("one active broadcast");
	expect(result.holderUnchanged).toBe(true);
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
	expect(result.writes).toBe(0);
	expect(result.safe).toBe(true);
});

Given("a Free creator whose first device lacks required destination credentials", async ({ mcpWorld }) => {
	mcpWorld.input = { invalidCredentials: true };
});
When("that start fails and they start on another configured device", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:failed_before_output") };
});
Then("the second device is accepted without an occupied slot from the failed start", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.failureCode).toBe("INVALID_INPUT");
	expect(result.afterFailure).toEqual({ occupied: 0, desiredRunning: 0 });
	expect(result.retryAccepted).toBe(true);
	expect(result.retryApplied).toBe(false);
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
	expect(result.onlyRetryReserved).toBe(true);
	expect(result.safe).toBe(true);
});

Given("a read-only Runner operator requesting {string}", async ({ mcpWorld }, operation: string) => {
	mcpWorld.input = { operation };
});
When("they submit that protected Runner command", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:runner_free_pro:denied_${mcpWorld.input?.operation}`) };
});
Then("the protected command is denied without configuration or successful audit writes", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	const scope = mcpWorld.input?.operation === "destination" ? "runner:update" : "runner:control";
	expect(result.selected.error).toEqual({ code: -32000, message: `access token is missing required scope: ${scope}` });
	expect(result.unchanged).toBe(true);
	expect(result.writes).toBe(0);
	expect(result.safe).toBe(true);
});

Given("a Free creator whose broadcasting Runner went offline without confirming shutdown", async ({ mcpWorld }) => {
	mcpWorld.input = { offlineUnconfirmed: true };
});
When("they request a start from another online Runner", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_offline") };
});
Then("the occupied slot is retained and reconnect guidance is shown", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.offlineHealth).toBe(true);
	expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
	expect(result.message).toContain("Reconnect");
	expect(result.occupied).toBe(1);
	expect(result.holderUnchanged).toBe(true);
	expect(result.safe).toBe(true);
});

Given("an offline active device is unlinked or deleted", async ({ mcpWorld }) => {
	mcpWorld.input = { deletedDevice: true };
});
When("its old token attempts heartbeat then submits its matching closed-output terminal ACK", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_terminal_ack") };
});
Then("heartbeat and renewal are denied, terminal-only ACK succeeds and frees only its generation", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.heartbeatStatus).toBe(401);
	expect(result.endpointAvailable).toBe(true);
	expect(result.deniedHeartbeatUnchanged).toBe(true);
	expect(result.heartbeatNoStore).toBe(true);
	expect(result.heartbeatExposesJobs).toBe(false);
	expect(result.ack.status).toBe(200);
	expect(result.ack.noStore).toBe(true);
	expect(result.ack.body).toEqual({ accepted: true });
	expect(result.afterAck.occupied).toBe(0);
	expect(result.generationRetained).toBe(true);
	expect(result.secondAccepted).toBe(true);
	expect(result.safe).toBe(true);
});

When("its old token submits a receipt for a different generation before its matching receipt", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_terminal_wrong_generation") };
});
Then("the unmatched receipt keeps occupancy and only the matching receipt reconciles", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.wrongReceipt.status).toBe(401);
	expect(result.afterWrong.occupied).toBe(1);
	expect(result.ack.status).toBe(200);
	expect(result.afterAck.occupied).toBe(0);
	expect(result.safe).toBe(true);
});

When("its receipt is replayed after a replacement generation starts for the same session", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_terminal_replay") };
});
Then("only the old generation is reconciled and the new attempt is unchanged", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.ack.status).toBe(200);
	expect(result.replayed.status).toBe(200);
	expect(result.replayPreservedNewAttempt).toBe(true);
	expect(result.afterReplay).toEqual({ occupied: 1, desiredRunning: 1 });
	expect(result.safe).toBe(true);
});

Given("a Free broadcast with a persisted supported execution lease", async ({ mcpWorld }) => {
	mcpWorld.input = { supportedFreeLease: true };
});
When("another Runner requests Start exactly at final lease expiry plus 305 seconds", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_lease_recover") };
});
Then("its old generation is recovered and exactly one replacement is admitted", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.accepted).toBe(true);
	expect(result.leaseStorageAvailable).toBe(true);
	expect(result.terminal.state).toBe("stopped");
	expect(result.terminal.terminal_reason).toBe("lease_recovered");
	expect(result.terminal.recovered_at).not.toBeNull();
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
});

When("another Runner requests Start one millisecond before final lease expiry plus 305 seconds", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_lease_early") };
});
Then("the old generation retains the slot and recovery guidance is returned", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.leaseStorageAvailable).toBe(true);
	expect(result.accepted).toBe(false);
	expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
	expect(result.terminal.state).toBe("uncertain");
	expect(result.terminal.recovered_at).toBeNull();
	expect(result.terminal.stopped_at).toBeNull();
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
});

Given("an offline old Runner broadcasting from before admission records existed", async ({ mcpWorld }) => {
	mcpWorld.input = { legacyUntracked: true };
});
When("another device requests Start during the legacy rollout", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_untracked") };
});
Then("the unleased legacy claim is retained and the replacement is rejected with guidance", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
	expect(result.legacyClaim).toEqual({ state: "uncertain", protocol_supports_lease: false, lease_id: null, lease_expires_at: null });
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
	expect(result.writes).toBe(0);
	expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
});

Given("a legacy pending Start with old stopped telemetry and no admission record", async ({ mcpWorld }) => {
	mcpWorld.input = { legacyPending: true };
});
When("its owner requests Stop then tries Start on another device", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_stop") };
});
Then("its uncertain generation drains without releasing the slot or applying the replacement", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.legacyStopApplied).toBe(false);
	expect(result.code).toBe("RUNNER_RECOVERY_REQUIRED");
	expect(result.legacyClaim).toEqual({ state: "draining", protocol_supports_lease: false, lease_id: null, lease_expires_at: null });
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(0);
	expect(result.writes).toBe(1);
	expect(result.rejected).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 1 });
});

Given("an offline legacy broadcast with no admission record", async ({ mcpWorld }) => {
	mcpWorld.input = { legacyWithoutAdmission: true };
});
When("the owner unlinks its device then requests Start elsewhere", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_unlink") };
});
Then("its unleased draining tombstone retains the former terminal credential and blocks replacement", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
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

When("the owner deletes its device then requests Start elsewhere", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:occupied_legacy_delete") };
});
Then("the deleted device leaves an unleased draining tombstone and its original terminal credential", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
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

Given("a dispatched Runner attempt whose owner has requested Stop", async ({ mcpWorld }) => {
	mcpWorld.input = { pendingDrain: true };
});
When("the owner requests Start for that same session before shutdown acknowledgment", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_restart_draining") };
});
Then("the draining generation and stopped intent remain unchanged until closure", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.stopApplied).toBe(false);
	expect(result.restartCode).toBe("RUNNER_RECOVERY_REQUIRED");
	expect(result.unchanged).toBe(true);
	expect(result.after.session).toEqual({ desired_state: "stopped", actual_state: "stopped", configuration_revision: 3 });
	expect(result.after.admission.state).toBe("draining");
	expect(result.after.writes).toBe(2);
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(0);
});

Given("a Free owner with one accepted reserved broadcast and a supported lease client", async ({ mcpWorld }) => {
	mcpWorld.input = { reservedFreeLease: true };
});
When("the device requests its first authenticated signed lease assignment", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_lease_issue") };
});
Then("the committed generation and 300 second deadline match its valid signed permit", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
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

When("its device renews with a fresh nonce before the current lease expires", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_lease_renew") };
});
Then("its renewed signed permit matches the stored deadline and original generation", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
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

When("the assigned device acknowledges its dispatched lease generation as active", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_lease_active_ack") };
});
Then("only that admitted generation and session become applied running", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
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

When("its assigned device confirms all outputs closed for the exact lease generation", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_lease_stop_ack") };
});
Then("that generation is terminal and no output credentials or occupied slot remain", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
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

When("a closed-output report has invalid {string} authority", async ({ mcpWorld }, field: string) => {
	mcpWorld.result = { status: 200, body: flowProbe(`catalogue:workflow:runner_free_pro:admission_lease_bad_ack_${field}`) };
});
Then("the valid broadcast keeps its occupied slot and original state", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.unchanged).toBe(true);
	expect(result.occupied).toBe(1);
	expect(result.desiredRunning).toBe(1);
});

When("its device requests renewal {string} the exact lease expiry", async ({ mcpWorld }, boundary: string) => {
	mcpWorld.result = { status: 200, body: { ...flowProbe(`catalogue:workflow:runner_free_pro:admission_lease_boundary_${boundary}`), boundary } };
});
Then("expired output cannot renew or free occupancy and a valid lease alone permits output", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body,
		valid = result.boundary === "before";
	expect(result.validNext).toBe(valid);
	expect(result.hasOutputCredentials).toBe(valid);
	expect(result.occupied).toBe(1);
	expect(result.closed).toBe(false);
});

When("the same device replays a closed generation report after a new generation is active", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_lease_normal_replay") };
});
Then("the new broadcast remains running with its current generation and occupied slot", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.startedAgain).toBe(true);
	expect(result.differentGeneration).toBe(true);
	expect(result.replayStatus).toBe(200);
	expect(result.unchanged).toBe(true);
	expect(result.after.session.actual_state).toBe("running");
	expect(result.after.admission.state).toBe("active");
	expect(result.occupied).toBe(1);
});

When("they request Stop now for their active broadcast generation", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_emergency_stop") };
});
Then("immediate stop intent is accepted without claiming the output is already closed", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.accepted).toBe(true);
	expect(result.applied).toBe(false);
	expect(result.admissionState).toBe("draining");
	expect(result.stopMode).toBe("immediate");
	expect(result.delivered).toEqual({ status: 200, stopMode: "immediate", command: "stop_now", matchingAdmission: true, matchingGeneration: true, commandIdPresent: true, noOutputCredentials: true });
	expect(result.session).toEqual({ desired_state: "stopped", actual_state: "running", configuration_revision: 3 });
	expect(result.closed).toBe(false);
	expect(result.generationRetained).toBe(true);
	expect(result.occupied).toBe(1);
});

When("a newer generation starts between the heartbeat session snapshot and command lookup", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_emergency_snapshot_race") };
});
Then("no stop command targets that replacement generation and it remains running", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.heartbeatStatus).toBe(200);
	expect(result.misdirectedStop).toBe(false);
	expect(result.current).toEqual({ desired_state: "running", actual_state: "running", configuration_revision: 4 });
	expect(result.occupied).toBe(1);
});

When("the assigned device requests a credential-bound lease for its source", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_lease_key_binding") };
});
Then("the verified lease binds the actual destination credential digest and source without exposing the key", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.status).toBe(200);
	expect(result.verified).toBe(true);
	expect(result.actualTargetBound).toBe(true);
	expect(result.sourceBound).toBe(true);
	expect(result.secretExcluded).toBe(true);
	expect(result.occupied).toBe(1);
});

When("the device retries its closed-output receipt and a wrong-generation receipt", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:admission_lease_receipt_confirmation") };
});
Then("only the exact terminal generation is explicitly confirmed without replay mutation", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.status).toBe(200);
	expect(result.accepted).toEqual(result.expected);
	expect(result.replayed).toEqual(result.expected);
	expect(result.replayStatus).toBe(200);
	expect(result.wrongStatus).toBe(200);
	expect(result.wrong).toEqual([]);
	expect(result.unchanged).toBe(true);
	expect(result.occupied).toBe(0);
});

Given("an authenticated read-only Runner schedule operator", async ({ mcpWorld }) => {
	mcpWorld.input = { access: "read-only" };
});
When("they submit a schedule edit through the authenticated Server Action", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:schedule_permission_action") };
});
Then("schedule editing is denied without changing Runner state or recording a successful mutation", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.available).toBe(true);
	expect(result.result).toMatchObject({ success: false, code: "ACCESS_DENIED" });
	expect(result.unchanged).toBe(true);
	expect(result.successAudits).toBe(0);
});

Given("an operator without the required standby editing permission", async ({ mcpWorld }) => {
	mcpWorld.input = { access: "read-only" };
});
When("they request edit standby", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: flowProbe("catalogue:workflow:runner_free_pro:destinations_standby_permission") };
});
Then("standby appearance remains unchanged after the authenticated denial", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	expect(result.authenticated).toBe(true);
	expect(result.initialized).toBe(true);
	expect(result.action).toBe("saveRunnerBrandingProfile");
	expect(result.membershipRemaining).toBe(0);
	expect(result.denied).toMatchObject({ success: false, code: "ACCESS_DENIED" });
	expect(result.unchanged).toBe(true);
	expect(result.profileCount).toBe(1);
});
