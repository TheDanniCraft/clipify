import { browserMeasurementAllowed, hadMeasurementConsentAtPageLoad, setBrowserMeasurementConsent } from "@lib/consent/browserMeasurement";

describe("browser measurement consent", () => {
	afterEach(() => setBrowserMeasurementConsent(false));

	it("keeps RUM off until measurement is allowed", () => {
		expect(browserMeasurementAllowed()).toBe(false);
		setBrowserMeasurementConsent(true);
		expect(browserMeasurementAllowed()).toBe(true);
	});

	it("allows initial page-load RUM only for a prior, unexpired consent", () => {
		const now = Date.UTC(2026, 8, 14);
		expect(hadMeasurementConsentAtPageLoad(now - 1000, now, now + 1000)).toBe(true);
		expect(hadMeasurementConsentAtPageLoad(now + 1000, now, now + 2000)).toBe(false);
		expect(hadMeasurementConsentAtPageLoad(now - 181 * 86400000, now, now)).toBe(false);
		expect(hadMeasurementConsentAtPageLoad(undefined, now, now)).toBe(false);
	});
});
