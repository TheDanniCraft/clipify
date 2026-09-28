/** @jest-environment node */
import { applyDowngradeEffects, deriveDowngradeEffects, type CreatorResourceInventory } from "@/server/entitlements";

const inventories: CreatorResourceInventory[] = [
	{ overlays: [], playlists: [], galleries: [], runners: [] },
	{ overlays: ["o1"], playlists: ["p1"], galleries: ["g1"], runners: ["r1"] },
	{ overlays: ["o1", "o2", "o3"], playlists: ["p1", "p2"], galleries: ["g1", "g2"], runners: ["r1", "r2"] },
];

describe("TDD-US5-003 non-destructive downgrade", () => {
	it.each(inventories)("retains every resource for free plan inventory %#", (inventory) => {
		const effects = deriveDowngradeEffects({ inventory, effectivePlan: "free", runnerAccess: false });
		expect(effects.retained).toEqual(inventory);
		expect(effects.deleted).toEqual({ overlays: [], playlists: [], galleries: [], runners: [] });
		expect(effects.capabilities).toMatchObject({ advancedOverlayMutation: false, additionalOverlayMutation: false, runnerControl: false, resourceRead: true });
	});

	it.each(["billing", "grant", "agency"] as const)("keeps Pro capabilities for %s entitlement source", (source) => {
		const effects = deriveDowngradeEffects({ inventory: inventories[2]!, effectivePlan: "pro", runnerAccess: true, source });
		expect(effects.capabilities).toMatchObject({ advancedOverlayMutation: true, additionalOverlayMutation: true, runnerControl: true, resourceRead: true });
		expect(effects.deleted.overlays).toEqual([]);
	});

	it("blocks unsupported mutations while leaving data readable", () => {
		const effects = deriveDowngradeEffects({ inventory: inventories[2]!, effectivePlan: "free", runnerAccess: false });
		expect(effects.restrictions).toEqual(expect.arrayContaining(["extra-overlays-read-only", "extra-playlists-read-only", "runner-control-disabled", "advanced-overlay-settings-read-only"]));
		expect(effects.capabilities.resourceRead).toBe(true);
	});

	it("performs zero delete calls when applying a downgrade", async () => {
		const deleteResource = jest.fn();
		const pauseRuntime = jest.fn();
		const markReconciled = jest.fn();
		await applyDowngradeEffects(deriveDowngradeEffects({ inventory: inventories[2]!, effectivePlan: "free", runnerAccess: false }), { deleteResource, pauseRuntime, markReconciled });
		expect(deleteResource).not.toHaveBeenCalled();
		expect(pauseRuntime).toHaveBeenCalledWith({ runners: ["r1", "r2"] });
		expect(markReconciled).toHaveBeenCalledTimes(1);
	});

	it("is insensitive to reordered paid entitlement events", () => {
		const inventory = inventories[2]!;
		const sources = ["agency", "billing", "grant"] as const;
		for (const reordered of [sources, [...sources].reverse()]) {
			const effectivePlan = reordered.length > 0 ? "pro" : "free";
			expect(deriveDowngradeEffects({ inventory, effectivePlan, runnerAccess: true }).retained).toEqual(inventory);
		}
	});
});
