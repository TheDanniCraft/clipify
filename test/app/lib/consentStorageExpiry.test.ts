import { clearExpiredStoredConsent } from "@lib/consent/storageExpiry";

describe("stored consent expiry", () => {
	beforeEach(() => {
		localStorage.clear();
		document.cookie = "c15t=; Max-Age=0; Path=/";
	});

	it("keeps a recently saved consent", () => {
		const now = Date.UTC(2026, 8, 14);
		localStorage.setItem("c15t", JSON.stringify({ consents: { necessary: true, measurement: true }, consentInfo: { time: now - 1000 } }));
		expect(clearExpiredStoredConsent(now)).toBe(false);
		expect(localStorage.getItem("c15t")).not.toBeNull();
	});

	it("removes local and cookie proof after 180 days", () => {
		const now = Date.UTC(2026, 8, 14);
		localStorage.setItem("c15t", JSON.stringify({ consents: { necessary: true, measurement: true }, consentInfo: { time: now - 180 * 86400000 } }));
		expect(clearExpiredStoredConsent(now)).toBe(true);
		expect(localStorage.getItem("c15t")).toBeNull();
		expect(document.cookie).not.toContain("c15t=");
	});

	it("rejects a stored grant with no timestamp", () => {
		localStorage.setItem("c15t", JSON.stringify({ consents: { measurement: true } }));
		expect(clearExpiredStoredConsent()).toBe(true);
	});
});
