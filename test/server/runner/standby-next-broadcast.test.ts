/** @jest-environment node */
const mockToken = jest.fn();
jest.mock("@/app/actions/twitch", () => ({ getAppAccessToken: () => mockToken() }));
import { readRunnerNextBroadcastInternal } from "@/server/runner/standby-next-broadcast";
const now = new Date("2026-10-19T12:00:00Z");
const fetchMock = jest.fn();
const originalFetch = global.fetch;
let malformedOwner = 20000;
beforeEach(() => {
	jest.clearAllMocks();
	global.fetch = fetchMock;
	mockToken.mockResolvedValue({ access_token: "fixture-token" });
});
afterAll(() => {
	global.fetch = originalFetch;
});
function response(segments: unknown[]) {
	return { ok: true, json: async () => ({ data: { segments } }) };
}
test("standby advertises the owner's Twitch schedule without requiring Runner automation", async () => {
	fetchMock.mockResolvedValue(response([{ start_time: "2026-10-20T12:00:00Z", canceled_until: null }]));
	expect(await readRunnerNextBroadcastInternal({ ownerId: "1234", runnerId: "unused" }, now)).toEqual({ startUtc: "2026-10-20T12:00:00.000Z" });
	expect(String(fetchMock.mock.calls[0][0])).toContain("broadcaster_id=1234");
});
test("current, canceled and malformed segments are not advertised", async () => {
	fetchMock.mockResolvedValue(response([null, { start_time: "bad" }, { start_time: now.toISOString() }, { start_time: "2026-10-20T12:00:00Z", canceled_until: "2026-10-20T13:00:00Z" }, { start_time: "2026-10-21T12:00:00Z" }]));
	expect(await readRunnerNextBroadcastInternal({ ownerId: "1235", runnerId: "unused" }, now)).toMatchObject({ startUtc: "2026-10-21T12:00:00.000Z" });
});
test.each([404, 429, 500])("Twitch HTTP %i hides the optional hint without breaking standby", async (status) => {
	fetchMock.mockResolvedValue({ ok: false, status });
	expect(await readRunnerNextBroadcastInternal({ ownerId: String(status), runnerId: "unused" }, now)).toBeNull();
});
test("network errors hide the hint", async () => {
	fetchMock.mockRejectedValue(new Error("offline"));
	expect(await readRunnerNextBroadcastInternal({ ownerId: "9876", runnerId: "unused" }, now)).toBeNull();
});
test("missing credentials do not request Twitch", async () => {
	mockToken.mockResolvedValue(null);
	expect(await readRunnerNextBroadcastInternal({ ownerId: "9877", runnerId: "unused" }, now)).toBeNull();
	expect(fetchMock).not.toHaveBeenCalled();
});
test("invalid clocks do not request Twitch", async () => {
	expect(await readRunnerNextBroadcastInternal({ ownerId: "9878", runnerId: "unused" }, new Date("invalid"))).toBeNull();
	expect(mockToken).not.toHaveBeenCalled();
});

test("concurrent preview and runtime reads share the channel response", async () => {
	fetchMock.mockResolvedValue(response([{ start_time: "2026-10-21T12:00:00Z" }]));
	const input = { ownerId: "9911", runnerId: "unused" };
	const [preview, runtime] = await Promise.all([readRunnerNextBroadcastInternal(input, now), readRunnerNextBroadcastInternal(input, now)]);
	expect(preview).toEqual(runtime);
	expect(preview).toMatchObject({ startUtc: "2026-10-21T12:00:00.000Z" });
	expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("a cached broadcast that has started is replaced by the next future broadcast", async () => {
	fetchMock.mockResolvedValueOnce(response([{ start_time: "2026-10-20T12:00:00Z" }])).mockResolvedValueOnce(response([{ start_time: "2026-10-21T12:00:00Z" }]));
	const input = { ownerId: "9912", runnerId: "unused" };
	await readRunnerNextBroadcastInternal(input, now);
	expect(await readRunnerNextBroadcastInternal(input, new Date("2026-10-20T12:00:00Z"))).toMatchObject({ startUtc: "2026-10-21T12:00:00.000Z" });
});
test("a short-lived empty response is shared rather than repeatedly calling Twitch", async () => {
	fetchMock.mockResolvedValue(response([]));
	const input = { ownerId: "9913", runnerId: "unused" };
	expect(await readRunnerNextBroadcastInternal(input, now)).toBeNull();
	expect(await readRunnerNextBroadcastInternal(input, now)).toBeNull();
	expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("broadcasts during a channel vacation are skipped", async () => {
	fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { timezone: "UTC", vacation: { start_time: "2026-10-20T00:00:00Z", end_time: "2026-10-21T00:00:00Z" }, segments: [{ start_time: "2026-10-20T12:00:00Z" }, { start_time: "2026-10-21T12:00:00Z" }] } }) });
	expect(await readRunnerNextBroadcastInternal({ ownerId: "9914", runnerId: "unused" }, now)).toEqual({ startUtc: "2026-10-21T12:00:00.000Z" });
});
test.each([{ data: null }, { data: { timezone: "UTC", segments: null } }, { data: { timezone: null, segments: [] } }, { data: { timezone: "invalid/timezone", segments: [] } }])("malformed schedule data hides the optional hint (%j)", async (body) => {
	fetchMock.mockResolvedValue({ ok: true, json: async () => body });
	expect(await readRunnerNextBroadcastInternal({ ownerId: String(malformedOwner++), runnerId: "unused" }, now)).toBeNull();
});
test("non-Twitch fixture identifiers never request an external channel", async () => {
	expect(await readRunnerNextBroadcastInternal({ ownerId: "fixture-creator", runnerId: "unused" })).toBeNull();
	expect(mockToken).not.toHaveBeenCalled();
});
test("the normal clock returns the earliest future broadcast for localized display", async () => {
	fetchMock.mockResolvedValue(response([{ start_time: "2099-01-02T12:00:00Z" }, { start_time: "2099-01-01T12:00:00Z" }]));
	expect(await readRunnerNextBroadcastInternal({ ownerId: "9915", runnerId: "unused" })).toEqual({ startUtc: "2099-01-01T12:00:00.000Z" });
});

test("schedule edits on Twitch become visible after the short cache expires", async () => {
	const clock = jest.spyOn(Date, "now").mockReturnValue(now.getTime());
	try {
		fetchMock.mockResolvedValueOnce(response([{ start_time: "2026-10-20T12:00:00Z" }])).mockResolvedValueOnce(response([{ start_time: "2026-10-22T12:00:00Z" }]));
		const input = { ownerId: "9916", runnerId: "unused" };
		await readRunnerNextBroadcastInternal(input, now);
		clock.mockReturnValue(now.getTime() + 10 * 60_000);
		expect(await readRunnerNextBroadcastInternal(input, now)).toMatchObject({ startUtc: "2026-10-22T12:00:00.000Z" });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	} finally {
		clock.mockRestore();
	}
});

test("accepts Twitch's documented schedule response without an invented timezone field", async () => {
	fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: { segments: [{ id: "segment-id", start_time: "2099-07-01T18:00:00Z", end_time: "2099-07-01T19:00:00Z", title: "Monthly update", canceled_until: null, category: null, is_recurring: false }], broadcaster_id: "141981764", broadcaster_name: "TwitchDev", broadcaster_login: "twitchdev", vacation: null }, pagination: {} }) });
	expect(await readRunnerNextBroadcastInternal({ ownerId: "141981764", runnerId: "unused" }, now)).toEqual({ startUtc: "2099-07-01T18:00:00.000Z" });
});
