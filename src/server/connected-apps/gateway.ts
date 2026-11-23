import "server-only";
import { z } from "zod";
import { verifyAccessTokenRequest, requestToResourceInput } from "better-auth/oauth2";
import { resolveBaseUrl } from "@/app/lib/baseUrl";
import { workflowInputSchemas } from "@/server/mcp/workflows/schemas";
import { searchCachedClips } from "@/server/resources/cached-clip-search";
import { withConnectedAppGrant } from "./storage";
import { getTwitchGames } from "@actions/twitch";
import { publicTwitchImageUrl } from "@/server/resources/twitch-image";
import { connectedAppResource, CONNECTED_APP_SCOPE } from "./oauth-policy";
import { ConnectedAppError } from "./grants";
import { resolveConnectedClip } from "./clip-read";
import { readConnectedAppJson, connectedAppFailure } from "./http";
const claimsSchema = z.object({ sub: z.string().min(1), client_id: z.string().min(1), scope: z.literal(CONNECTED_APP_SCOPE), iss: z.string(), aud: z.union([z.string(), z.array(z.string())]), exp: z.number().int().positive(), clipify_application: z.literal(true) });
const clipInput = z.object({ creatorId: z.string().min(1).max(200), reference: z.string().min(1).max(2048) }).strict();
const categorySearchInput = z.object({ creatorId: z.string().min(1).max(200), query: z.string().trim().min(1).max(200), limit: z.number().int().min(1).max(40).default(20) }).strict();
const operationSchema = z.discriminatedUnion("operation", [z.object({ operation: z.literal("search_clips"), input: workflowInputSchemas.search_clips }).strict(), z.object({ operation: z.literal("search_categories"), input: categorySearchInput }).strict(), z.object({ operation: z.enum(["resolve_clip", "get_clip_playback"]), input: clipInput }).strict()]);
export async function handleConnectedAppRequest(request: Request): Promise<Response> {
	try {
		const origin = resolveBaseUrl().origin;
		const resource = connectedAppResource(origin);
		let claims: z.infer<typeof claimsSchema>;
		try {
			if (!/^Bearer \S+$/i.test(request.headers.get("authorization") ?? "")) throw new Error();
			claims = claimsSchema.parse(await verifyAccessTokenRequest(requestToResourceInput(request), { verifyOptions: { issuer: `${origin}/api/auth`, audience: resource }, jwksUrl: `${origin}/api/auth/jwks`, requiredScopes: [CONNECTED_APP_SCOPE] }));
			const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
			if (claims.sub !== claims.client_id || claims.iss !== `${origin}/api/auth` || audience.length !== 1 || audience[0] !== resource || claims.exp * 1000 <= Date.now()) throw new Error();
		} catch {
			throw new ConnectedAppError("AUTHENTICATION_REQUIRED", 401);
		}
		const input = operationSchema.safeParse(await readConnectedAppJson(request));
		if (!input.success) throw new ConnectedAppError("INVALID_INPUT", 400);
		const data = await withConnectedAppGrant({ clientId: claims.client_id, creatorId: input.data.input.creatorId, operation: input.data.operation }, async (grant) => {
			const operation = input.data;
			const result =
				operation.operation === "search_clips"
					? await searchCachedClips(operation.input, `application:${grant.id}`)
					: operation.operation === "search_categories"
						? {
								creatorId: operation.input.creatorId,
								items: (await getTwitchGames(operation.input.query, operation.input.creatorId)).slice(0, operation.input.limit).map((game) => ({
									id: game.id,
									name: game.name,
									artworkUrl: (() => {
										const artworkUrl = publicTwitchImageUrl(game.box_art_url.replace("{width}", "285").replace("{height}", "380"));
										return artworkUrl && !new URL(artworkUrl).port ? artworkUrl : null;
									})(),
								})),
							}
						: await resolveConnectedClip(operation.input.creatorId, operation.input.reference, operation.operation === "get_clip_playback", request.signal);
			if (claims.exp * 1000 <= Date.now()) throw new ConnectedAppError("AUTHENTICATION_REQUIRED", 401);
			return result;
		});
		return Response.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
	} catch (error) {
		if (error instanceof Error && ["INVALID_INPUT", "INVALID_CURSOR", "CONFLICT"].includes(error.message)) return connectedAppFailure(new ConnectedAppError(error.message, error.message === "CONFLICT" ? 409 : 400));
		return connectedAppFailure(error);
	}
}
