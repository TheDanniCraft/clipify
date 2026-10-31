/** @jest-environment node */
import { filterHeatmapRequest, installRecorderFetch } from "@/app/lib/heatmapRequests";
import { setBrowserMeasurementConsent } from "@/app/lib/consent/browserMeasurement";

const origin = "https://clipify.us";
const event = (url = "/pricing") => ({ type: "click", url: origin + url, timestamp: Date.now() });
const body = (events: unknown[]) => JSON.stringify({ type: "heatmap", payload: { website: "fixture", events, timestamp: 123 } });
beforeEach(() => setBrowserMeasurementConsent(true));
afterEach(() => {
	setBrowserMeasurementConsent(false);
	jest.useRealTimers();
});

it("keeps only approved public events in mixed native batches", () => {
	const result = filterHeatmapRequest(body([event(), event("/dashboard/overlay/private"), event("/community"), event("/?code=secret"), event("/legal/privacy")]), "fixture", origin + "/features");
	expect(JSON.parse(result!).payload.events.map((e: { url: string }) => e.url)).toEqual([origin + "/pricing", origin + "/community"]);
});
it.each(["/", "/features", "/pricing", "/community", "/changelog", "/roadmap"])("allows public heatmaps at %s", (path) => {
	expect(filterHeatmapRequest(body([event(path)]), "fixture", origin + path)).not.toBeNull();
});
it.each(["/dashboard", "/login", "/gallery/demo", "/creators/example", "/?token=secret"])("discards the entire send on excluded current route %s", (path) => {
	expect(filterHeatmapRequest(body([event()]), "fixture", origin + path)).toBeNull();
});
it("drops events from before the current grant, including revoke/reaccept before a buffered send", () => {
	jest.useFakeTimers().setSystemTime(1000);
	setBrowserMeasurementConsent(false);
	setBrowserMeasurementConsent(true);
	const old = event();
	jest.setSystemTime(2000);
	setBrowserMeasurementConsent(false);
	setBrowserMeasurementConsent(true);
	const current = event();
	expect(JSON.parse(filterHeatmapRequest(body([old, current]), "fixture", origin + "/")!).payload.events).toEqual([current]);
	setBrowserMeasurementConsent(false);
	expect(filterHeatmapRequest(body([current]), "fixture", origin + "/")).toBeNull();
});
it.each(["not json", JSON.stringify({ type: "record", payload: { website: "fixture", events: [] } }), body([{ ...event(), url: "https://other.invalid/pricing" }]), body([{ ...event(), timestamp: undefined }]), body([])])("fails closed on unsupported or empty recorder payload %s", (input) => {
	expect(filterHeatmapRequest(input, "fixture", origin + "/")).toBeNull();
});
it("does not accept another website's recording", () => {
	expect(filterHeatmapRequest(body([event()]), "another-site", origin + "/")).toBeNull();
});
it("isolates recorder filtering without replacing the application fetch", async () => {
	const original = jest.fn().mockResolvedValue(new Response("ok"));
	const fakeWindow = { fetch: original, location: new URL(origin + "/pricing") };
	Object.defineProperty(globalThis, "window", { value: fakeWindow, configurable: true });
	try {
		installRecorderFetch("fixture");
		expect(fakeWindow.fetch).toBe(original);
		await window.clipifyRecorderFetch!("/statistics/api/send", { method: "POST", body: "baseline" });
		expect(original).toHaveBeenLastCalledWith("/statistics/api/send", { method: "POST", body: "baseline" });
		await window.clipifyRecorderFetch!("/statistics/api/record", { method: "POST", body: body([event(), event("/dashboard")]) });
		expect(JSON.parse(original.mock.calls.at(-1)![1].body).payload.events).toHaveLength(1);
		original.mockClear();
		setBrowserMeasurementConsent(false);
		expect((await window.clipifyRecorderFetch!("/statistics/api/record", { method: "POST", body: body([event()]) })).status).toBe(204);
		expect(original).not.toHaveBeenCalled();
	} finally {
		delete (globalThis as { window?: unknown }).window;
	}
});
