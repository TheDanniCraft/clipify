import { z } from "zod";

export const connectionOperations = ["search_clips", "resolve_clip", "get_clip_playback"] as const;
export const untilRevokedExpiry = "9999-12-31T23:59:59.999Z";
export const untilRevokedValue = "until_revoked" as const;
export const connectionInput = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("provision"),
			name: z.string().trim().min(1).max(80),
			creatorId: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/),
			expiresAt: z.union([z.iso.datetime(), z.literal(untilRevokedValue)]),
			operations: z
				.array(z.enum(connectionOperations))
				.min(1)
				.max(3)
				.refine((values) => new Set(values).size === values.length)
				.default(["search_clips"]),
			callbackUrl: z
				.url()
				.refine((value) => {
					const url = new URL(value);
					return url.protocol === "https:" && !url.username && !url.password && !url.hash && !url.search && !url.port && !/\*|%2a/i.test(value);
				}, "Use an exact HTTPS callback URL without a query or fragment")
				.optional(),
		})
		.strict(),
	z.object({ action: z.literal("revoke"), grantId: z.uuid() }).strict(),
]);
