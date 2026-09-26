import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { InventoryFinding, InventoryEvidence } from "./inventoryAudit";

export async function writeInventoryEvidence(path: string, payload: { result: "pass" | "fail"; evidence: readonly InventoryEvidence[]; differences: readonly InventoryFinding[] }) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}
