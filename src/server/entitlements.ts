export type CreatorResourceInventory = { overlays: string[]; playlists: string[]; galleries: string[]; runners: string[] };
export type DowngradeEffects = {
	retained: CreatorResourceInventory;
	deleted: CreatorResourceInventory;
	capabilities: { resourceRead: true; advancedOverlayMutation: boolean; additionalOverlayMutation: boolean; runnerControl: boolean };
	restrictions: string[];
};

const none = (): CreatorResourceInventory => ({ overlays: [], playlists: [], galleries: [], runners: [] });

export function deriveDowngradeEffects(input: { inventory: CreatorResourceInventory; effectivePlan: "free" | "pro"; runnerAccess: boolean; source?: string }): DowngradeEffects {
	const pro = input.effectivePlan === "pro";
	const restrictions: string[] = [];
	if (!pro && input.inventory.overlays.length > 1) restrictions.push("extra-overlays-read-only");
	if (!pro && input.inventory.playlists.length > 1) restrictions.push("extra-playlists-read-only");
	if (!pro) restrictions.push("advanced-overlay-settings-read-only");
	if (!input.runnerAccess && input.inventory.runners.length > 0) restrictions.push("runner-control-disabled");
	return {
		retained: structuredClone(input.inventory),
		deleted: none(),
		capabilities: { resourceRead: true, advancedOverlayMutation: pro, additionalOverlayMutation: pro, runnerControl: input.runnerAccess },
		restrictions,
	};
}

export async function applyDowngradeEffects(effects: DowngradeEffects, operations: { deleteResource: (type: keyof CreatorResourceInventory, id: string) => Promise<void> | void; pauseRuntime: (input: { runners: string[] }) => Promise<void> | void; markReconciled: () => Promise<void> | void }) {
	// Deletion is intentionally absent: retained data becomes readable but
	// unsupported mutations and runtime controls are capability-gated.
	void operations.deleteResource;
	if (!effects.capabilities.runnerControl && effects.retained.runners.length > 0) await operations.pauseRuntime({ runners: effects.retained.runners });
	await operations.markReconciled();
}
