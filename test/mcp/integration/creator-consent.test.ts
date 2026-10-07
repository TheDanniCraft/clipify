/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";
test("native OAuth preserves a creator's Read consent under a token with write scopes", () => {
	const result = flowProbe("resources:overlay-update:creator-read-only");
	expect(result.resourceResult).toMatchObject({ error: { code: "ACCESS_DENIED" } });
	expect(result.persistedOverlay.configuration_revision).toBe(1);
});
