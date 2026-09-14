import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { c15tInstance } from "@c15t/backend";
import { drizzleAdapter } from "@c15t/backend/db/adapters/drizzle";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../src/db/c15t-schema";
import { consentPolicyPacks } from "../src/app/lib/consent/policy";

const database = new PGlite();

function request(path: string, init?: RequestInit) {
	return new Request(`http://localhost:3000/api/c15t/${path}`, {
		...init,
		headers: { origin: "http://localhost:3000", ...init?.headers },
	});
}

try {
	await database.exec(readFileSync(join(process.cwd(), "drizzle/0022_tan_nomad.sql"), "utf8"));
	const db = drizzle(database, { schema });
	const handler = c15tInstance({
		adapter: drizzleAdapter({ db, provider: "postgresql" }),
		basePath: "/api/c15t",
		tablePrefix: "c15t_",
		trustedOrigins: ["http://localhost:3000"],
		disableGeoLocation: true,
		ipAddress: { tracking: false },
		policyPacks: consentPolicyPacks,
		policySnapshot: { signingKey: "test-only-c15t-snapshot-signing-key-123456" },
	}).handler;

	const initResponse = await handler(request("init", { headers: { origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.42" } }));
	assert.equal(initResponse.status, 200);
	const init = await initResponse.json();
	assert.equal(init.policy.model, "opt-in");
	assert.equal(init.policy.consent.scopeMode, "strict");
	assert.equal(init.policy.consent.expiryDays, 180);
	assert.deepEqual(init.policy.consent.categories, ["necessary", "functionality", "measurement", "marketing"]);
	assert.deepEqual(init.policy.consent.preselectedCategories, ["necessary"]);
	assert.equal(init.policy.proof.storeIp, false);
	assert.equal(init.policy.proof.storeUserAgent, false);
	assert.equal(init.policyDecision.matchedBy, "fallback");
	assert.equal(typeof init.policySnapshotToken, "string");

	const consentBody = {
		type: "cookie_banner",
		subjectId: "sub_testrejection",
		domain: "localhost",
		preferences: { necessary: true, functionality: false, measurement: false, marketing: false },
		givenAt: Date.now(),
	};
	const saveResponse = await handler(
		request("subjects", {
			method: "POST",
			headers: { "content-type": "application/json", origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.42", "user-agent": "test browser" },
			body: JSON.stringify({ ...consentBody, policySnapshotToken: init.policySnapshotToken }),
		}),
	);
	assert.equal(saveResponse.status, 200, await saveResponse.text());
	const saved = await database.query<{ ipAddress: string | null; userAgent: string | null; validUntil: Date | null }>('SELECT "ipAddress", "userAgent", "validUntil" FROM "c15t_consent"');
	assert.equal(saved.rows.length, 1);
	assert.equal(saved.rows[0].ipAddress, null);
	assert.equal(saved.rows[0].userAgent, null);
	assert.ok(saved.rows[0].validUntil);

	const unsigned = await handler(
		request("subjects", {
			method: "POST",
			headers: { "content-type": "application/json", origin: "http://localhost:3000" },
			body: JSON.stringify({ ...consentBody, subjectId: "sub_unsigned" }),
		}),
	);
	assert.equal(unsigned.status, 409);

	console.log("c15t consent API verified");
} finally {
	await database.close();
}
