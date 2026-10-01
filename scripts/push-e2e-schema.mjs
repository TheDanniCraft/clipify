import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export function validateE2eSchemaPushTarget(environment = process.env) {
	if (environment.GITHUB_ACTIONS !== "true" || environment.GITHUB_JOB !== "browser-tests" || environment.CLIPIFY_E2E_SCHEMA_PUSH !== "1") {
		throw new Error("E2E_SCHEMA_PUSH_CONTEXT_REQUIRED");
	}

	const rawUrl = environment.DATABASE_URL;
	if (!rawUrl) throw new Error("E2E_DATABASE_URL_REQUIRED");

	const url = new URL(rawUrl);
	if (!new Set(["postgres:", "postgresql:"]).has(url.protocol)) throw new Error("E2E_POSTGRES_REQUIRED");
	if (!new Set(["127.0.0.1", "localhost", "[::1]"]).has(url.hostname)) throw new Error("E2E_LOOPBACK_DATABASE_REQUIRED");
	if ((url.port || "5432") !== "5432") throw new Error("E2E_DATABASE_PORT_REQUIRED");
	if (decodeURIComponent(url.pathname) !== "/clipify_e2e" || decodeURIComponent(url.username) !== "clipify_e2e") throw new Error("E2E_DATABASE_IDENTITY_REQUIRED");

	return url;
}

export function pushE2eSchema(environment = process.env) {
	validateE2eSchemaPushTarget(environment);
	const drizzleKitBin = resolve(dirname(require.resolve("drizzle-kit")), "bin.cjs");
	execFileSync(process.execPath, [drizzleKitBin, "push", "--force"], { cwd: process.cwd(), env: environment, stdio: "inherit" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	try {
		pushE2eSchema();
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : "E2E_SCHEMA_PUSH_FAILED"}\n`);
		process.exitCode = 1;
	}
}
