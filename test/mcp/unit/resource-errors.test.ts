/** @jest-environment node */
import { toPublicResourceError } from "@/server/resources/errors";

test.each([{ usage: -1, limit: 1 }, { usage: 0.5, limit: 1 }, { usage: NaN, limit: 1 }, { usage: Infinity, limit: 1 }, { usage: "1", limit: 1 }, { usage: 1, limit: -1 }, { usage: 1, limit: 0.5 }, { usage: 1, limit: NaN }, { usage: 1, limit: Infinity }, { usage: 1, limit: "1" }, { usage: 1 }, { limit: 1 }])("invalid quota metadata %p cannot escape into a public error", (metadata) => {
	const cause = Object.assign(new Error("PLAN_LIMIT_REACHED"), metadata, { privateAccountId: "private-account" });
	const error = toPublicResourceError(cause);
	expect(error.code).toBe("PLAN_LIMIT_REACHED");
	expect(error).not.toHaveProperty("usage");
	expect(error).not.toHaveProperty("limit");
	expect(Object.keys(error).sort()).toEqual(["code", "correlationId", "message"]);
	expect(JSON.stringify(error)).not.toContain("private-account");
});
test("zero public quota fields are valid and correlation identifiers are fresh for each failure", () => {
	const cause = Object.assign(new Error("PLAN_LIMIT_REACHED"), { usage: 0, limit: 0 });
	const first = toPublicResourceError(cause);
	const second = toPublicResourceError(cause);
	expect(first).toMatchObject({ usage: 0, limit: 0 });
	expect(first.correlationId).not.toBe(second.correlationId);
});
test.each(["__proto__", "constructor", "toString"])("prototype property %s cannot become an error code", (code) => {
	expect(toPublicResourceError(new Error(code)).code).toBe("SERVICE_UNAVAILABLE");
});
