import { mcpToolCatalogue } from "@/server/mcp/catalogue";

/** Data-only catalog projection; no server handlers or schemas enter the activity UI. */
export const mcpOperationLabels: Record<string, string> = Object.fromEntries(Object.entries(mcpToolCatalogue).map(([name, tool]) => [name, tool.title]));
