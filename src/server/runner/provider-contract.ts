import { z } from "zod";

export type StreamingProvider = "twitch" | "youtube";
export const streamingProviderSchema = z.enum(["twitch", "youtube"]);
export function providerScopes(provider: StreamingProvider): string[] {
	return provider === "twitch" ? ["channel:read:stream_key", "channel:manage:broadcast"] : ["https://www.googleapis.com/auth/youtube.force-ssl"];
}
/** Better Auth owns provider callbacks, state, PKCE and preview proxying. */
export function providerLinkRequest(provider: StreamingProvider, origin: string, intent: string) {
	const callback = new URL(`/runner/connect/${provider}/complete`, origin);
	callback.searchParams.set("intent", intent);
	return {
		provider: provider === "youtube" ? ("google" as const) : ("twitch" as const),
		callbackURL: callback.toString(),
		errorCallbackURL: callback.toString(),
		disableRedirect: true,
		scopes: providerScopes(provider),
		additionalData: { runnerConnectionIntent: intent },
		additionalParams: (provider === "youtube" ? { access_type: "offline", prompt: "consent" } : { force_verify: "true" }) as Record<string, string>,
	};
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
