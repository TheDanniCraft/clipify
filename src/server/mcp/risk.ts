import { workflowAnnotations } from "./workflows/catalogue";
import { workflowInputSchemas } from "./workflows/schemas";
import { toolInputSchemas, type ToolName } from "./schemas";
/** Hints describe effects; authorization must always run independently. */
export function toolAnnotations(name: ToolName) {
	if (!Object.prototype.hasOwnProperty.call(toolInputSchemas, name)) throw new Error("INVALID_INPUT");
	if (Object.hasOwn(workflowInputSchemas, name)) return workflowAnnotations(name as keyof typeof workflowInputSchemas);
	const read = name.startsWith("list_") || name.startsWith("get_");
	return {
		readOnlyHint: read,
		destructiveHint: name.startsWith("delete_") || name.startsWith("update_") || name === "remove_playlist_items" || name === "reorder_playlist_items",
		// Creates require a bounded retained retry key; this is not unlimited replay safety.
		idempotentHint: true,
		openWorldHint: name === "add_playlist_items",
	};
}
