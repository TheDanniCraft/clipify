/** @jest-environment node */
import { execFileSync } from "node:child_process";
import { providerProbe } from "../../support/mcp/probe";
describe("TDD-US1-028 discovery security", () => {
	test("advertises CIMD and only supported grants/scopes", () => {
		const result = providerProbe("metadata").body;
		expect(result.client_id_metadata_document_supported).toBe(true);
		expect(result.grant_types_supported).toEqual(expect.arrayContaining(["authorization_code", "refresh_token"]));
		expect(result.grant_types_supported).not.toContain("client_credentials");
		expect(result.scopes_supported).toContain("overlay-secret:read");
		expect(result.scopes_supported).not.toContain("runner-credential:read");
	});
	test.each(["https://127.0.0.1/client.json", "https://10.0.0.1/client.json", "https://172.16.0.1/client.json", "https://192.168.0.1/client.json", "https://0.0.0.0/client.json", "https://224.0.0.1/client.json", "https://[fe80::1]/client.json", "https://169.254.169.254/client.json", "https://[::1]/client.json", "https://[fc00::1]/client.json", "https://[::ffff:127.0.0.1]/client.json"])("refuses unsafe resource %s", (url) => {
		const script = `import {fetchClientMetadataResource} from '@better-auth/cimd/node'; try { await fetchClientMetadataResource(new URL(${JSON.stringify(url)})); console.log('allowed') } catch { console.log('rejected') }`;
		expect(execFileSync("bun", ["-e", script], { encoding: "utf8", timeout: 5000 }).trim()).toBe("rejected");
	});
});

// Exercise the installed provider's public URL validator without contacting hosts.
describe("TDD-US1-028 explicit metadata URL syntax catalogue", () => {
	test.each(["http://metadata.example.invalid/client.json", "https://metadata.example.invalid", "https://metadata.example.invalid?client=json", "https://metadata.example.invalid/client.json#fragment", "https://user:password@metadata.example.invalid/client.json", "https://metadata.example.invalid/a/../client.json", "https://metadata.example.invalid/a/%2e%2e/client.json", "not-a-url"])("rejects invalid client identifier %s", (value) => {
		const script = `import {validateClientIdUrl} from '@better-auth/cimd'; console.log(JSON.stringify(validateClientIdUrl(${JSON.stringify(value)})))`;
		const result = JSON.parse(execFileSync("bun", ["-e", script], { encoding: "utf8", timeout: 5000 }).trim());
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
	test("accepts an explicit public HTTPS metadata identifier without fetching", () => {
		const script = "import {validateClientIdUrl} from '@better-auth/cimd'; console.log(JSON.stringify(validateClientIdUrl('https://metadata.example.invalid/client.json')))";
		expect(JSON.parse(execFileSync("bun", ["-e", script], { encoding: "utf8", timeout: 5000 }).trim())).toBeNull();
	});
});

describe("TDD-US1-028 DCR scope validation", () => {
	test.each(["runner-credential:read", "creator:read runner-credential:read", "unknown:write"])("rejects unsupported scope %s", (scope) => {
		const result = providerProbe("register", { redirect_uris: ["https://custom.example.invalid/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], scope });
		expect(result.status).toBe(400);
		expect(result.body.error).toBe("invalid_client_metadata");
		expect(result.body.client_id).toBeUndefined();
	});
	test("registers supported read and offline scopes without issuing an access token", () => {
		const result = providerProbe("register", { redirect_uris: ["https://custom.example.invalid/callback"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], scope: "creator:read offline_access" });
		expect(result.status).toBe(201);
		expect(typeof result.body.client_id).toBe("string");
		expect(result.body.access_token).toBeUndefined();
	});
});
