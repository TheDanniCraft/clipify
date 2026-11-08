import "server-only";
import jwt from "jsonwebtoken";
import { z } from "zod";
const claims = z.object({ creatorId: z.string().min(1).max(200), clipId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/) });
const options = { algorithms: ["HS256"], issuer: "clipify.us", audience: "clipify-browser-source" };
export function signBrowserClipSource(creatorId: string, clipId: string) {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error("Source access unavailable");
	// Outlast a slow fifty-file batch; each source request still rechecks access and quota.
	return jwt.sign(claims.parse({ creatorId, clipId }), secret, { algorithm: "HS256", issuer: options.issuer, audience: options.audience, expiresIn: 6 * 3600 });
}
export function readBrowserClipSource(ticket: string): { creatorId: string; clipId: string } | null {
	try {
		if (!process.env.JWT_SECRET || ticket.length > 4096) return null;
		return claims.parse(jwt.verify(ticket, process.env.JWT_SECRET, { ...options, algorithms: ["HS256"] }));
	} catch {
		return null;
	}
}
