/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

test("URL client identity survives native TLS metadata, real consent, code exchange and authenticated creator read", () => {
	expect(runMcpProbe("cimd-https-probe", ["complete"], 30000)).toEqual({ consentStatus: 200, tokenStatus: 200, readStatus: 200, creatorRead: true, clientBound: true, actorBound: true, active: true, generation: 1, approvedCreators: ["url-creator"], uuidGrant: true });
});
