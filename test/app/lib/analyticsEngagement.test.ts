/** @jest-environment jsdom */
import { startEngagementTracking } from "@/app/lib/analyticsEngagement";

it("measures focused active time, incremental depth and SPA routes without double-counting flushes", () => {
	let now = 0;
	jest.spyOn(performance, "now").mockImplementation(() => now);
	jest.spyOn(document, "hasFocus").mockReturnValue(true);
	Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
	Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 2000 });
	Object.defineProperty(window, "innerHeight", { configurable: true, value: 500 });
	Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
	const send = jest.fn();
	const cleanup = startEngagementTracking(send);
	window.dispatchEvent(new CustomEvent("clipify:analytics-pageview", { detail: { website: "site", url: "/dashboard" } }));
	now = 2000;
	window.dispatchEvent(new Event("blur"));
	expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ url: "/dashboard", name: "page_engagement", data: { active_ms: 2000, scroll_increment: 25 } }));
	now = 5000;
	window.dispatchEvent(new Event("pagehide"));
	expect(send).toHaveBeenCalledTimes(1);
	window.dispatchEvent(new Event("focus"));
	Object.defineProperty(window, "scrollY", { configurable: true, value: 1000 });
	window.dispatchEvent(new Event("scroll"));
	now = 6000;
	window.dispatchEvent(new CustomEvent("clipify:analytics-pageview", { detail: { website: "site", url: "/pricing" } }));
	expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ url: "/dashboard", data: { active_ms: 1000, scroll_increment: 50 } }));
	cleanup();
	const count = send.mock.calls.length;
	window.dispatchEvent(new Event("pagehide"));
	expect(send).toHaveBeenCalledTimes(count);
	jest.restoreAllMocks();
});

it("preserves automatic outbound, download and form coverage without collecting entered values", () => {
	const send = jest.fn();
	const cleanup = startEngagementTracking(send);
	window.dispatchEvent(new CustomEvent("clipify:analytics-pageview", { detail: { website: "site", url: "/pricing" } }));
	document.body.innerHTML = '<a href="https://help.clipify.us/article?token=secret">Help</a><a href="/file.zip?key=secret">Download</a><form><input name="email" value="private@example.com"></form>';
	document.querySelectorAll("a").forEach((link) => link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
	document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
	expect(send.mock.calls.map(([event]) => event).filter((event) => event.name !== "page_engagement")).toEqual([expect.objectContaining({ name: "Outbound Link: Click", data: { destination_host: "help.clipify.us", destination_path: "/article" } }), expect.objectContaining({ name: "File Download", data: { destination_path: "/file.zip" } }), expect.objectContaining({ name: "Form: Submission", data: {} })]);
	cleanup();
	document.body.innerHTML = "";
});
