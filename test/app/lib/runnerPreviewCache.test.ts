import { RunnerPreviewCache } from "@lib/runnerPreviewCache";

describe("RunnerPreviewCache", () => {
	it("removes expired frames when they are read", () => {
		let now = 1_000;
		const cache = new RunnerPreviewCache(15_000, 100, () => now);
		cache.set("runner-1", "frame");

		now += 15_001;

		expect(cache.get("runner-1")).toBeNull();
		expect(cache.entryCount).toBe(0);
		expect(cache.sizeBytes).toBe(0);
	});

	it("evicts the oldest frames to remain within the byte budget", () => {
		let now = 1_000;
		const cache = new RunnerPreviewCache(60_000, 10, () => now);
		cache.set("runner-1", "123456");
		now++;
		cache.set("runner-2", "abcdef");

		expect(cache.get("runner-1")).toBeNull();
		expect(cache.get("runner-2")).toBe("abcdef");
		expect(cache.sizeBytes).toBe(6);
	});

	it("accounts for replacements without inflating the cache size", () => {
		const cache = new RunnerPreviewCache(60_000, 10);
		cache.set("runner-1", "123456");
		cache.set("runner-1", "abc");

		expect(cache.entryCount).toBe(1);
		expect(cache.sizeBytes).toBe(3);
	});
});
describe("TDD-US5-CACHE shared snapshot metadata", () => {
	it("keeps capture time, overlay identity and runner revision with the frame", () => {
		const cache = new RunnerPreviewCache(15_000, 100, () => 1_000);
		expect((cache as any).getEntry).toEqual(expect.any(Function));
		(cache.set as any)("runner-1", "frame", { overlayId: "overlay-1", runnerRevision: 2 });
		expect((cache as any).getEntry("runner-1")).toMatchObject({ image: "frame", timestamp: 1000, overlayId: "overlay-1", runnerRevision: 2 });
	});
	it("releases bytes when an enrolled runner is removed", () => {
		const cache = new RunnerPreviewCache(15_000, 100);
		cache.set("runner-1", "frame");
		expect((cache as any).delete).toEqual(expect.any(Function));
		(cache as any).delete("runner-1");
		expect(cache.sizeBytes).toBe(0);
		expect(cache.get("runner-1")).toBeNull();
	});
});
