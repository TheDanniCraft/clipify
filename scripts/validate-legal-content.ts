import { readFileSync } from "node:fs";
import path from "node:path";
import { canonicalPolicyRelease } from "../src/app/lib/legal/policyRelease";
import { validatePolicyRelease, type PolicyReleaseInput } from "../src/app/lib/legal/validation";

const fixturePath = process.argv[2];
const release: PolicyReleaseInput = fixturePath ? JSON.parse(readFileSync(path.resolve(fixturePath), "utf8")) : canonicalPolicyRelease;
const result = validatePolicyRelease(release);

if (!result.valid) {
	console.error(["Legal publication validation failed:", ...result.errors.map((error) => `- ${error}`)].join("\n"));
	process.exitCode = 1;
} else {
	console.log(`Legal publication validation passed for ${release.documents.length} documents and ${release.services.length} services.`);
}
