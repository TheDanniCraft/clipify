import { createBdd } from "playwright-bdd";
import { expect } from "@playwright/test";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd();
let mode: string;
let result: ReturnType<typeof runMcpProbe>;
Given("the isolated metadata HTTPS service has {string} behavior", async ({}, value: string) => {
	mode = value;
});
When("the actual provider authorizes using that client metadata document", async () => {
	result = runMcpProbe("cimd-https-probe", [mode], 25000);
});
Then("the URL client completes real consent and reads only its approved creator", async () => {
	expect(result).toEqual({ consentStatus: 200, tokenStatus: 200, readStatus: 200, creatorRead: true, clientBound: true, actorBound: true, active: true, generation: 1, approvedCreators: ["url-creator"], uuidGrant: true });
});
Then("only valid metadata reaches consent and transport connections are closed without leaking credentials", async () => {
	expect(result.closed).toBe(true);
	expect(result.authorizationHeader).toBe(false);
	expect(result.dnsCalls).toBe(1);
	const valid = mode === "valid" || mode === "rebind";
	if (valid) {
		expect(result.loginPath).toBe("/auth/mcp/consent");
		expect(result.error).toBeNull();
		expect(result.clients).toBe(1);
	} else {
		expect(result.loginPath).not.toBe("/auth/mcp/consent");
		expect(typeof result.error).toBe("string");
		if (mode !== "wrong-callback") expect(result.clients).toBe(0);
	}
	expect(result.requests).toBe(mode === "mixed-dns" || mode === "tls-mismatch" ? 0 : 1);
	if (mode !== "mixed-dns") {
		expect(result.pinned).toBe(true);
		expect(result.lookupForms).toBe(2);
	}
	if (result.requests) {
		expect(result.headerHost).toBe("metadata.example.invalid");
		expect(result.serverName).toBe("metadata.example.invalid");
	}
});
