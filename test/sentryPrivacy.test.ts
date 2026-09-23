import { beforeSendError, beforeSendSpan, beforeSendTransaction } from "../sentry.privacy";

describe("Sentry privacy hooks", () => {
	it("drops requests and keeps only scrubbed diagnostic context", () => {
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
		expect(event.extra).toEqual({ token: "[Filtered]" });
		expect(event.breadcrumbs).toMatchObject([{ message: "private message" }]);
		expect(event.message).not.toContain("viewer@example.com");
		expect(event.message).not.toContain("token=secret");
		expect(event.exception?.values?.[0].value).toBe("[email]");
	});

	it("keeps transaction names for route-level performance diagnosis", () => {
		const event = beforeSendTransaction({ type: "transaction", transaction: "/dashboard/overlay/private-id", transaction_info: { source: "url" } });
		expect(event.transaction).toBe("/dashboard/overlay/private-id");
	});

	it("keeps parameterized SQL diagnostics while filtering inline literals", () => {
		const span = beforeSendSpan({
			span_id: "0000000000000001",
			trace_id: "00000000000000000000000000000001",
			start_timestamp: 1,
			op: "db.query",
			description: "SELECT * FROM users WHERE email = 'viewer@example.com'",
			data: { "db.operation": "SELECT", "db.statement": "SELECT private_data", "db.collection.name": "users" },
		});
		expect(span.description).toBe("SELECT * FROM users WHERE email = '[Filtered]'");
		expect(span.data).toEqual({
			"db.operation": "SELECT",
			"db.statement": "SELECT private_data",
			"db.collection.name": "users",
		});
	});
});
