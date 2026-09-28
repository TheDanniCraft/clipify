import "server-only";

export type MaintenanceState = { enabled: boolean; runId: string | null; reason: string | null };
export interface MaintenanceStore {
	read(): Promise<MaintenanceState>;
	write(state: MaintenanceState): Promise<void>;
}

export async function enterCutoverMaintenance(store: MaintenanceStore, runId: string) {
	await store.write({ enabled: true, runId, reason: "auth-cutover" });
}

export async function reopenAfterCutover(store: MaintenanceStore, input: { runId: string; validated: boolean; smokePassed: boolean }) {
	const state = await store.read();
	if (!state.enabled || state.runId !== input.runId || !input.validated || !input.smokePassed) throw new Error("CUTOVER_REOPEN_DENIED");
	await store.write({ enabled: false, runId: input.runId, reason: null });
}
