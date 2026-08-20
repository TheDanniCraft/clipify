import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const plausibleScriptName = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_NAME ?? process.env.PLAUSIBLE_SCRIPT_NAME ?? `${crypto.randomInt(1000, 10000)}-${crypto.randomBytes(8).toString("hex")}`;
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build", ...process.argv.slice(2)], {
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
