import { workflowPermissions } from "./workflows/catalogue";
export const MCP_SCOPES = [...new Set(Object.values(workflowPermissions)), "creator:read", "overlay:read", "overlay:create", "overlay:update", "overlay:delete", "playlist:read", "playlist:create", "playlist:update", "playlist:delete", "playlist-items:manage", "feedback:create"] as const;
const READ_SCOPES = ["creator:read", "overlay:read", "playlist:read", "gallery:read", "runner:read"];
export function consentPreset(preset: "read" | "edit"): string[] {
	return preset === "read" ? [...READ_SCOPES] : [...READ_SCOPES, "overlay:create", "overlay:update", "playlist:create", "playlist:update", "playlist-items:manage", "gallery:create", "gallery:update", "runner:update"];
}
export function validateSelectedScopes(selected: readonly string[], requested: readonly string[]): string[] {
	const supported: readonly string[] = [...MCP_SCOPES, "offline_access"];
	if (!selected.length || selected.some((scope) => !supported.includes(scope) || !requested.includes(scope))) throw new Error("INVALID_INPUT");
	return [...new Set(selected)];
}
