import { createHash } from "node:crypto";
import { buildManifest } from "./manifest";

export { buildManifest } from "./manifest";

export type CutoverMode = "dry-run" | "apply" | "resume" | "validate" | "smoke";
export type CutoverStatus = "created" | "preflighted" | "backup_verified" | "migrating" | "validated" | "switched" | "reopened" | "contracted" | "maintenance_blocked";
export type CutoverRun = { id: string; status: CutoverStatus; maintenance: boolean; checkpoints: Record<string, number> };

const transitions: Record<CutoverStatus, readonly CutoverStatus[]> = {
	created: ["preflighted", "maintenance_blocked"],
	preflighted: ["backup_verified", "maintenance_blocked"],
	backup_verified: ["migrating", "maintenance_blocked"],
	migrating: ["validated", "maintenance_blocked"],
	validated: ["switched", "maintenance_blocked"],
	switched: ["reopened", "maintenance_blocked"],
	reopened: ["contracted"],
	contracted: [],
	maintenance_blocked: [],
};

export function transitionCutover(run: CutoverRun, next: CutoverStatus): CutoverRun {
	if (!transitions[run.status].includes(next)) throw new Error(`ILLEGAL_CUTOVER_TRANSITION:${run.status}:${next}`);
	const enteringMaintenance = next === "migrating" || next === "maintenance_blocked";
	const maintenance = next === "reopened" || next === "contracted" ? false : enteringMaintenance || run.maintenance;
	return { ...run, status: next, maintenance };
}

export function checkpointIdempotencyKey(runId: string, phase: string, cursor: number): string {
	return createHash("sha256").update(`${runId}\u0000${phase}\u0000${cursor}`, "utf8").digest("hex");
}

export async function executeCheckpointBatch<T>(input: { runId: string; phase: string; cursor: number; values: T[]; transaction: <R>(operation: (writer: { write: (value: T) => void | Promise<void> }) => Promise<R>) => Promise<R>; onCommitted: (nextCursor: number, idempotencyKey: string) => void | Promise<void>; isCommitted?: (idempotencyKey: string) => boolean | Promise<boolean> }) {
	const nextCursor = input.cursor + input.values.length;
	const key = checkpointIdempotencyKey(input.runId, input.phase, nextCursor);
	if (await input.isCommitted?.(key)) return { nextCursor, idempotencyKey: key, skipped: true as const };
	await input.transaction(async (writer) => {
		for (const value of input.values) await writer.write(value);
	});
	await input.onCommitted(nextCursor, key);
	return { nextCursor, idempotencyKey: key, skipped: false as const };
}

const modes = new Set<CutoverMode>(["dry-run", "apply", "resume", "validate", "smoke"]);
const forbiddenArgument = /(?:password|passwd|secret|token|credential|database-url|connection-string)/i;

export function parseCutoverCommand(argv: string[]): { mode: CutoverMode } {
	for (const argument of argv) if (forbiddenArgument.test(argument)) throw new Error("CREDENTIAL_ARGUMENT_FORBIDDEN");
	const mode = argv[0] as CutoverMode | undefined;
	if (!mode || !modes.has(mode) || argv.length !== 1) throw new Error("INVALID_CUTOVER_COMMAND");
	return { mode };
}

export function createCutoverManifest(input: Parameters<typeof buildManifest>[0]) {
	return buildManifest(input);
}
