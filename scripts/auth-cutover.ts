import { parseCutoverCommand } from "./auth-cutover/state-machine";

export function runCutoverCli(argv: string[]) {
	const command = parseCutoverCommand(argv);
	return { ...command, accepted: true as const };
}

if (import.meta.main) {
	try {
		process.stdout.write(`${JSON.stringify(runCutoverCli(process.argv.slice(2)))}\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : "CUTOVER_FAILED"}\n`);
		process.exitCode = 1;
	}
}
