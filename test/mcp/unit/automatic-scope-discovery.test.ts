/** @jest-environment node */
import { MCP_SCOPES } from "@/server/mcp/scopes";
test("official SDK discovers supported scopes without a client scope configuration", async () => {
	const { auth } = await import("@modelcontextprotocol/client");
	const origin = "https://clipify.example";
	let redirect: URL | undefined;
	let client: any;
	const metadata = { redirect_uris: ["http://127.0.0.1:4000/callback"], client_name: "Generic URL-only AI", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" };
	const provider = {
		redirectUrl: metadata.redirect_uris[0],
		clientMetadata: metadata,
		clientInformation: () => client,
		saveClientInformation: (value: any) => {
			client = value;
		},
		tokens: () => undefined,
		saveTokens: () => {},
		saveCodeVerifier: () => {},
		codeVerifier: () => "",
		redirectToAuthorization: (url: URL) => {
			redirect = url;
		},
	};
	const supported = [...MCP_SCOPES];
	const fetchFn = jest.fn(async (input: any, init?: RequestInit) => {
		const url = String(input);
		if (url.includes("oauth-protected-resource")) return Response.json({ resource: origin + "/mcp", authorization_servers: [origin + "/api/auth"], scopes_supported: supported });
		if (url.includes(".well-known")) return Response.json({ issuer: origin + "/api/auth", authorization_endpoint: origin + "/api/auth/oauth2/authorize", token_endpoint: origin + "/api/auth/oauth2/token", registration_endpoint: origin + "/api/auth/oauth2/register", response_types_supported: ["code"], grant_types_supported: ["authorization_code", "refresh_token"], code_challenge_methods_supported: ["S256"], scopes_supported: [...MCP_SCOPES, "offline_access"] });
		if (url.endsWith("/register")) {
			expect(new Set(JSON.parse(String(init?.body)).scope.split(" "))).toEqual(new Set([...supported, "offline_access"]));
			return Response.json({ ...metadata, client_id: "registered-client" });
		}
		throw Error("Unexpected discovery request");
	});
	expect(await auth(provider, { serverUrl: new URL(origin + "/mcp"), fetchFn })).toBe("REDIRECT");
	expect(new Set(redirect!.searchParams.get("scope")!.split(" "))).toEqual(new Set([...MCP_SCOPES, "offline_access"]));
	expect(redirect!.searchParams.get("code_challenge_method")).toBe("S256");
	expect(redirect!.searchParams.get("resource")).toBe(origin + "/mcp");
});
