/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
it("real Twitch participant callbacks avoid creator provisioning and email, then allow deliberate promotion", () => {
	expect(runMcpProbe("event-participant-auth-probe", [], 60000)).toMatchObject({ viewerOnly: true, noCreatorEmails: true, returningViewer: true, intentionalPromotion: true, sameIdentity: true });
}, 65000);
