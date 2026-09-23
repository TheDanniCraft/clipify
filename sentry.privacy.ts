import type * as Sentry from "@sentry/nextjs";

type InitOptions = Parameters<typeof Sentry.init>[0];
type ErrorEvent = Parameters<NonNullable<InitOptions["beforeSend"]>>[0];
type TransactionEvent = Parameters<NonNullable<InitOptions["beforeSendTransaction"]>>[0];
type SpanJSON = Parameters<NonNullable<InitOptions["beforeSendSpan"]>>[0];
type Log = Parameters<NonNullable<InitOptions["beforeSendLog"]>>[0];
type Metric = Parameters<NonNullable<InitOptions["beforeSendMetric"]>>[0];

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const secretPattern = /\b(?:authorization\s*[:=]\s*(?:bearer|basic)\s+|bearer\s+|(?:token|secret|password|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token)\s*[:=]\s*)[^\s&,;]+/gi;
const urlQueryPattern = /(https?:\/\/[^\s?#]+|\/[\w./-]+)\?[^\s#]*/gi;
const sensitiveKeyPattern = /(?:^|[._-])(?:authorization|cookie|set[-_]?cookie|password|secret|token|api[-_]?key|client[-_]?secret|access[-_]?token|refresh[-_]?token)(?:$|[._-])/i;

function scrubMessage(value: string) {
	return value.replace(emailPattern, "[email]").replace(secretPattern, "[secret]").replace(urlQueryPattern, "$1");
}

function scrubObject(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(scrubObject);
	if (!value || typeof value !== "object") return typeof value === "string" ? scrubMessage(value) : value;

	return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, sensitiveKeyPattern.test(key) ? "[Filtered]" : scrubObject(child)]));
}

function scrubEvent<T extends ErrorEvent | TransactionEvent>(event: T): T {
	if (event.user) {
		// Keep only the stable application identifier for impact analysis.
		event.user = event.user.id ? { id: event.user.id } : undefined;
	}
	delete event.request;
	if (event.extra) event.extra = scrubObject(event.extra) as typeof event.extra;
	if (event.tags) event.tags = scrubObject(event.tags) as typeof event.tags;
	if (event.breadcrumbs) {
		event.breadcrumbs = event.breadcrumbs.map(({ timestamp, category, type, level, message }) => ({
			timestamp,
			category,
			type,
			level,
			message: message ? scrubMessage(message) : undefined,
		}));
	}

	if (event.message) event.message = scrubMessage(event.message);
	for (const exception of event.exception?.values ?? []) {
		if (exception.value) exception.value = scrubMessage(exception.value);
	}

	// Preserve standard diagnostic contexts needed for RUM and profiling while
	// excluding arbitrary custom contexts that may contain application payloads.
	if (event.contexts) {
		const safeContexts = new Set(["app", "browser", "device", "gpu", "os", "runtime", "trace"]);
		event.contexts = Object.fromEntries(Object.entries(event.contexts).filter(([key]) => safeContexts.has(key))) as typeof event.contexts;
	}

	return event;
}

export function beforeSendError(event: ErrorEvent) {
	return scrubEvent(event);
}

export function beforeSendTransaction(event: TransactionEvent) {
	return scrubEvent(event);
}

const safeSpanAttributes = new Set(["db.system", "db.system.name", "db.operation", "db.operation.name", "db.namespace", "db.collection.name", "db.query.text", "db.statement", "http.request.method", "http.response.status_code", "server.port"]);

function scrubSpanDescription(description: string, operation: string | undefined) {
	const scrubbed = scrubMessage(description);
	// Keep the SQL shape and placeholders needed for slow-query diagnosis while
	// defensively removing inline string literals from hand-written statements.
	return operation?.startsWith("db") ? scrubbed.replace(/'(?:''|[^'])*'/g, "'[Filtered]'") : scrubbed;
}

export function beforeSendSpan(span: SpanJSON) {
	if (span.data) {
		span.data = Object.fromEntries(
			Object.entries(span.data)
				.filter(([key]) => key.startsWith("sentry.") || safeSpanAttributes.has(key))
				.map(([key, value]) => [key, typeof value === "string" && (key === "db.query.text" || key === "db.statement") ? scrubSpanDescription(value, "db.query") : scrubObject(value)]),
		) as SpanJSON["data"];
	}
	if (span.description) span.description = scrubSpanDescription(span.description, span.op);
	return span;
}

export function beforeSendLog(log: Log) {
	log.message = scrubMessage(String(log.message)) as typeof log.message;
	if (log.attributes) log.attributes = scrubObject(log.attributes) as typeof log.attributes;
	return log;
}

export function beforeSendMetric(metric: Metric) {
	if (metric.attributes) metric.attributes = scrubObject(metric.attributes) as typeof metric.attributes;
	return metric;
}
