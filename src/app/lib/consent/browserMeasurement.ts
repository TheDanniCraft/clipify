import { CONSENT_LIFETIME_MS } from "./lifetime";

let hasMeasurementConsent = false;
let measurementAllowedSince: number | null = null;

export function browserMeasurementAllowed() {
	return hasMeasurementConsent;
}

export function setBrowserMeasurementConsent(allowed: boolean) {
	if (allowed !== hasMeasurementConsent) measurementAllowedSince = allowed ? Date.now() : null;
	hasMeasurementConsent = allowed;
}

export function browserMeasurementStartedAt() {
	return measurementAllowedSince;
}

export function hadMeasurementConsentAtPageLoad(consentTime: number | undefined, pageLoadTime: number, now: number) {
	return typeof consentTime === "number" && Number.isFinite(consentTime) && consentTime > 0 && consentTime <= pageLoadTime && now - consentTime < CONSENT_LIFETIME_MS;
}
