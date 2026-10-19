import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { runMcpProbe } from "../../support/mcp/probe";
const { Given, When, Then } = createBdd(test);

Given("a Pro creator selects saved YouTube and Twitch destinations", async ({ mcpWorld }) => {
	test.setTimeout(120000);
	mcpWorld.input = { multistreamVariant: "multistream_delivery" };
});
When("their Runner broadcasts a clip and they request a graceful stop", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: runMcpProbe("flow-probe", [`catalogue:workflow:runner_free_pro:${mcpWorld.input?.multistreamVariant}`], 110000) };
});
Then("both destinations receive the complete clip from one capture and encoder", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	await test.info().attach("multistream-observations", { body: JSON.stringify(result), contentType: "application/json" });
	expect(result.authenticated).toBe(true);
	expect(result.sourcePrefixPreserved).toBe(true);
	expect(result.configurationAccepted).toBe(true);
	expect(result.admitted).toBe(true);
	expect(result.started).toBe(true);
	expect(result.stopAccepted).toBe(true);
	expect(result.captures).toBe(1);
	expect(result.encoders).toBe(1);
	expect(result.destinations).toHaveLength(2);
	expect(result.providerTransportReroutes).toBe(2);
	for (const destination of result.destinations) {
		expect(destination.frames).toBeGreaterThan(1);
		expect(destination.green).toBe(true);
		expect(destination.audio).toBe(true);
	}
	expect(result.markerReleased).toBe(true);
	expect(result.clipCompleted).toBe(true);
	expect(result.nextClipStarted).toBe(false);
	expect(result.terminalObserved).toBe(true);
	expect(result.allProcessesClosed).toBe(true);
});

Given("a Pro creator starts independent broadcasts on two Runner devices", async ({ mcpWorld }) => {
	test.setTimeout(120000);
	mcpWorld.input = { multistreamVariant: "multistream_independent_delivery" };
});
When("both devices play their clips and receive a graceful stop", async ({ mcpWorld }) => {
	mcpWorld.result = { status: 200, body: runMcpProbe("flow-probe", [`catalogue:workflow:runner_free_pro:${mcpWorld.input?.multistreamVariant}`], 110000) };
});
Then("both independent broadcasts finish their clips and close their own outputs", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	await test.info().attach("multistream-observations", { body: JSON.stringify(result), contentType: "application/json" });
	expect(result.authenticated).toBe(true);
	expect(result.bothRan).toBe(true);
	expect(result.results).toHaveLength(2);
	for (const broadcast of result.results) {
		expect(broadcast.configurationAccepted).toBe(true);
		expect(broadcast.admitted).toBe(true);
		expect(broadcast.started).toBe(true);
		expect(broadcast.captures).toBe(1);
		expect(broadcast.encoders).toBe(1);
		expect(broadcast.destinations).toHaveLength(1);
		expect(broadcast.destinations[0]).toMatchObject({ green: true, audio: true });
		expect(broadcast.destinations[0].frames).toBeGreaterThan(1);
		expect(broadcast.clipCompleted).toBe(true);
		expect(broadcast.nextClipStarted).toBe(false);
		expect(broadcast.terminalObserved).toBe(true);
		expect(broadcast.allProcessesClosed).toBe(true);
	}
});

Given("a Pro creator selects a saved {string} destination", async ({ mcpWorld }, provider: string) => {
	test.setTimeout(120000);
	mcpWorld.input = { multistreamVariant: `multistream_media_${provider}` };
});
Then("the selected provider receives the complete clip with audio", async ({ mcpWorld }) => {
	const result = mcpWorld.result?.body;
	await test.info().attach("multistream-observations", { body: JSON.stringify(result), contentType: "application/json" });
	expect(result.authenticated).toBe(true);
	expect(result.configurationAccepted).toBe(true);
	expect(result.admitted).toBe(true);
	expect(result.started).toBe(true);
	expect(result.stopAccepted).toBe(true);
	expect(result.captures).toBe(1);
	expect(result.encoders).toBe(1);
	expect(result.destinations).toHaveLength(1);
	expect(result.providerTransportReroutes).toBe(mcpWorld.input?.multistreamVariant === "multistream_media_custom" ? 0 : 1);
	expect(result.destinations[0].frames).toBeGreaterThan(1);
	expect(result.destinations[0]).toMatchObject({ green: true, audio: true });
	expect(result.clipCompleted).toBe(true);
	expect(result.nextClipStarted).toBe(false);
	expect(result.terminalObserved).toBe(true);
	expect(result.allProcessesClosed).toBe(true);
});
