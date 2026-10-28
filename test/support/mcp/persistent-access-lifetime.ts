import { mock } from "node:test";

type Tokens = { access_token: string; refresh_token: string };
export async function checkPersistentAccessLifetime(input: { auth: { handler(request: Request): Promise<Response> }; origin: string; clientId: string; tokens: Tokens; resolveGrant(claims: unknown): Promise<unknown> }) {
	const day = 24 * 60 * 60 * 1000;
	const start = Date.now();
	async function refresh(token: string) {
		const response = await input.auth.handler(new Request(`${input.origin}/api/auth/oauth2/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: input.clientId, refresh_token: token, resource: `${input.origin}/mcp` }) }));
		return { status: response.status, tokens: await response.json() };
	}
	mock.timers.enable({ apis: ["Date"], now: start + 29 * day });
	try {
		const first = await refresh(input.tokens.refresh_token);
		mock.timers.tick(2 * day);
		const second = await refresh(first.tokens.refresh_token);
		let authenticatedAfterOriginalDeadline = false;
		if (second.tokens.access_token) {
			const claims = JSON.parse(Buffer.from(second.tokens.access_token.split(".")[1], "base64url").toString());
			authenticatedAfterOriginalDeadline = Boolean(await input.resolveGrant(claims));
		}
		mock.timers.tick(31 * day);
		const expired = await refresh(second.tokens.refresh_token);
		return { firstRefreshStatus: first.status, secondRefreshStatus: second.status, rotated: first.tokens.refresh_token !== input.tokens.refresh_token && second.tokens.refresh_token !== first.tokens.refresh_token, authenticatedAfterOriginalDeadline, idleExpiryStatus: expired.status, idleExpiryError: expired.tokens.error };
	} finally {
		mock.timers.reset();
	}
}
