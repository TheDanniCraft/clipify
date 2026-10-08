import { SignJWT, importJWK } from "jose";
import { symmetricDecrypt } from "better-auth/crypto";
import type { Pool } from "pg";
export async function runTokenCatalogue(pool: Pool, auth: { handler: (request: Request) => Promise<Response> }, payload: Record<string, unknown>, accessToken: string, origin: string, bindingOnly = false) {
	const { POST } = await import("@/app/mcp/route");
	const key = (await pool.query("SELECT id,alg,private_key FROM auth.jwks ORDER BY created_at DESC LIMIT 1")).rows[0];
	if (!key) throw new Error("Provider did not create isolated signing key");
	const plaintext = await symmetricDecrypt({ key: "isolated-mcp-provider-secret-32chars", data: JSON.parse(key.private_key) });
	const algorithm = key.alg ?? "EdDSA";
	const privateKey = await importJWK(JSON.parse(plaintext), algorithm);
	const claimCases: Record<string, Record<string, unknown>> = bindingOnly
		? {
				"wrong-subject": { sub: "other-subject" },
				"wrong-client": { client_id: "other-client", azp: "other-client" },
				"wrong-generation": { clipify_grant_generation: 999 },
				"unknown-grant": { clipify_grant_id: "00000000-0000-4000-8000-000000000000" },
				"wrong-audience": { aud: "https://foreign.example.invalid/mcp" },
			}
		: {
				"missing-sub": { sub: undefined },
				"object-sub": { sub: {} },
				"missing-client": { client_id: undefined, azp: undefined },
				"object-client": { client_id: {}, azp: {} },
				"wrong-client": { client_id: "foreign-client", azp: "foreign-client" },
				"invalid-grant": { clipify_grant_id: "invalid" },
				"unknown-grant": { clipify_grant_id: "00000000-0000-4000-8000-000000000000" },
				"zero-generation": { clipify_grant_generation: 0 },
				"string-generation": { clipify_grant_generation: "1" },
				"array-scope": { scope: [] },
				"missing-scope": { scope: undefined },
				"string-expiry": { exp: "future" },
				"null-expiry": { exp: null },
				"missing-expiry": { exp: undefined },
				"object-issued-at": { iat: {} },
				"numeric-audience": { aud: 1 },
				"missing-audience": { aud: undefined },
				"object-issuer": { iss: {} },
				"missing-issuer": { iss: undefined },
				"future-not-before": { nbf: Math.floor(Date.now() / 1000) + 3600 },
				"expiry-boundary": { exp: Math.floor(Date.now() / 1000) },
			};
	const headers: Record<string, string> = {
		"empty-header": "",
		"basic-header": `Basic ${accessToken}`,
		"empty-bearer": "Bearer",
		"extra-token": `Bearer ${accessToken} extra`,
		"multiple-token": `Bearer ${accessToken},Bearer ${accessToken}`,
		"malformed-compact": "Bearer invalid.parts",
		valid: `Bearer ${accessToken}`,
		"lowercase-bearer": `bearer ${accessToken}`,
	};
	async function buildTokenHeaders() {
		if (bindingOnly) {
			for (const name of Object.keys(headers)) if (name !== "valid") delete headers[name];
			headers["revoked-grant"] = `Bearer ${accessToken}`;
			headers["expired-grant"] = `Bearer ${accessToken}`;
			headers["restored-grant"] = `Bearer ${accessToken}`;
		}
		for (const [name, patch] of Object.entries(claimCases)) {
			const claims = { ...payload, ...patch };
			const token = await new SignJWT(claims).setProtectedHeader({ alg: algorithm, kid: key.id }).sign(privateKey);
			headers[name] = `Bearer ${token}`;
		}
	}
	await buildTokenHeaders();
	const originalFetch = globalThis.fetch;
	const outcomes: { name: string; status: number; challenge: boolean; read: boolean }[] = [];
	try {
		globalThis.fetch = (input, init) => {
			const request = input instanceof Request ? input : new Request(input, init);
			if (new URL(request.url).origin !== origin) throw new Error("External fixture fetch forbidden");
			return auth.handler(request);
		};
		for (const [name, authorization] of Object.entries(headers)) {
			if (bindingOnly && name === "revoked-grant") await pool.query("UPDATE mcp_connection_grants SET revoked_at=now() WHERE id=$1", [payload.clipify_grant_id]);
			if (bindingOnly && name === "expired-grant") await pool.query("UPDATE mcp_connection_grants SET revoked_at=NULL, expires_at=now()-interval '1 second' WHERE id=$1", [payload.clipify_grant_id]);
			if (bindingOnly && name === "restored-grant") await pool.query("UPDATE mcp_connection_grants SET expires_at=now()+interval '30 days' WHERE id=$1", [payload.clipify_grant_id]);
			const response = await POST(new Request(origin + "/mcp", { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18", authorization }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_creators", arguments: {} } }) }));
			const body = await response.text();
			outcomes.push({ name, status: response.status, challenge: /^(Bearer|DPoP)\s/i.test(response.headers.get("WWW-Authenticate") ?? ""), read: response.status === 200 && body.includes("fixture-creator") });
		}
		const { resolveMcpGrant } = await import("@/auth/mcp-principal");
		const { db } = await import("@/db/client");
		const verified = { ...payload, client_id: payload.azp ?? payload.client_id };
		const deadline = Number(payload.exp) * 1000;
		const clockChecks: Record<string, boolean> = {};
		for (const [name, delta] of [
			["before", -1],
			["at", 0],
			["after", 1],
		] as const) {
			try {
				await resolveMcpGrant(verified, db, new Date(deadline + delta));
				clockChecks[name] = true;
			} catch {
				clockChecks[name] = false;
			}
		}
		return { outcomes, clockChecks };
	} finally {
		globalThis.fetch = originalFetch;
	}
}
