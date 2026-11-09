import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requiredAuthSetting } from "./environment";
type PreviewEvent = { id: string; presenterDigest: string };
const lifetime = 7 * 86400000;
function signature(event: PreviewEvent, expires: string) {
	return createHmac("sha256", requiredAuthSetting("BETTER_AUTH_SECRET", "JWT_SECRET")).update(`clipify-event-preview:${event.id}:${event.presenterDigest}:${expires}`).digest("base64url");
}
export function createAwardPreviewToken(event: PreviewEvent, now = new Date()) {
	const expires = String(now.getTime() + lifetime);
	return `${expires}.${signature(event, expires)}`;
}
export function hasAwardPreviewToken(event: PreviewEvent, token: unknown, now = new Date()) {
	if (typeof token !== "string" || !/^\d{13}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
	const [expires, supplied] = token.split(".");
	return Number(expires) > now.getTime() && timingSafeEqual(Buffer.from(supplied), Buffer.from(signature(event, expires)));
}
