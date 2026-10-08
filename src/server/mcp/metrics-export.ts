import "server-only";
import type { McpMetricsSnapshot } from "./metrics";
/** Collector contract: flatten fixed numeric paths only; never use process IDs as tags. */
export function flattenMcpMetrics(snapshot: McpMetricsSnapshot): Record<string, number> {
	const fields: Record<string, number> = {};
	function visit(value: unknown, path: string) {
		if (typeof value === "number" && Number.isFinite(value)) fields[path] = value;
		else if (value && typeof value === "object") for (const [key, child] of Object.entries(value)) visit(child, `${path}_${key}`);
	}
	visit(snapshot, "mcp");
	fields.mcp_processStartedAtUnixSeconds = Date.parse(snapshot.processStartedAt) / 1000;
	fields.mcp_sampledAtUnixSeconds = Date.parse(snapshot.sampledAt) / 1000;
	return fields;
}

/** Export every application; arbitrary names remain field values, never tags. */
export function flattenMcpClientStats(stats: import("./client-stats").McpClientStats | null): Record<string, number | string> {
	const fields: Record<string, number | string> = { mcp_clients_available: stats ? 1 : 0 };
	for (const key of ["registeredClients", "authorizedClients", "activeClients30d", "calls30d", "applicationNames"] as const) fields[`mcp_clients_${key}`] = stats?.summary[key] ?? 0;
	fields.mcp_clients_sampledAtUnixSeconds = stats ? Date.parse(stats.sampledAt) / 1000 : 0;
	for (let rank = 1; rank <= (stats?.items.length ?? 0); rank++) {
		const item = stats?.items[rank - 1];
		fields[`mcp_clients_app_${rank}_name`] = item?.name ?? "";
		for (const key of ["registeredClients", "authorizedClients", "activeConnections", "activeClients30d", "calls30d"] as const) fields[`mcp_clients_app_${rank}_${key}`] = item?.[key] ?? 0;
	}
	return fields;
}
