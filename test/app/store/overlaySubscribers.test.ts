import { addSubscriber, overlaySubscribers, ownerSubscribers, removeSubscriber } from "@/app/store/overlaySubscribers";

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
