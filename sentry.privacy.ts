import type * as Sentry from "@sentry/nextjs";

type InitOptions = Parameters<typeof Sentry.init>[0];
type ErrorEvent = Parameters<NonNullable<InitOptions["beforeSend"]>>[0];
type TransactionEvent = Parameters<NonNullable<InitOptions["beforeSendTransaction"]>>[0];
type SpanJSON = Parameters<NonNullable<InitOptions["beforeSendSpan"]>>[0];

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const secretPattern = /\b(authorization|bearer|token|secret|password|api[_-]?key)=?[:\s]+[^\s&]+/gi;
const urlQueryPattern = /(https?:\/\/[^\s?#]+|\/[\w./-]+)\?[^\s#]*/gi;

function scrubMessage(value: string) {
	return value
		.replace(emailPattern, "[email]")
		.replace(secretPattern, "[secret]")
		.replace(urlQueryPattern, "$1")
		.replace(/#[^\s]+/g, "");
}

function scrubEvent<T extends ErrorEvent | TransactionEvent>(event: T): T {
	delete event.user;
	delete event.request;
	delete event.extra;
	delete event.tags;
	delete event.breadcrumbs;

	if (event.message) event.message = scrubMessage(event.message);
	for (const exception of event.exception?.values ?? []) {
		if (exception.value) exception.value = scrubMessage(exception.value);
	}

	// Trace context is needed to connect an error to a performance trace.
	if (event.contexts) {
		const trace = event.contexts.trace;
		event.contexts = trace ? { trace } : {};
	}

	return event;
}

export function beforeSendError(event: ErrorEvent) {
	return scrubEvent(event);
}

export function beforeSendTransaction(event: TransactionEvent) {
	if (event.transaction && event.transaction_info?.source !== "route") {
		event.transaction = "unattributed route";
	}
	return scrubEvent(event);
}

const safeSpanAttributes = new Set(["db.system", "db.operation", "db.namespace", "db.collection.name", "http.request.method", "http.response.status_code", "server.port"]);

export function beforeSendSpan(span: SpanJSON) {
	if (span.data) {
		span.data = Object.fromEntries(Object.entries(span.data).filter(([key]) => key.startsWith("sentry.") || safeSpanAttributes.has(key)));
	}
	if (span.op?.startsWith("db")) span.description = "Database query";
	if (span.op?.startsWith("http")) span.description = "HTTP request";
	return span;
}
