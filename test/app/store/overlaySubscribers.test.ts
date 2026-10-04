import { disconnectOverlaySources, getActiveOverlayOwnerIds, addSubscriber, overlaySubscribers, ownerSubscribers, removeSubscriber } from "@/app/store/overlaySubscribers";

describe("store/overlaySubscribers", () => {
	beforeEach(() => {
		overlaySubscribers.clear();
		ownerSubscribers.clear();
	});

	it("adds subscribers for owner + overlay keys", () => {
		const ws = {} as never;
		addSubscriber("owner-1", "overlay-1", ws);
		expect(ownerSubscribers.get("owner-1")?.has(ws)).toBe(true);
		expect(overlaySubscribers.get("overlay-1")?.has(ws)).toBe(true);
	});

	it("removes subscribers and deletes empty buckets", () => {
		const ws = {} as never;
		addSubscriber("owner-1", "overlay-1", ws);
		removeSubscriber("owner-1", "overlay-1", ws);
		expect(ownerSubscribers.has("owner-1")).toBe(false);
		expect(overlaySubscribers.has("overlay-1")).toBe(false);
	});

	it("is no-op when removing a missing subscriber", () => {
		const ws = {} as never;
		expect(() => removeSubscriber("missing-owner", "missing-overlay", ws)).not.toThrow();
	});
});

describe("in-memory overlay presence", () => {
	beforeEach(() => {
		ownerSubscribers.clear();
		overlaySubscribers.clear();
	});
	it("counts a live owner while any overlay connection is active", () => {
		const active = { role: "overlay", readyState: 1, sourceActive: true } as never;
		const preview = { role: "overlay", readyState: 1, sourceActive: false } as never;
		addSubscriber("owner", "overlay", active);
		addSubscriber("owner", "overlay", preview);
		expect(getActiveOverlayOwnerIds()).toEqual(new Set(["owner"]));
		removeSubscriber("owner", "overlay", preview);
		expect(getActiveOverlayOwnerIds()).toEqual(new Set(["owner"]));
		removeSubscriber("owner", "overlay", active);
		expect(getActiveOverlayOwnerIds()).toEqual(new Set());
	});
	it("ignores unknown, controller, closing, and closed connections", () => {
		for (const client of [
			{ role: "overlay", readyState: 1 },
			{ role: "controller", readyState: 1, sourceActive: true },
			{ role: "overlay", readyState: 2, sourceActive: true },
			{ role: "overlay", readyState: 3, sourceActive: true },
		])
			addSubscriber("owner", "overlay", client as never);
		expect(getActiveOverlayOwnerIds()).toEqual(new Set());
	});
});

it("disconnects only sources for the paused overlay while preserving controllers and other active overlays", () => {
	ownerSubscribers.clear();
	overlaySubscribers.clear();
	const source = { ownerId: "owner", role: "overlay", readyState: 1, sourceActive: true, close: jest.fn() };
	const controller = { ownerId: "owner", role: "controller", readyState: 1, close: jest.fn() };
	const other = { ownerId: "owner", role: "overlay", readyState: 1, sourceActive: true, close: jest.fn() };
	addSubscriber("owner", "paused-overlay", source as never);
	addSubscriber("owner", "paused-overlay", controller as never);
	addSubscriber("owner", "other-overlay", other as never);
	disconnectOverlaySources("paused-overlay");
	expect(source.sourceActive).toBe(false);
	expect(source.close).toHaveBeenCalledWith(4002);
	expect(overlaySubscribers.get("paused-overlay")).toEqual(new Set([controller]));
	expect(ownerSubscribers.get("owner")).toEqual(new Set([controller, other]));
	expect(controller.close).not.toHaveBeenCalled();
	expect(other.close).not.toHaveBeenCalled();
	expect(getActiveOverlayOwnerIds()).toEqual(new Set(["owner"]));
	disconnectOverlaySources("missing-overlay");
	ownerSubscribers.clear();
	overlaySubscribers.clear();
});
