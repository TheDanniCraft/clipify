import { beforeSendError, beforeSendSpan, beforeSendTransaction } from "../sentry.privacy";

describe("Sentry privacy hooks", () => {
	it("drops user, request, extras and breadcrumbs from errors", () => {
		const event = beforeSendError({
			type: undefined,
			user: { email: "viewer@example.com" },
			request: { url: "https://clipify.us/?token=secret" },
			extra: { token: "secret" },
			breadcrumbs: [{ message: "private message" }],
			message: "Failed for viewer@example.com at https://clipify.us/?token=secret",
			exception: { values: [{ type: "Error", value: "viewer@example.com" }] },
		});
		expect(event.user).toBeUndefined();
		expect(event.request).toBeUndefined();
		expect(event.extra).toBeUndefined();
		expect(event.breadcrumbs).toBeUndefined();
		expect(event.message).not.toContain("viewer@example.com");
		expect(event.message).not.toContain("token=secret");
		expect(event.exception?.values?.[0].value).toBe("[email]");
	});

	it("keeps route templates but removes unattributed transaction names", () => {
		const event = beforeSendTransaction({ type: "transaction", transaction: "/dashboard/overlay/private-id", transaction_info: { source: "url" } });
		expect(event.transaction).toBe("unattributed route");
	});

	it("keeps only safe span attributes and replaces raw SQL descriptions", () => {
		const span = beforeSendSpan({
			span_id: "0000000000000001",
			trace_id: "00000000000000000000000000000001",
			start_timestamp: 1,
			op: "db.query",
			description: "SELECT * FROM users WHERE email = 'viewer@example.com'",
			data: { "db.operation": "SELECT", "db.statement": "SELECT private_data", "db.collection.name": "users" },
		});
		expect(span.description).toBe("Database query");
		expect(span.data).toEqual({ "db.operation": "SELECT", "db.collection.name": "users" });
	});
});
