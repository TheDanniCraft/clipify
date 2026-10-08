import { spawnSync } from "node:child_process";

// A separate build keeps test-only routes confined to the loopback E2E server.
const result = spawnSync(process.execPath, ["run", "app:build"], {
	cwd: process.cwd(),
	env: { ...process.env, APP_ENV: "test", E2E_TEST_MODE: "true", NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3107", DISABLE_BACKGROUND_JOBS: "true", RUNNER_ARTIFACT_SOURCE: "local", SENTRY_AUTH_TOKEN: "", SENTRY_DSN: "", SENTRY_RELEASE: "" },
	stdio: "inherit",
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
