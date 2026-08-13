import { emitProductEvent, sanitizeEventProperties } from "@lib/telemetry";

jest.mock("@grafana/faro-web-sdk", () => ({ faro: { api: { pushError: jest.fn() } } }));

describe("product telemetry", () => {
	beforeEach(() => {
		delete window.plausible;
		delete window.clarity;
	});
	it("allows only approved, low-cardinality properties", () => {
		expect(sanitizeEventProperties({ source: "pricing", userId: "secret", reason: "x".repeat(120) })).toEqual({ source: "pricing", reason: "x".repeat(100) });
	});
	it("routes funnel events to Plausible and Clarity and prioritizes CTAs", () => {
		window.plausible = jest.fn();
		window.clarity = jest.fn();
		emitProductEvent("paywall_cta_click", { source: "pricing", userId: "secret" });
		expect(window.plausible).toHaveBeenCalledWith("paywall_cta_click", { props: { source: "pricing" } });
		expect(window.clarity).toHaveBeenCalledWith("event", "paywall_cta_click");
		expect(window.clarity).toHaveBeenCalledWith("upgrade", "paywall_cta_click");
	});
	it("keeps destination failures from escaping", () => {
		window.plausible = jest.fn(() => {
			throw new Error("blocked");
		});
		expect(() => emitProductEvent("checkout_start", { source: "settings" })).not.toThrow();
	});
});
