import assert from "node:assert/strict";
import test from "node:test";
import { validateE2eSchemaPushTarget } from "./push-e2e-schema.mjs";

const approvedEnvironment = {
	GITHUB_ACTIONS: "true",
	GITHUB_JOB: "browser-tests",
	CLIPIFY_E2E_SCHEMA_PUSH: "1",
	DATABASE_URL: "postgresql://clipify_e2e:clipify_e2e@127.0.0.1:5432/clipify_e2e",
};

test("allows only the approved loopback GitHub Actions target", () => {
	assert.equal(validateE2eSchemaPushTarget(approvedEnvironment).hostname, "127.0.0.1");
});

for (const [name, overrides, expected] of [
	["outside GitHub Actions", { GITHUB_ACTIONS: "false" }, "E2E_SCHEMA_PUSH_CONTEXT_REQUIRED"],
	["outside the browser job", { GITHUB_JOB: "build" }, "E2E_SCHEMA_PUSH_CONTEXT_REQUIRED"],
	["without explicit CI approval", { CLIPIFY_E2E_SCHEMA_PUSH: "0" }, "E2E_SCHEMA_PUSH_CONTEXT_REQUIRED"],
	["against a remote host", { DATABASE_URL: "postgresql://clipify_e2e:test@100.72.180.95:5432/clipify_e2e" }, "E2E_LOOPBACK_DATABASE_REQUIRED"],
	["against a differently named database", { DATABASE_URL: "postgresql://clipify_e2e:test@127.0.0.1:5432/clipify" }, "E2E_DATABASE_IDENTITY_REQUIRED"],
	["as a different database user", { DATABASE_URL: "postgresql://postgres:test@127.0.0.1:5432/clipify_e2e" }, "E2E_DATABASE_IDENTITY_REQUIRED"],
]) {
	test(`rejects schema push ${name}`, () => {
		assert.throws(() => validateE2eSchemaPushTarget({ ...approvedEnvironment, ...overrides }), { message: expected });
	});
}
