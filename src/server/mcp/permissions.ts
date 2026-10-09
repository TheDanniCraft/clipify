import { mcpToolCatalogue } from "./catalogue";
import type { Permission } from "@/auth/permissions";
import type { ToolName } from "./schemas";

export const toolPermissions = Object.fromEntries(Object.entries(mcpToolCatalogue).map(([name, tool]) => [name, tool.permission])) as Record<ToolName, Permission>;
