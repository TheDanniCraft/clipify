import { spawn } from "node:child_process";
import { once } from "node:events";
import { test as base } from "playwright-bdd";
import { createMcpPostgresFixture } from "../../support/mcp/postgres";
import { browserProviderEnvironment } from "../../support/mcp/browser-database.cjs";
export { expect } from "@playwright/test";
export type TourWorld = { origin: string; fixture: Awaited<ReturnType<typeof createMcpPostgresFixture>>; owner?: { creatorId: string; creatorOrganizationId: string; overlayId: string; playlistId: string }; result?: unknown };
export const test = base.extend<{ tourWorld: TourWorld; deploymentId: string | undefined }>({
	deploymentId: [undefined, { option: true }],
	trace: "off",
	tourWorld: async ({ deploymentId }, provideWorld) => {
		const fixture = await createMcpPostgresFixture();
		console.log("Guide fixture database ready");
		const env: NodeJS.ProcessEnv = {
			PATH: process.env.PATH,
			...(deploymentId ? { SOURCE_COMMIT: deploymentId } : {}),
			HOME: process.env.HOME,
			NODE_ENV: "production",
			APP_ENV: "test",
			E2E_TEST_MODE: "true",
			DISABLE_BACKGROUND_JOBS: "true",
			RUNNER_ARTIFACT_SOURCE: "local",
			ENCRYPTION_SECRET: "clipify-e2e-encryption-secret-not-for-production",
			JWT_SECRET: "clipify-e2e-jwt-secret-not-for-production",
			NEXT_PUBLIC_PLAUSIBLE_SCRIPT_NAME: "clipify-e2e",
			...browserProviderEnvironment({ APP_ENV: "test", E2E_TEST_MODE: "true", MCP_BROWSER_PROVIDER_FIXTURE: "true", MCP_BROWSER_DATABASE_URL: fixture.url }, "--max-old-space-size=1024"),
		};
		const child = spawn(process.execPath, ["test/support/user-tour/server.mjs"], { env, stdio: ["ignore", "pipe", "pipe"] });
		let output = "";
		child.stderr.on("data", (chunk) => {
			output = (output + String(chunk)).slice(-6000);
		});
		try {
			const origin = await new Promise<string>((resolve, reject) => {
				const timer = setTimeout(() => reject(new Error(`Guide server startup timed out: ${output}`)), 30000);
				child.once("exit", (code) => {
					clearTimeout(timer);
					reject(new Error(`Guide server exited ${code}: ${output}`));
				});
				child.stdout.on("data", (chunk) => {
					output = (output + String(chunk)).slice(-6000);
					const match = output.match(/TOUR_SERVER_URL=(http:[/][/]127[.]0[.]0[.]1:[0-9]+)/);
					if (match) {
						clearTimeout(timer);
						resolve(match[1]);
					}
				});
			});
			try {
				console.log("Guide fixture server ready");
				await provideWorld({ origin, fixture });
			} finally {
				await fetch(`${origin}/__tour_shutdown__`, { method: "POST", signal: AbortSignal.timeout(5000), headers: { Authorization: "Bearer tour-test-shutdown" } }).catch(() => undefined);
			}
		} finally {
			if (child.exitCode === null && child.signalCode === null) {
				const exited = once(child, "exit");
				child.kill("SIGTERM");
				await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
				if (child.exitCode === null && child.signalCode === null) {
					child.kill("SIGKILL");
					await exited;
				}
			}
			await fixture.close();
		}
	},
});
