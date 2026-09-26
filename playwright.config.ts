import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const baseURL = "http://127.0.0.1:3107";
const bddTestDir = defineBddConfig({
	features: "test/bdd/features/**/*.feature",
	steps: "test/bdd/steps/**/*.ts",
	featuresRoot: "test/bdd/features",
	outputDir: ".features-gen",
	language: "en",
	missingSteps: "fail-on-gen",
	arityCheck: true,
	quotes: "double",
});

const chromium = {
	...devices["Desktop Chrome"],
	baseURL,
};

export default defineConfig({
	globalTeardown: "./test/support/playwright-global-teardown.ts",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	timeout: 60_000,
	expect: { timeout: 5_000 },
	reporter: process.env.CI ? [["line"], ["html", { open: "never", outputFolder: "playwright-report" }], ["junit", { outputFile: "test-results/playwright-junit.xml" }]] : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
	use: {
		baseURL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	outputDir: "test-results",
	projects: [
		{
			name: "acceptance-chromium",
			testDir: "./test/acceptance",
			testMatch: "**/*.spec.ts",
			use: chromium,
		},
		{
			name: "bdd-chromium",
			testDir: bddTestDir,
			use: chromium,
		},
		{
			name: "compliance-chromium",
			testDir: "./test/compliance",
			testMatch: "**/*.spec.ts",
			use: chromium,
		},
	],
	webServer: {
		// The custom test server exposes a loopback-only, E2E-gated shutdown hook.
		// Global teardown closes Next before Playwright reaches its unreliable
		// Windows taskkill fallback, while Linux retains the same managed lifecycle.
		command: "node scripts/playwright-server.mjs",
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			APP_ENV: "test",
			DATABASE_URL: "postgresql://clipify_e2e:clipify_e2e@127.0.0.1:1/clipify_e2e",
			DISABLE_BACKGROUND_JOBS: "true",
			E2E_TEST_MODE: "true",
			ENCRYPTION_SECRET: "clipify-e2e-encryption-secret-not-for-production",
			JWT_SECRET: "clipify-e2e-jwt-secret-not-for-production",
			NEXT_PUBLIC_BASE_URL: baseURL,
			NEXT_PUBLIC_PLAUSIBLE_SCRIPT_NAME: "clipify-e2e",
			RUNNER_ARTIFACT_SOURCE: "local",
			SENTRY_AUTH_TOKEN: "",
			SENTRY_DSN: "",
			SENTRY_RELEASE: "",
		},
	},
});
