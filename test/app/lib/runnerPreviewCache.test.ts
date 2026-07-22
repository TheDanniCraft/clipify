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
