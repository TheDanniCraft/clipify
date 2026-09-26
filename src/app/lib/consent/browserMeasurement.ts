import { CONSENT_LIFETIME_MS } from "./lifetime";

let hasMeasurementConsent = false;

export function browserMeasurementAllowed() {
	return hasMeasurementConsent;
}

export function setBrowserMeasurementConsent(allowed: boolean) {
	hasMeasurementConsent = allowed;
}

export function hadMeasurementConsentAtPageLoad(consentTime: number | undefined, pageLoadTime: number, now: number) {
	return typeof consentTime === "number" && Number.isFinite(consentTime) && consentTime > 0 && consentTime <= pageLoadTime && now - consentTime < CONSENT_LIFETIME_MS;
}
