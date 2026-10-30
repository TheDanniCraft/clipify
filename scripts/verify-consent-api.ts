import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createC15tClient } from "@c15t/node-sdk";
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
		apiKeys: ["test-only-server-consent-key-123456789"],
		identityToken: { signingKey: "test-only-server-identity-key-123456789" },
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

	const client = createC15tClient({ baseUrl: "http://localhost:3000/api/c15t", apiKey: "test-only-server-consent-key-123456789", fetch: (input, init) => handler(new Request(input, init)) });
	const subjects = await client.subjects.list({ externalId: "test-verified-account" });
	assert.equal(subjects.ok, true, "native SDK authorizes the server's in-process subject lookup");
	if (subjects.ok) assert.deepEqual(subjects.data.subjects, []);
	const confirmedAt = Date.now();
	const basis = { kind: "choice-v1" as const, fingerprint: init.policyResolution.fingerprints.choice };
	const saved = await client.subjects.create({
		type: "cookie_banner",
		subjectId: "sub_2jv6z8n4q9",
		domain: "localhost",
		givenAt: confirmedAt,
		preferences: { necessary: true, functionality: false, measurement: true },
		choice: { version: 3, categories: { functionality: { value: false, confirmedAt, basis }, measurement: { value: true, confirmedAt, basis } } },
		policySnapshotToken: init.policySnapshotToken,
	});
	assert.equal(saved.ok, true, JSON.stringify(saved));
	const linked = await client.subjects.identify("sub_2jv6z8n4q9", { externalId: "test-verified-account" });
	assert.equal(linked.ok, true, "server SDK verifies the authenticated subject link");
	const linkedSubjects = await client.subjects.list({ externalId: "test-verified-account" });
	assert.equal(linkedSubjects.ok && linkedSubjects.data.subjects.length, 1);
	const recorded = await client.subjects.get("sub_2jv6z8n4q9");
	assert.equal(recorded.ok && recorded.data.subjectChoice?.categories.measurement?.value, true);
	const unauthorized = createC15tClient({ baseUrl: "http://localhost:3000/api/c15t", apiKey: "wrong-key", fetch: (input, init) => handler(new Request(input, init)) });
	assert.equal((await unauthorized.subjects.list({ externalId: "test-verified-account" })).ok, false);
	console.log("c15t consent API verified");
} finally {
	await backend?.dispose();
	await migrator.dispose();
	await rm(directory, { recursive: true, force: true });
}
