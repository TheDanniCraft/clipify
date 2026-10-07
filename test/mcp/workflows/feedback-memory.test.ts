/** @jest-environment node */
export {};
let Cache: typeof import("@/server/resources/feedback-replay").FeedbackReplayCache;
const input = { creatorId: "creator", kind: "bug" as const, message: "Queue stopped", retryKey: "one" };
const receipt = "1".repeat(32);
beforeEach(() => {
	jest.resetModules();
	jest.useFakeTimers({ now: 1000 });
	Cache = require("@/server/resources/feedback-replay").FeedbackReplayCache;
});
afterEach(() => jest.useRealTimers());
test("five reports share one library budget across creators; a sixth is refused", async () => {
	const store = new Cache(),
		send = jest.fn(() => receipt);
	for (let i = 0; i < 5; i++) await store.submit("user", { ...input, creatorId: `creator${i}`, retryKey: `key${i}` }, send);
	await expect(store.submit("user", { ...input, message: "sixth" }, send)).rejects.toThrow("RATE_LIMITED");
	expect(send).toHaveBeenCalledTimes(5);
	expect((await store.submit("other-user", input, send)).duplicate).toBe(false);
});
test("retries and equal normalized content do not consume additional capacity", async () => {
	const store = new Cache(),
		send = jest.fn(() => receipt);
	expect((await store.submit("user", input, send)).duplicate).toBe(false);
	expect(await store.submit("user", input, send)).toMatchObject({ receiptId: receipt, duplicate: true });
	expect((await store.submit("user", { ...input, retryKey: "new-key" }, send)).duplicate).toBe(true);
	await expect(store.submit("user", { ...input, retryKey: "new-key", message: "changed after deduplication" }, send)).rejects.toThrow("RETRY_CONFLICT");
	await expect(store.submit("user", { ...input, message: "different" }, send)).rejects.toThrow("RETRY_CONFLICT");
	expect(send).toHaveBeenCalledTimes(1);
});
test("library budgets and retries reset after 24 hours", async () => {
	const store = new Cache(),
		send = jest.fn(() => receipt);
	await store.submit("user", input, send);
	jest.advanceTimersByTime(86400000);
	expect((await store.submit("user", input, send)).duplicate).toBe(false);
	expect(send).toHaveBeenCalledTimes(2);
});
test("the shared fixed window resets while later replay receipts remain usable", async () => {
	const store = new Cache(),
		send = jest.fn(() => receipt);
	for (let index = 0; index < 5; index++) {
		if (index === 2) jest.advanceTimersByTime(1000);
		await store.submit("user", { ...input, message: `Report ${index}`, retryKey: `key-${index}` }, send);
	}
	jest.advanceTimersByTime(86399000);
	expect((await store.submit("user", { ...input, message: "Report 4", retryKey: "key-4" }, send)).duplicate).toBe(true);
	for (let index = 5; index < 10; index++) await store.submit("user", { ...input, message: `Report ${index}`, retryKey: `key-${index}` }, send);
	await expect(store.submit("user", { ...input, message: "Too soon", retryKey: "next" }, send)).rejects.toThrow("RATE_LIMITED");
	expect(send).toHaveBeenCalledTimes(10);
});
test("a full bounded replay cache refuses new users without evicting existing receipts", async () => {
	const store = new Cache(1),
		send = jest.fn(() => receipt);
	await store.submit("user", input, send);
	await expect(store.submit("other", input, send)).rejects.toThrow("SERVICE_UNAVAILABLE");
	expect((await store.submit("user", input, send)).duplicate).toBe(true);
	jest.advanceTimersByTime(86400000);
	expect((await store.submit("other", input, send)).duplicate).toBe(false);
});
test("fresh retry aliases are bounded without blocking the original retry", async () => {
	const store = new Cache(),
		send = jest.fn(() => receipt);
	await store.submit("user", input, send);
	for (let index = 0; index < 4; index++) expect((await store.submit("user", { ...input, retryKey: `alias-${index}` }, send)).duplicate).toBe(true);
	await expect(store.submit("user", { ...input, retryKey: "alias-overflow" }, send)).rejects.toThrow("RATE_LIMITED");
	expect((await store.submit("user", input, send)).duplicate).toBe(true);
	expect(send).toHaveBeenCalledTimes(1);
});
test.each([
	() => {
		throw new Error("private transport detail");
	},
	() => "",
])("submission failures refund the shared point and retain no false receipt", async (send) => {
	const store = new Cache();
	for (let index = 0; index < 5; index++) await expect(store.submit("user", input, send)).rejects.toThrow();
	const accepted = jest.fn(() => receipt);
	for (let index = 0; index < 5; index++) expect((await store.submit("user", { ...input, message: `Report ${index}`, retryKey: `key-${index}` }, accepted)).duplicate).toBe(false);
	expect(accepted).toHaveBeenCalledTimes(5);
});
test("concurrent retries submit exactly once", async () => {
	const store = new Cache(),
		send = jest.fn(() => receipt);
	const results = await Promise.all(Array.from({ length: 5 }, () => store.submit("user", input, send)));
	expect(results.filter((row) => !row.duplicate)).toHaveLength(1);
	expect(results.map((row) => row.receiptId)).toEqual(Array(5).fill(receipt));
	expect(send).toHaveBeenCalledTimes(1);
});
test("a failed queued request does not poison the next retry", async () => {
	const store = new Cache();
	const first = store.submit("user", input, () => {
		throw new Error("failed");
	});
	const second = store.submit("user", input, () => receipt);
	const result = await Promise.allSettled([first, second]);
	expect(result[0].status).toBe("rejected");
	expect(result[1]).toMatchObject({ status: "fulfilled", value: { receiptId: receipt, duplicate: false } });
});
test("pending users are bounded while an existing user can still retry", async () => {
	const store = new Cache(1),
		send = jest.fn(() => receipt);
	const first = store.submit("user", input, send);
	await expect(store.submit("other", input, send)).rejects.toThrow("SERVICE_UNAVAILABLE");
	expect((await first).duplicate).toBe(false);
	expect((await store.submit("user", input, send)).duplicate).toBe(true);
});
