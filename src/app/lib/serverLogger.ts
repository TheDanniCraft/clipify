import crypto from "node:crypto";

type LogContext = Record<string, unknown>;
const SENSITIVE_KEY = /token|secret|password|authorization|cookie|email|code|state|dsn/i;

function sanitize(value: unknown, depth = 0): unknown {
	if (depth > 3) return "[TRUNCATED]";
	if (value instanceof Error) return { name: value.name, message: value.message.slice(0, 500), stack: value.stack?.split("\n").slice(0, 12).join("\n") };
	if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
	if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SENSITIVE_KEY.test(key) ? "[REDACTED]" : sanitize(item, depth + 1)]));
	if (typeof value === "string") return value.replace(/([?&](?:token|code|state|secret)=[^&\s]+)/gi, "$1[REDACTED]").slice(0, 1000);
	return value;
}

export function logServerError(message: string, error: unknown, context: LogContext = {}) {
	const incidentId = crypto.randomUUID();
	console.error(JSON.stringify({ timestamp: new Date().toISOString(), severity: "error", message, incidentId, environment: process.env.NODE_ENV, release: process.env.APP_RELEASE || "unknown", context: sanitize(context), error: sanitize(error) }));
	return incidentId;
}
