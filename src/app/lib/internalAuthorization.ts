import crypto from "crypto";

function secureEqual(a: string, b: string) {
	try {
		const aBuffer = Buffer.from(a);
		const bBuffer = Buffer.from(b);
		if (aBuffer.length !== bBuffer.length) return false;
		return crypto.timingSafeEqual(aBuffer, bBuffer);
	} catch {
		return false;
	}
}

export function hasInstanceHealthAuthorization(request: Request) {
	const token = process.env.INSTANCE_HEALTH_TOKEN;
	if (!token) return false;

	const authorization = request.headers.get("authorization") ?? "";
	if (!authorization.toLowerCase().startsWith("bearer ")) return false;
	return secureEqual(authorization.slice(7).trim(), token);
}
