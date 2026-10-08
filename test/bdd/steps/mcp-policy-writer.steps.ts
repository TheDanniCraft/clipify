import { createBdd } from "playwright-bdd";
import { test, expect } from "../support/mcp-support";
import { flowProbe, runMcpProbe } from "../../support/mcp/probe";
const { When, Then } = createBdd(test);
When("a {word} resource write races a {word} owner policy update", async ({ mcpWorld }, caller: string, change: string) => {
	mcpWorld.result = caller === "mcp" ? flowProbe("resources:overlay-update:policy-" + change) : runMcpProbe("browser-playlist-delete-probe", ["volume-chat-policy-" + change]);
});
Then("the owner policy change waits for the committed resource write", async ({ mcpWorld }) => {
	const r = mcpWorld.result as any;
	expect(r.policyInterleave).toEqual({ started: true, blocked: true, completed: true });
	if (r.resourceResult) expect(r.resourceResult.overlay.configurationRevision).toBe(2);
	else expect(r.volumeRows.every((row: any) => row.configuration_revision === 2)).toBe(true);
});
