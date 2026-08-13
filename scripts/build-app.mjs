import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const release = process.env.APP_RELEASE ?? process.env.SOURCE_REVISION ?? process.env.GITHUB_SHA ?? `build-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomBytes(4).toString("hex")}`;
const plausibleScriptName = process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_NAME ?? process.env.PLAUSIBLE_SCRIPT_NAME ?? `${crypto.randomInt(1000, 10000)}-${crypto.randomBytes(8).toString("hex")}`;
const result = spawnSync(process.execPath, [require.resolve("next/dist/bin/next"), "build", ...process.argv.slice(2)], {
	stdio: "inherit",
	env: { ...process.env, APP_RELEASE: release, NEXT_PUBLIC_APP_RELEASE: release, PLAUSIBLE_SCRIPT_NAME: plausibleScriptName },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
