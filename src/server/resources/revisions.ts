/** Called only after locking the resource row in its mutation transaction. */
export function nextConfigurationRevision(current: number, expected: unknown): number {
	if (typeof expected !== "number" || !Number.isInteger(expected) || expected < 1 || expected > 2_147_483_647) throw new Error("INVALID_INPUT");
	if (!Number.isInteger(current) || current < 1 || current !== expected || current >= 2_147_483_647) throw new Error("REVISION_CONFLICT");
	return current + 1;
}
