import { beforeSendError, beforeSendSpan, beforeSendTransaction } from "../../../../sentry.privacy";

describe("Sentry privacy filters", () => {
	it("keeps safe diagnostic context while dropping request payloads and secrets", () => {
		const event = beforeSendError({
			message: "Request failed authorization: Bearer secret-value at https://clipify.us/path?token=secret",
			user: { id: "user-123", email: "creator@example.com", ip_address: "127.0.0.1" },
			request: { cookies: { session: "secret" } },
			extra: { token: "secret", useful: "context" },
			tags: { feature: "clips" },
			breadcrumbs: [{ message: "Failed authorization: Bearer secret-value at https://clipify.us/path?token=secret" }],
			contexts: {
				browser: { name: "Firefox", version: "130" },
				custom: { accountEmail: "creator@example.com" },
			},
		} as never);

		expect(event.user).toEqual({ id: "user-123" });
		expect(event.request).toBeUndefined();
		expect(event.extra).toEqual({ token: "[Filtered]", useful: "context" });
		expect(event.tags).toEqual({ feature: "clips" });
		expect(event.breadcrumbs).toMatchObject([{ message: "Failed [secret] at https://clipify.us/path" }]);
		expect(event.contexts).toEqual({ browser: { name: "Firefox", version: "130" } });
		expect(event.message).toBe("Request failed [secret] at https://clipify.us/path");
	});

	it("retains useful transaction names", () => {
		const event = beforeSendTransaction({
			transaction: "POST /eventsub",
			transaction_info: { source: "custom" },
		} as never);

		expect(event.transaction).toBe("POST /eventsub");
	});

	it("keeps parameterized SQL shape while removing literals and disallowed attributes", () => {
		const span = beforeSendSpan({
			op: "db.query",
			description: "select * from users where id = $1 and email = 'creator@example.com'",
			data: {
				"db.system.name": "postgresql",
				"db.operation.name": "SELECT",
				"db.query.text": "select * from users where id = $1 and email = 'creator@example.com'",
				"db.query.parameter.0": "user-123",
				"http.request.header.authorization": "Bearer secret",
			},
		} as never);

		expect(span.description).toBe("select * from users where id = $1 and email = '[Filtered]'");
		expect(span.data).toEqual({
			"db.system.name": "postgresql",
			"db.operation.name": "SELECT",
			"db.query.text": "select * from users where id = $1 and email = '[Filtered]'",
		});
	});
});
