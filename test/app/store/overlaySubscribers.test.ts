import { addSubscriber, overlaySubscribers, removeSubscriber } from "@/app/store/overlaySubscribers";

describe("store/overlaySubscribers", () => {
	beforeEach(() => {
		overlaySubscribers.clear();
	});

	it("adds subscribers for broadcaster keys", () => {
		const ws = {} as never;
		addSubscriber("owner-1", ws);
		expect(overlaySubscribers.get("owner-1")?.has(ws)).toBe(true);
	});

	it("removes subscribers and deletes empty broadcaster buckets", () => {
		const ws = {} as never;
		addSubscriber("owner-1", ws);
		removeSubscriber("owner-1", ws);
		expect(overlaySubscribers.has("owner-1")).toBe(false);
	});

	it("is no-op when removing a missing subscriber", () => {
		const ws = {} as never;
		expect(() => removeSubscriber("missing", ws)).not.toThrow();
	});
});
