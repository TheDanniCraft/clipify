import { parseExecutionPublicKeys } from "./src/execution-keys.ts";

export function runnerExecutionKeyDefines(raw) {
	const keys = parseExecutionPublicKeys(raw);
	return { "process.env.BAKED_RUNNER_EXECUTION_PUBLIC_KEYS": JSON.stringify(JSON.stringify(keys)) };
}
