/** @jest-environment node */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test.each(["Dockerfile", "Dockerfile-preview"])("%s embeds a distinct deployment marker when the platform omits its source commit", (file) => {
	const lines = readFileSync(file, "utf8").split("\n");
	const declaration = lines
		.find((line) => line.trim().startsWith("deployment_build_id="))
		?.trim()
		.replace(/ && \\$/, "");
	const source = lines
		.find((line) => line.trim().startsWith("SOURCE_COMMIT="))
		?.trim()
		.replace(/ \\$/, "");
	const release = lines
		.find((line) => line.trim().startsWith("SENTRY_RELEASE="))
		?.trim()
		.replace(/ \\$/, "");
	expect(declaration).toBeDefined();
	expect(source).toBeDefined();
	expect(release).toBeDefined();
	function marker(commit = "", explicitRelease = "") {
		const result = spawnSync("sh", ["-c", `${declaration}\n${source} ${release} node -p 'JSON.stringify({source:process.env.SOURCE_COMMIT,release:process.env.SENTRY_RELEASE})'`], { env: { NODE_ENV: "test", PATH: process.env.PATH, SOURCE_COMMIT: commit, SENTRY_RELEASE: explicitRelease, SENTRY_RELEASE_PREFIX: "clipify-preview" }, encoding: "utf8" });
		expect(result.status).toBe(0);
		return JSON.parse(result.stdout.trim()) as { source: string; release: string };
	}
	const first = marker();
	expect(first.source).toMatch(/^[a-f0-9-]{36}$/);
	expect(first.release).toBe(`clipify-preview@${first.source}`);
	expect(marker().source).not.toBe(first.source);
	expect(marker("source-sha")).toEqual({ source: "source-sha", release: "clipify-preview@source-sha" });
	expect(marker("source-sha", "clipify@v4.2.1+sha")).toEqual({ source: "source-sha", release: "clipify@v4.2.1+sha" });
	const placeholder = marker("", "clipify-preview@local");
	expect(placeholder.release).toBe("clipify-preview@local");
	expect(placeholder.source).toMatch(/^[a-f0-9-]{36}$/);
});
