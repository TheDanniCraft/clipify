import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const plausibleScriptName = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_NAME ?? process.env.PLAUSIBLE_SCRIPT_NAME ?? `${crypto.randomInt(1000, 10000)}-${crypto.randomBytes(8).toString("hex")}`;
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build", ...process.argv.slice(2)], {
	stdio: "inherit",
	env: { ...process.env, PLAUSIBLE_SCRIPT_NAME: plausibleScriptName },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
