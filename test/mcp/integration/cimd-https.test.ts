/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";
describe("TDD-CIMD-HTTPS-001 native client metadata transport", () => {
	test.each(["valid", "rebind", "mixed-dns", "redirect-chain", "oversized", "oversized-chunked", "wrong-identity", "wrong-callback", "tls-mismatch", "redirect-open", "non-json-open"])("%s metadata preserves transport and authorization boundaries", (mode) => {
		const result = runMcpProbe("cimd-https-probe", [mode], 25000);
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
});
