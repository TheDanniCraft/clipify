import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const isControlledTest = process.env.NODE_ENV === "test";
const plausibleScriptName = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_NAME ?? process.env.PLAUSIBLE_SCRIPT_NAME ?? `${crypto.randomInt(1000, 10000)}-${crypto.randomBytes(8).toString("hex")}`;
const policyFixture = isControlledTest && process.env.CLIPIFY_TEST_POLICY_RELEASE_FIXTURE ? path.resolve(process.env.CLIPIFY_TEST_POLICY_RELEASE_FIXTURE) : undefined;
const nextBin = isControlledTest && process.env.CLIPIFY_TEST_NEXT_BIN ? path.resolve(process.env.CLIPIFY_TEST_NEXT_BIN) : require.resolve("next/dist/bin/next");

const publicationValidation = spawnSync("bun", [require.resolve("./validate-legal-content.ts"), ...(policyFixture ? [policyFixture] : [])], {
	stdio: "inherit",
	env: { ...process.env, NODE_ENV: "production" },
});

if (publicationValidation.error) throw publicationValidation.error;
if (publicationValidation.status !== 0) process.exit(publicationValidation.status ?? 1);

const result = spawnSync(process.execPath, [nextBin, "build", ...process.argv.slice(2)], {
	stdio: "inherit",
	env: { ...process.env, NODE_ENV: "production", PLAUSIBLE_SCRIPT_NAME: plausibleScriptName },
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const verification = spawnSync("bun", [require.resolve("./validate-patched-dependencies.ts"), "--node-modules", ".next/standalone/node_modules"], {
	stdio: "inherit",
	env: { ...process.env, NODE_ENV: "production" },
});

if (verification.error) throw verification.error;
process.exit(verification.status ?? 1);
