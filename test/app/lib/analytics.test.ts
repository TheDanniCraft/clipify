/** @jest-environment jsdom */
import { prepareUmamiPayload, setAnalyticsContext, trackEvent, trackProductEvent } from "@/app/lib/analytics";
import { setBrowserMeasurementConsent } from "@/app/lib/consent/browserMeasurement";

afterEach(() => {
	setBrowserMeasurementConsent(false);
	Reflect.deleteProperty(window, "umami");
});

it.each([
	["/dashboard/overlay/private-overlay/theme", "/dashboard/overlay/:id/theme"],
	["/dashboard/playlist/private-playlist", "/dashboard/playlist/:id"],
	["/dashboard/runner/private-runner", "/dashboard/runner/:id"],
	["/dashboard/runners/private-runner", "/dashboard/runners/:id"],
	["/dashboard/galleries/private-gallery/preview/clip/private-clip", "/dashboard/galleries/:id/preview/clip/:id"],
	["/dashboard/streams/private-stream", "/dashboard/streams/:id"],
	["/dashboard/clips/private-clip", "/dashboard/clips/:id"],
	["/dashboard/clip-layouts/private-layout", "/dashboard/clip-layouts/:id"],
])("groups private editor URL %s without dropping its pageview", (url, normalized) => {
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url })).toMatchObject({ url: normalized, tag: "application" });
});

it.each(["/dashboard/clips/layout", "/dashboard/clip-layouts/new", "/creators/public-creator", "/gallery/public-gallery"])("preserves the public or static analytics route %s", (url) => {
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url })).toHaveProperty("url", url);
});

it("preserves dashboard traffic and arbitrary standard UTM campaigns while removing credentials", () => {
	const payload = prepareUmamiPayload("event", { website: "site", hostname: "clipify.us", url: "/dashboard/overlay/123?secret=private&utm_campaign=summer-any-name&utm_source=discord#token", referrer: "https://example.com/?code=private", title: "Private overlay name" });
	expect(payload).toMatchObject({ website: "site", tag: "application", url: "/dashboard/overlay/:id?utm_campaign=summer-any-name&utm_source=discord", referrer: "https://example.com/", title: "Clipify dashboard" });
});

it("keeps baseline events but blocks native identification and performance before consent", () => {
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url: "/pricing", name: "paywall_impression", id: "account" })).toMatchObject({ name: "paywall_impression", tag: "marketing" });
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url: "/pricing", id: "account" })).not.toHaveProperty("id");
	expect(prepareUmamiPayload("identify", { id: "account" })).toBeNull();
	expect(prepareUmamiPayload("performance", { lcp: 10 })).toBeNull();
});

it("permits consented identity and performance while still stripping secret query values", () => {
	setBrowserMeasurementConsent(true);
	expect(prepareUmamiPayload("identify", { hostname: "clipify.us", url: "/dashboard?token=secret", id: "auth-id" })).toMatchObject({ id: "auth-id", url: "/dashboard" });
	expect(prepareUmamiPayload("performance", { hostname: "clipify.us", url: "/pricing", lcp: 10 })).toMatchObject({ lcp: 10 });
});

it("separates nonproduction and audience traffic without dropping their pageviews", () => {
	expect(prepareUmamiPayload("event", { hostname: "beta.clipify.us", url: "/dashboard" })).toMatchObject({ tag: "nonproduction" });
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url: "/creators/demo" })).toMatchObject({ tag: "audience" });
});

it("sends native baseline events and gates additional product events on current consent", () => {
	const track = jest.fn();
	Object.assign(window, { umami: { track } });
	trackEvent("guide_started", { journey: "overlay" });
	trackProductEvent("theme_saved", { changed_group: "layout" });
	expect(track).toHaveBeenCalledTimes(1);
	expect(track).toHaveBeenCalledWith("guide_started", { journey: "overlay" });
	setBrowserMeasurementConsent(true);
	trackProductEvent("theme_saved", { changed_group: "layout" });
	expect(track).toHaveBeenLastCalledWith("theme_saved", { changed_group: "layout" });
	setBrowserMeasurementConsent(false);
	trackProductEvent("theme_saved");
	expect(track).toHaveBeenCalledTimes(2);
});

it("does not break an application action when analytics is absent or throws", () => {
	expect(() => trackEvent("guide_started")).not.toThrow();
	Object.assign(window, {
		umami: {
			track: () => {
				throw new Error("blocked");
			},
		},
	});
	expect(() => trackEvent("guide_started")).not.toThrow();
});

it("drops non-web referrers instead of forwarding executable or local URLs", () => {
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url: "/", referrer: "javascript:alert(1)" })).toHaveProperty("referrer", undefined);
});

it("keeps framed marketing previews outside the eligible marketing audience", () => {
	const top = jest.spyOn(window, "self", "get").mockReturnValue({} as Window & typeof globalThis);
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url: "/" })).toMatchObject({ tag: "runtime" });
	top.mockRestore();
});

it("blocks a cached identified session immediately after withdrawal, until the existing consent reload", () => {
	setBrowserMeasurementConsent(true);
	setAnalyticsContext({ plan: "pro", access_source: "trial", is_paying: false });
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url: "/dashboard", name: "theme_saved", data: { plan: "free", is_paying: true } })).toMatchObject({ data: { plan: "pro", is_paying: false } });
	setBrowserMeasurementConsent(false);
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url: "/dashboard", name: "theme_saved" })).toBeNull();
});

it.each([
	["https://clipify.us/dashboard/clips/private-clip", "https://clipify.us/dashboard/clips/:id"],
	["https://external.example/dashboard/clips/their-route", "https://external.example/dashboard/clips/their-route"],
])("normalizes only our private referrer paths: %s", (referrer, expected) => {
	setBrowserMeasurementConsent(true);
	expect(prepareUmamiPayload("event", { hostname: "clipify.us", url: "/dashboard", referrer })).toHaveProperty("referrer", expected);
});
