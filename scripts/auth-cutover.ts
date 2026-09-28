import { parseCutoverCommand } from "./auth-cutover/state-machine";
import { runPostgresApply, runPostgresDryRun, runPostgresValidate } from "./auth-cutover/postgres";

export async function runCutoverCli(argv: string[], environment: NodeJS.ProcessEnv = process.env) {
	const command = parseCutoverCommand(argv);
	if (command.mode === "dry-run") return runPostgresDryRun(environment);
	if (command.mode === "apply" || command.mode === "resume") return runPostgresApply(environment);
	if (command.mode === "validate") return runPostgresValidate(environment);
	throw new Error(`CUTOVER_MODE_NOT_IMPLEMENTED:${command.mode}`);
}

if (import.meta.main) {
	try {
		process.stdout.write(`${JSON.stringify(await runCutoverCli(process.argv.slice(2)))}\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : "CUTOVER_FAILED"}\n`);
		process.exitCode = 1;
	}
}
