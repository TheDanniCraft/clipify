import { auth, type OAuthClientProvider, type StoredOAuthClientInformation } from "@modelcontextprotocol/client";
import { MCP_SCOPES } from "@/server/mcp/scopes";
/** Real provider discovery and DCR: no scope option in client setup or login. */
export async function discoverAutomaticConsent(origin: string, cookie: string) {
	let client: StoredOAuthClientInformation | undefined;
	let verifier = "";
	let authorization: URL | undefined;
	const redirectUrl = "http://127.0.0.1:49998/callback";
	const provider: OAuthClientProvider = {
		redirectUrl,
		clientMetadata: { client_name: "URL-only official SDK", redirect_uris: [redirectUrl], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" },
		clientInformation: () => client,
		saveClientInformation: (value) => {
			client = value;
		},
		tokens: () => undefined,
		saveTokens: () => {},
		codeVerifier: () => verifier,
		saveCodeVerifier: (value) => {
			verifier = value;
		},
		redirectToAuthorization: (url) => {
			authorization = url;
		},
	};
	await auth(provider, { serverUrl: new URL(origin + "/mcp") });
	if (!authorization) throw Error("SDK did not generate authorization");
	const requested = new Set(authorization.searchParams.get("scope")?.split(" "));
	const supported = [...MCP_SCOPES, "offline_access"];
	if (!supported.every((scope) => requested.has(scope))) throw Error("URL-only discovery narrowed supported scopes");
	const response = await fetch(authorization, { headers: { Cookie: cookie, Origin: origin }, redirect: "manual" });
	const location = response.headers.get("location") ?? (await response.json().catch(() => null))?.url;
	if (!location) throw Error("Automatic authorization did not reach consent");
	const consent = new URL(location, origin);
	const signed = new Set(consent.searchParams.get("scope")?.split(" "));
	return consent.pathname === "/auth/mcp/consent" && !!consent.searchParams.get("sig") && supported.every((scope) => signed.has(scope));
}
