/** @jest-environment node */
import { runInNewContext } from "node:vm";
import { GET } from "@/app/api/analytics/recorder/route";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

it("gives only the recorder a local transport without modifying upstream code or application fetch", async () => {
	const source = 'fetch("/statistics/api/record", {body:"native batch"}); window.recorderLoaded = true;';
	globalThis.fetch = jest.fn().mockResolvedValue(new Response(source));
	const response = await GET();
	expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("/recorder.js"), expect.objectContaining({ next: { revalidate: 3600 } }));
	const script = await response.text();
	expect(script).toContain(source);
	expect(response.headers.get("Content-Type")).toContain("application/javascript");
	const applicationFetch = jest.fn();
	const recorderFetch = jest.fn();
	const window = { fetch: applicationFetch, clipifyRecorderFetch: recorderFetch, recorderLoaded: false };
	runInNewContext(script, { window, fetch: applicationFetch });
	expect(recorderFetch).toHaveBeenCalledWith("/statistics/api/record", { body: "native batch" });
	expect(applicationFetch).not.toHaveBeenCalled();
	expect(window.fetch).toBe(applicationFetch);
	expect(window.recorderLoaded).toBe(true);
	const missingHook = { fetch: applicationFetch, recorderLoaded: false };
	runInNewContext(script, { window: missingHook, fetch: applicationFetch });
	expect(missingHook.recorderLoaded).toBe(false);
	expect(applicationFetch).not.toHaveBeenCalled();
});

it.each(["http", "network"])("does not serve an unwrapped script after an upstream %s failure", async (failure) => {
	globalThis.fetch = failure === "http" ? jest.fn().mockResolvedValue(new Response("upstream error", { status: 500 })) : jest.fn().mockRejectedValue(new Error("unavailable"));
	const response = await GET();
	expect(response.status).toBe(502);
	expect(await response.text()).toBe("");
});
