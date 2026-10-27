/** @jest-environment node */
import { analyticsTrafficProperties } from "@/app/PlausibleClient";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
afterEach(() => {
	if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
	else Reflect.deleteProperty(globalThis, "window");
});

it.each([
	["clipify.us", "/", true, "marketing"],
	["clipify.us", "/pricing/", true, "marketing"],
	["clipify.us", "/community", true, "marketing"],
	["clipify.us", "/features", true, "marketing"],
	["clipify.us", "/guides/twitch-clips-in-obs", true, "marketing"],
	["clipify.us", "/guides/unknown", true, "runtime"],
	["clipify.us", "/demoPlayer", true, "runtime"],
	["clipify.us", "/overlay/example", true, "runtime"],
	["clipify.us", "/dashboard", true, "runtime"],
	["clipify.us", "/pricing", false, "runtime"],
	["beta.clipify.us", "/", true, "nonproduction"],
	["es.clipify.us", "/", true, "nonproduction"],
	["127.0.0.1", "/", true, "nonproduction"],
])("classifies %s%s with top-level=%s as %s", (hostname, pathname, topLevel, expected) => {
	const frame = {};
	Object.defineProperty(globalThis, "window", { configurable: true, value: { location: { hostname, pathname }, self: frame, top: topLevel ? frame : {} } });
	expect(analyticsTrafficProperties()).toEqual({ traffic_scope: expected });
});
