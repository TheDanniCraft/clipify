import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { c15tInstance, createMigrator } from "@c15t/backend";
import { consentPolicyRules } from "../src/app/lib/consent/policy";

const directory = await mkdtemp(join(tmpdir(), "clipify-c15t-"));
const database = { dialect: "sqlite" as const, filename: join(directory, "consent.sqlite") };
const migrator = createMigrator(database);
let backend: ReturnType<typeof c15tInstance> | undefined;

function request(path: string, init?: RequestInit) {
	return new Request(`http://localhost:3000/api/c15t/${path}`, {
		...init,
		headers: { origin: "http://localhost:3000", ...init?.headers },
	});
}

try {
	const migration = await migrator.apply();
	assert.notEqual(migration.blocked, true);
	backend = c15tInstance({
		database,
		basePath: "/api/c15t",
		trustedOrigins: ["http://localhost:3000"],
		ipAddress: { tracking: false },
		manifest: { appName: "Clipify", policyRules: consentPolicyRules },
		policySnapshot: { signingKey: "test-only-c15t-snapshot-signing-key-123456" },
	});
	const handler = backend.handler;

	const initResponse = await handler(request("init", { headers: { origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.42" } }));
	assert.equal(initResponse.status, 200);
	const init = await initResponse.json();
	assert.equal(init.policyResolution.policy.model, "opt-in");
	assert.equal(init.policyResolution.policy.scopeMode, "strict");
	assert.equal(init.policyResolution.policy.validity.choiceMs, 180 * 86400000);
	assert.deepEqual(init.policyResolution.policy.scope, ["functionality", "measurement"]);
	assert.equal(init.policyResolution.policy.proof.storeIp, false);
	assert.equal(init.policyResolution.policy.proof.storeUserAgent, false);
	assert.equal(init.policyResolution.matchedBy, "fallback");
	assert.equal(typeof init.policySnapshotToken, "string");

	console.log("c15t consent API verified");
} finally {
	await backend?.dispose();
	await migrator.dispose();
	await rm(directory, { recursive: true, force: true });
}
