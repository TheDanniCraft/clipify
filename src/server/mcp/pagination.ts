import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const positionSchema = z.string().min(1).max(255);
const cursorSchema = z.object({ v: z.literal(1), position: positionSchema, context: z.string().length(64), expiresAt: z.number().int().positive() }).strict();
type CursorOptions = { secret?: string; now?: Date };
function signingKey(options: CursorOptions): string {
	const secret = options.secret ?? process.env.MCP_CURSOR_SECRET ?? process.env.BETTER_AUTH_SECRET ?? process.env.JWT_SECRET;
	if (!secret) throw new Error("SERVICE_UNAVAILABLE");
	return createHmac("sha256", secret).update("clipify:mcp:cursor:v1").digest("hex");
}
function contextDigest(context: string) {
	return createHash("sha256").update(context).digest("hex");
}
export function encodePageCursor(position: string, context: string, options: CursorOptions = {}): string {
	if (!positionSchema.safeParse(position).success) throw new Error("INVALID_INPUT");
	const payload = Buffer.from(JSON.stringify({ v: 1, position, context: contextDigest(context), expiresAt: (options.now ?? new Date()).getTime() + 30 * 60 * 1000 })).toString("base64url");
	const signature = createHmac("sha256", signingKey(options)).update(payload).digest("base64url");
	return `${payload}.${signature}`;
}
export function decodePageCursor(cursor: string, context: string, options: CursorOptions = {}): string {
	const key = signingKey(options);
	try {
		if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
		const [payload, signature] = cursor.split(".");
		const supplied = Buffer.from(signature, "base64url"),
			expected = createHmac("sha256", key).update(payload).digest();
		if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error();
		const value = cursorSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
		if (value.context !== contextDigest(context) || value.expiresAt <= (options.now ?? new Date()).getTime()) throw new Error();
		return value.position;
	} catch {
		throw new Error("INVALID_INPUT");
	}
}
