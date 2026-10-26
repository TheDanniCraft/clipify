import configuration from "./playwright.config";
import { defineConfig } from "@playwright/test";
// Most provider scenarios use isolated HTTP handlers and PostgreSQL fixtures.
// Real browser scenarios additionally require the already-running isolated Next
// test server; this configuration does not start or tear down that shared server.
export default defineConfig({
	...configuration,
	projects: configuration.projects?.map((project) => (project.name === "bdd-chromium" || project.name === "atdd-chromium" ? { ...project, testIgnore: [] } : project)),
	webServer: undefined,
	globalSetup: "./test/support/mcp/native-workflow-setup.mjs",
	globalTeardown: undefined,
	outputDir: "test-results/mcp-bdd",
});
