let hasMeasurementConsent = false;
const CONSENT_VALIDITY_MS = 180 * 24 * 60 * 60 * 1000;

export function browserMeasurementAllowed() {
	return hasMeasurementConsent;
}

export function setBrowserMeasurementConsent(allowed: boolean) {
	hasMeasurementConsent = allowed;
}

export function hadMeasurementConsentAtPageLoad(consentTime: number | undefined, pageLoadTime: number, now: number) {
	return typeof consentTime === "number" && Number.isFinite(consentTime) && consentTime > 0 && consentTime <= pageLoadTime && now - consentTime <= CONSENT_VALIDITY_MS;
}
