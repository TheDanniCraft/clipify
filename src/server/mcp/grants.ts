import "server-only";
import { APIError } from "better-auth/api";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { McpOptions } from "@better-auth/mcp";
import { db } from "@/db/client";
import { mcpConnectionGrantsTable, mcpGrantCreatorsTable } from "@/db/schema";
import { authorizeTrustedCreatorOperation } from "@/auth/authorize-operation";
import type { Permission } from "@/auth/permissions";
import { validateSelectedScopes } from "./scopes";

const consentContext = new AsyncLocalStorage<{ id: string; authUserId: string; scopes: string[] }>();

export const providerGrantOptions: Partial<McpOptions> = {
	postLogin: {
		page: "/auth/mcp/consent",
		shouldRedirect: async () => false,
		consentReferenceId: async ({ user, scopes }) => {
			const selected = consentContext.getStore();
			// A fresh reference makes every new authorization require creator selection.
			// Direct provider consent without the Clipify bridge cannot issue usable tokens.
			if (!selected) return randomUUID();
			if (selected.authUserId !== user.id || scopes.some((scope) => !selected.scopes.includes(scope))) throw new Error("ACCESS_DENIED");
			return selected.id;
		},
	},
	customAccessTokenClaims: async ({ user, referenceId, scopes }) => {
		if (!user || !referenceId) throw new APIError("BAD_REQUEST", { error: "invalid_grant", error_description: "Connection authorization is unavailable" });
		const [grant] = await db.select().from(mcpConnectionGrantsTable).where(eq(mcpConnectionGrantsTable.id, referenceId)).limit(1);
		if (!grant?.active || grant.revokedAt || grant.expiresAt <= new Date() || grant.authUserId !== user.id || scopes.some((scope) => !grant.scopes.includes(scope))) throw new APIError("BAD_REQUEST", { error: "invalid_grant", error_description: "Connection authorization is unavailable" });
		return { clipify_grant_id: grant.id, clipify_grant_generation: grant.generation };
	},
};

type ConsentAuth = {
	handler(request: Request): Promise<Response>;
	api: { getSession(input: { headers: Headers }): Promise<{ user: { id: string }; session: { id: string; createdAt: Date; activeOrganizationId?: string | null } } | null> };
};
export async function approveMcpConsent(input: { auth: ConsentAuth; origin: string; headers: Headers; oauthQuery: string; accept: boolean; scopes: string[]; creators: { creatorId: string; agencyOrganizationId: string | null; scopes?: string[] }[] }): Promise<Response> {
	const deny = (status: number, error: string) => Response.json({ error }, { status });
	if (input.headers.get("origin") !== new URL(input.origin).origin) return deny(403, "access_denied");
	const session = await input.auth.api.getSession({ headers: input.headers });
	if (!session) return deny(401, "login_required");
	const query = new URLSearchParams(input.oauthQuery);
	let scopes: string[];
	try {
		scopes = input.accept ? validateSelectedScopes(input.scopes, (query.get("scope") ?? "").split(" ")) : [];
	} catch {
		return deny(400, "invalid_scope");
	}
	if (input.accept) {
		try {
			function validateCreatorConsentScopes() {
				for (const target of input.creators) {
					const creatorScopes = target.scopes ?? scopes.filter((scope) => scope !== "offline_access");
					// Legacy refresh-only approvals still verify creator access below.
					// Explicit creator consent must select at least one operation scope.
					if (creatorScopes.length || target.scopes !== undefined)
						validateSelectedScopes(
							creatorScopes,
							scopes.filter((scope) => scope !== "offline_access"),
						);
				}
			}
			validateCreatorConsentScopes();
		} catch {
			return deny(400, "invalid_scope");
		}
	}
	function invalidCreatorSelection() {
		return !input.creators.length || input.creators.length > 100 || new Set(input.creators.map((creator) => creator.creatorId)).size !== input.creators.length;
	}
	function consentFailure(error: unknown) {
		return deny(error instanceof Error && error.message === "ACCESS_DENIED" ? 403 : 503, error instanceof Error && error.message === "ACCESS_DENIED" ? "access_denied" : "temporarily_unavailable");
	}
	const clientId = query.get("client_id");
	if (!clientId || !query.has("sig")) return deny(400, "invalid_request");
	let id: string | undefined;
	try {
		if (input.accept) {
			if (invalidCreatorSelection()) return deny(400, "invalid_request");
			id = randomUUID();
			await db.transaction(async (tx) => {
				for (const target of input.creators)
					for (const scope of target.scopes ?? (scopes.some((scope) => scope !== "offline_access") ? scopes.filter((scope) => scope !== "offline_access") : ["creator:read"])) {
						const decision = await authorizeTrustedCreatorOperation({ principal: { kind: "session", authUserId: session.user.id, authenticatedAt: session.session.createdAt, sessionId: session.session.id, organizationId: target.agencyOrganizationId }, creatorId: target.creatorId, permission: (scope === "feedback:create" ? "creator:read" : scope) as Permission, client: tx });
						if (!decision.allowed) throw new Error("ACCESS_DENIED");
					}
				await tx.insert(mcpConnectionGrantsTable).values({ id, authUserId: session.user.id, clientId, resource: `${new URL(input.origin).origin}/mcp`, issuer: `${new URL(input.origin).origin}/api/auth`, scopes, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
				await tx.insert(mcpGrantCreatorsTable).values(input.creators.map((target) => ({ ...target, grantId: id!, scopes: target.scopes ?? scopes.filter((scope) => scope !== "offline_access") })));
			});
		}
		async function forwardProviderConsent(session: NonNullable<Awaited<ReturnType<ConsentAuth["api"]["getSession"]>>>) {
			const request = new Request(`${new URL(input.origin).origin}/api/auth/oauth2/consent`, { method: "POST", headers: input.headers, body: JSON.stringify({ accept: input.accept, ...(input.accept ? { scope: scopes.join(" ") } : {}), oauth_query: input.oauthQuery }) });
			const response = id ? await consentContext.run({ id, authUserId: session.user.id, scopes }, () => input.auth.handler(request)) : await input.auth.handler(request);
			const result = await response
				.clone()
				.json()
				.catch(() => null);
			return { response, result };
		}
		const { response, result } = await forwardProviderConsent(session);
		if (id && response.ok && result?.url && new URL(result.url).searchParams.has("code")) {
			await db.transaction(async (tx) => {
				// Lock all existing grants consistently before replacing consent authority.
				const grants = await tx
					.select()
					.from(mcpConnectionGrantsTable)
					.where(and(eq(mcpConnectionGrantsTable.authUserId, session.user.id), eq(mcpConnectionGrantsTable.clientId, clientId)))
					.orderBy(mcpConnectionGrantsTable.id)
					.for("update");
				for (const grant of grants) if (grant.active && !grant.revokedAt) await tx.update(mcpConnectionGrantsTable).set({ revokedAt: new Date() }).where(eq(mcpConnectionGrantsTable.id, grant.id));
				await tx.update(mcpConnectionGrantsTable).set({ active: true }).where(eq(mcpConnectionGrantsTable.id, id!));
			});
		} else if (id) await db.delete(mcpConnectionGrantsTable).where(eq(mcpConnectionGrantsTable.id, id));
		return response;
	} catch (error) {
		if (id) await db.delete(mcpConnectionGrantsTable).where(eq(mcpConnectionGrantsTable.id, id));
		return consentFailure(error);
	}
}

/** Only accepts claims already cryptographically verified by the provider. */
export { resolveMcpGrant } from "@/auth/mcp-principal";
