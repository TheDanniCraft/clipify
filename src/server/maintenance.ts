import "server-only";

import { db } from "@/db/client";
import { migrationRunsTable } from "@/db/schema";
import { desc } from "drizzle-orm";

export type MaintenanceState = { enabled: boolean; runId: string | null; reason: string | null };
export interface MaintenanceStore {
	read(): Promise<MaintenanceState>;
	write(state: MaintenanceState): Promise<void>;
}

type PersistedCutoverStatus = (typeof migrationRunsTable.$inferSelect)["status"];
const maintenanceStatuses = new Set<PersistedCutoverStatus>(["migrating", "validated", "switched", "maintenance_blocked"]);

export function requiresCutoverMaintenance(status: PersistedCutoverStatus): boolean {
	return maintenanceStatuses.has(status);
}

export async function isAuthCutoverMaintenanceActive(): Promise<boolean> {
	const rows = await db.select({ status: migrationRunsTable.status }).from(migrationRunsTable).orderBy(desc(migrationRunsTable.updatedAt)).limit(1).execute();
	return rows[0] ? requiresCutoverMaintenance(rows[0].status) : false;
}

export async function enterCutoverMaintenance(store: MaintenanceStore, runId: string) {
	await store.write({ enabled: true, runId, reason: "auth-cutover" });
}

export async function reopenAfterCutover(store: MaintenanceStore, input: { runId: string; validated: boolean; smokePassed: boolean }) {
	const state = await store.read();
	if (!state.enabled || state.runId !== input.runId || !input.validated || !input.smokePassed) throw new Error("CUTOVER_REOPEN_DENIED");
	await store.write({ enabled: false, runId: input.runId, reason: null });
}
