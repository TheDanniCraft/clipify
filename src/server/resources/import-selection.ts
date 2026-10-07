import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
const fields = z
	.object({
		creatorId: z.string().min(1).max(255),
		playlistId: z.uuid(),
		expectedRevision: z.number().int().positive().max(2_147_483_647),
		clipIds: z
			.array(
				z
					.string()
					.min(1)
					.max(200)
					.regex(/^[A-Za-z0-9_-]+$/),
			)
			.max(500)
			.refine((ids) => new Set(ids).size === ids.length),
		requiresPro: z.boolean(),
	})
	.strict();
const envelope = fields.extend({ v: z.literal(1), binding: z.string().length(64), expiresAt: z.number().int().positive() }).strict();
type Identity = Pick<TrustedCreatorPrincipal, "kind" | "authUserId" | "grantId" | "generation" | "clientId">;
type Options = { secret?: string; now?: number };
function key(options: Options) {
	const secret = options.secret ?? process.env.BETTER_AUTH_SECRET ?? process.env.JWT_SECRET;
	if (!secret || secret.trim().length < 32) throw new Error("SERVICE_UNAVAILABLE");
	return createHmac("sha256", secret).update("clipify:mcp:import-selection:v1").digest();
}
function binding(principal: Identity) {
	if (principal.kind !== "oauth" || !principal.grantId || !principal.clientId || !principal.generation) throw new Error("INVALID_INPUT");
	return createHash("sha256")
		.update(JSON.stringify([principal.authUserId, principal.grantId, principal.generation, principal.clientId]))
		.digest("hex");
}
export function encodeImportSelection(value: z.infer<typeof fields>, principal: Identity, options: Options = {}) {
	const parsed = fields.safeParse(value);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const payload = Buffer.from(JSON.stringify({ ...parsed.data, v: 1, binding: binding(principal), expiresAt: (options.now ?? Date.now()) + 600_000 })).toString("base64url");
	const token = `${payload}.${createHmac("sha256", key(options)).update(payload).digest("base64url")}`;
	if (token.length > 100_000) throw new Error("INVALID_INPUT");
	return token;
}
export function decodeImportSelection(token: string, principal: Identity, target: { creatorId: string; playlistId: string }, options: Options = {}) {
	const signingKey = key(options);
	try {
		if (token.length > 100_000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error();
		const [payload, signature] = token.split(".");
		const supplied = Buffer.from(signature, "base64url"),
			expected = createHmac("sha256", signingKey).update(payload).digest();
		if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
		const value = envelope.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
		if (value.binding !== binding(principal) || value.creatorId !== target.creatorId || value.playlistId !== target.playlistId || value.expiresAt <= (options.now ?? Date.now())) throw new Error();
		return value;
	} catch {
		throw new Error("INVALID_INPUT");
	}
}
