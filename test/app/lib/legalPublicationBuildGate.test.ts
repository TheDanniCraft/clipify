/** @jest-environment node */

import path from "node:path";
import { spawnSync } from "node:child_process";

describe("legal publication build gate", () => {
	it("rejects an invalid release before invoking Next.js", () => {
		const result = spawnSync("bun", ["scripts/build-app.mjs"], {
			cwd: process.cwd(),
			encoding: "utf8",
			env: {
				...process.env,
				NODE_ENV: "test",
				CLIPIFY_TEST_POLICY_RELEASE_FIXTURE: path.resolve("test/support/invalid-policy-release.json"),
				CLIPIFY_TEST_NEXT_BIN: path.resolve("test/support/next-build-sentinel.mjs"),
			},
		});

		expect(result.status).toBe(1);
		expect(`${result.stdout}\n${result.stderr}`).toContain("documents.privacy.title is required");
		expect(`${result.stdout}\n${result.stderr}`).not.toContain("NEXT_BUILD_SENTINEL_INVOKED");
	});
});
