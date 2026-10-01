import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";

export type CutoverCheckpoint = "preflight" | "backup" | "identity" | "membership" | "credential" | "invariant" | "activation" | "smoke";

export function failureInjector(target?: CutoverCheckpoint) {
	return (checkpoint: CutoverCheckpoint) => {
		if (checkpoint === target) throw new Error(`injected_cutover_failure:${checkpoint}`);
	};
}

export function backupAttestationFixture(overrides: Record<string, unknown> = {}) {
	return {
		createdAt: "2026-09-27T12:00:00.000Z",
		checksum: "sha256:fixture-backup-checksum",
		restoreDrillReference: "restore-drill-fixture-0001",
		sourceFingerprint: "fixture-database-not-production",
		...overrides,
	};
}

export async function isolatedCutoverFilesystem() {
	const directory = await mkdtemp(resolve(tmpdir(), "clipify-auth-cutover-"));
	return {
		directory,
		write: (relativePath: string, contents: string) => writeFile(resolve(directory, relativePath), contents, "utf8"),
		cleanup: async () => {
			const resolvedDirectory = resolve(directory);
			if (!resolvedDirectory.startsWith(resolve(tmpdir()))) throw new Error("Refusing to remove a non-temporary cutover directory");
			await rm(resolvedDirectory, { recursive: true, force: true });
		},
	};
}

export interface SubprocessCapture {
	exitCode: number;
	stdout: string;
	stderr: string;
}

export function redactSubprocessCapture(capture: SubprocessCapture): SubprocessCapture {
	const redact = (value: string) => value.replace(/(token|secret|password|authorization)=?[^\s]*/gi, "$1=[REDACTED]");
	return { ...capture, stdout: redact(capture.stdout), stderr: redact(capture.stderr) };
}
