/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test("saved destinations are reusable account-wide across computers without re-entering credentials", () => {
	const result = flowProbe("catalogue:workflow:runner_free_pro:destinations_account_reuse");
	expect(result.authenticated).toBe(true);
	expect(result.reused).toMatchObject({ success: true, destinations: [{ id: result.destinationId, credentialConfigured: true }] });
	expect(result.duplicate).toMatchObject({ success: false, code: "INVALID_INPUT" });
	expect(result.edited).toMatchObject({ success: true });
	expect(result.credentialPreserved).toBe(true);
	expect(result.configured).toBe(true);
	expect(result.scheduled).toBe(true);
	expect(result.capturedCredential).toBe(true);
	expect(result.firstView.destinations).toMatchObject([{ id: result.destinationId, name: "Community Twitch" }]);
	expect(result.surviving.destinations).toMatchObject([{ id: result.destinationId, credentialConfigured: true }]);
	expect(result.safe).toBe(true);
});
