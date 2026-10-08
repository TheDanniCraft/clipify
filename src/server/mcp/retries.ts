import { createHash } from "node:crypto";
import { toolInputSchemas } from "./schemas";

/** Validate and normalize intent before reserving a create retry. */
export function canonicalCreateDigest(tool: "create_overlay" | "create_playlist", rawInput: unknown): string {
	const parsed = toolInputSchemas[tool].safeParse(rawInput);
	if (!parsed.success) throw new Error("INVALID_INPUT");
	const input = parsed.data;
	const intent = { creatorId: input.creatorId, name: input.name ?? "New Overlay" };
	return createHash("sha256")
		.update(JSON.stringify({ tool, ...intent }))
		.digest("hex");
}
