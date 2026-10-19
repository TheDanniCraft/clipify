import { z } from "zod";

export type StreamingProvider = "twitch" | "youtube";
export const streamingProviderSchema = z.enum(["twitch", "youtube"]);
export function providerScopes(provider: StreamingProvider): string[] {
	return provider === "twitch" ? ["channel:read:stream_key", "channel:manage:broadcast"] : ["https://www.googleapis.com/auth/youtube.force-ssl"];
}
export function providerAuthorizationUrl(provider: StreamingProvider, input: { clientId: string; redirectUri: string; state: string }) {
	const url = new URL(provider === "twitch" ? "https://id.twitch.tv/oauth2/authorize" : "https://accounts.google.com/o/oauth2/v2/auth");
	for (const [key, value] of Object.entries({ client_id: input.clientId, redirect_uri: input.redirectUri, state: input.state, response_type: "code", scope: providerScopes(provider).join(" ") })) url.searchParams.set(key, value);
	if (provider === "youtube") {
		url.searchParams.set("access_type", "offline");
		url.searchParams.set("prompt", "consent");
	} else url.searchParams.set("force_verify", "true");
	return url.toString();
}
export const streamDetailSchema = z
	.object({
		destinationId: z.uuid(),
		title: z.string().trim().max(100).optional(),
		description: z.string().max(5000).optional(),
		categoryId: z
			.string()
			.regex(/^\d{0,20}$/)
			.optional(),
		categoryName: z.string().trim().max(100).optional(),
		thumbnailAssetId: z.uuid().optional(),
	})
	.strict();
export const streamDetailsSchema = z
	.array(streamDetailSchema)
	.max(128)
	.refine((rows) => new Set(rows.map((row) => row.destinationId)).size === rows.length, "Choose each destination once.");
import type { StreamDetails } from "@/app/lib/runnerProviderDetails";
export type { StreamDetails } from "@/app/lib/runnerProviderDetails";
export function resolveStreamDetails(enabled: boolean, eventTitle: string, details: Pick<StreamDetails, "title" | "description" | "categoryId" | "thumbnailAssetId">) {
	if (!enabled) return null;
	return { title: details.title?.trim() || eventTitle, ...(details.description?.trim() ? { description: details.description } : {}), ...(details.categoryId ? { categoryId: details.categoryId } : {}), ...(details.thumbnailAssetId ? { thumbnailAssetId: details.thumbnailAssetId } : {}) };
}
export const providerIngest = { twitch: "rtmp://live.twitch.tv/app", youtube: "rtmp://a.rtmp.youtube.com/live2" } as const;
export const resultSchema = z.record(z.string(), z.object({ status: z.enum(["applied", "retry", "reconnect"]), attemptedAt: z.number(), error: z.string().optional() }));
