import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, type QueryClient } from "@/db/client";
import { mcpConnectionGrantsTable, mcpGrantCreatorsTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "./authorize-operation";

const claimsSchema = z.object({ sub: z.string().min(1), client_id: z.string().min(1), clipify_grant_id: z.uuid(), clipify_grant_generation: z.number().int().positive(), scope: z.string(), iss: z.string(), aud: z.union([z.string(), z.array(z.string())]), exp: z.number(), iat: z.number().optional() });

/** Accept only claims cryptographically verified by the provider resource wrapper. */
export async function resolveMcpGrant(verifiedClaims: unknown, client: QueryClient = db, now = new Date()): Promise<TrustedCreatorPrincipal> {
	const parsed = claimsSchema.safeParse(verifiedClaims);
	if (!parsed.success) throw new Error("AUTHENTICATION_REQUIRED");
	const claims = parsed.data;
	if (claims.exp * 1000 <= now.getTime()) throw new Error("AUTHENTICATION_REQUIRED");
	const [grant] = await client.select().from(mcpConnectionGrantsTable).where(eq(mcpConnectionGrantsTable.id, claims.clipify_grant_id)).limit(1);
	if (!grant?.active || grant.revokedAt || grant.expiresAt <= now || grant.authUserId !== claims.sub || grant.clientId !== claims.client_id || grant.generation !== claims.clipify_grant_generation || claims.scope.split(" ").some((scope) => !grant.scopes.includes(scope))) throw new Error("AUTHENTICATION_REQUIRED");
	const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
	// Resource/issuer verification belongs to the provider wrapper; the grant must
	// also retain its token's exact resource (no adoption of another service).
	if (!audience.includes(grant.resource) || claims.iss !== grant.issuer) throw new Error("AUTHENTICATION_REQUIRED");
	const creators = await client.select({ creatorId: mcpGrantCreatorsTable.creatorId, agencyOrganizationId: mcpGrantCreatorsTable.agencyOrganizationId, scopes: mcpGrantCreatorsTable.scopes }).from(mcpGrantCreatorsTable).where(eq(mcpGrantCreatorsTable.grantId, grant.id));
	return { kind: "oauth", authUserId: grant.authUserId, authenticatedAt: new Date((claims.iat ?? 0) * 1000), clientId: grant.clientId, grantId: grant.id, generation: grant.generation, tokenExpiresAt: new Date(claims.exp * 1000), resource: grant.resource, issuer: grant.issuer, scopes: claims.scope.split(" "), creators: creators.map((creator) => ({ ...creator, scopes: creator.scopes ?? grant.scopes })) };
}
