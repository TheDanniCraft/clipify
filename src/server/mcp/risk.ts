import { mcpToolCatalogue } from "./catalogue";
import type { ToolName } from "./schemas";

/** Hints describe effects; authorization must always run independently. */
export function toolAnnotations(name: ToolName) {
	if (!Object.hasOwn(mcpToolCatalogue, name)) throw new Error("INVALID_INPUT");
	return { ...mcpToolCatalogue[name].annotations };
}
