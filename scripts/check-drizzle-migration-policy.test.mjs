import assert from "node:assert/strict";
import test from "node:test";
import { hasMigrationApproval, isProtectedMigrationArtifact, migrationPolicyViolations } from "./check-drizzle-migration-policy.mjs";

test("recognizes generated Drizzle artifacts but not schema sources", () => {
	assert.equal(isProtectedMigrationArtifact("drizzle/0023_example.sql"), true);
	assert.equal(isProtectedMigrationArtifact("drizzle/meta/0023_snapshot.json"), true);
	assert.equal(isProtectedMigrationArtifact("drizzle/meta/_journal.json"), true);
	assert.equal(isProtectedMigrationArtifact("src/db/schema.ts"), false);
});

test("rejects migration artifacts on an ordinary feature branch", () => {
	assert.deepEqual(migrationPolicyViolations(["drizzle/0023_example.sql", "drizzle/meta/0023_snapshot.json", "src/db/schema.ts"], {}), ["drizzle/0023_example.sql", "drizzle/meta/0023_snapshot.json"]);
});

test("allows only the authenticated master workflow for ordinary generation", () => {
	assert.equal(
		hasMigrationApproval({
			GITHUB_ACTIONS: "true",
			GITHUB_REF: "refs/heads/master",
			CLIPIFY_MIGRATION_WORKFLOW: "true",
		}),
		true,
	);
	assert.equal(
		hasMigrationApproval({
			GITHUB_ACTIONS: "true",
			GITHUB_REF: "refs/heads/feature/auth",
			CLIPIFY_MIGRATION_WORKFLOW: "true",
		}),
		false,
	);
});

test("accepts the explicit human approval escape hatch", () => {
	assert.equal(hasMigrationApproval({ CLIPIFY_MANUAL_MIGRATION_APPROVED: "true" }), true);
	assert.deepEqual(
		migrationPolicyViolations(["drizzle/0023_custom.sql"], {
			CLIPIFY_MANUAL_MIGRATION_APPROVED: "1",
		}),
		[],
	);
});
