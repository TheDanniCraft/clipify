/** @jest-environment node */
import { flowProbe } from "../../support/mcp/probe";

test.each(["sequential:first", "sequential:last", "concurrent:first", "concurrent:last"])("same-client connections retain independent authority and revoke only the selected grant (%s)", (mode) => {
	expect(flowProbe(`connections:same-client:${mode}`)).toEqual({ independentGrants: 3, activeAfterRevoke: 2, sameClient: true, isolatedCreatorsAndScopes: true, allRefreshed: true, revokedAccessAndRefreshDenied: true, otherConnectionsStillRefresh: true });
});
