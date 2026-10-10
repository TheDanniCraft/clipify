/** @jest-environment node */
import type { drizzleAdapter } from "better-auth/adapters/drizzle";
import { withResourceSeedErrorCompatibility } from "@/auth/resource-seed-adapter";

type Factory = ReturnType<typeof drizzleAdapter>;

function adapterThrowing(error: Error) {
	const create = jest.fn().mockRejectedValue(error);
	const factory = (() => ({ create })) as unknown as Factory;
	return withResourceSeedErrorCompatibility(factory)({});
}

test("exposes only the resource identifier conflict to the provider's existing race handler", async () => {
	const pg = Object.assign(new Error("duplicate key"), { code: "23505", constraint: "oauth_resource_identifier_unique" });
	const wrapped = new Error("Failed query: insert into oauth_resource", { cause: pg });
	const adapter = adapterThrowing(wrapped);
	await expect(adapter.create({ model: "oauthResource", data: {} })).rejects.toMatchObject({ message: "Duplicate OAuth resource identifier", cause: wrapped });
});

test.each([
	["oauthResource", "23505", "different_constraint"],
	["user", "23505", "oauth_resource_identifier_unique"],
	["oauthResource", "42501", "oauth_resource_identifier_unique"],
])("preserves unrelated %s/%s/%s failures", async (model, code, constraint) => {
	const error = new Error("Failed query", { cause: Object.assign(new Error("database failure"), { code, constraint }) });
	await expect(adapterThrowing(error).create({ model, data: {} })).rejects.toBe(error);
});

test("cyclic error causes do not hang initialization", async () => {
	const error = new Error("Failed query");
	error.cause = error;
	await expect(adapterThrowing(error).create({ model: "oauthResource", data: {} })).rejects.toBe(error);
});
