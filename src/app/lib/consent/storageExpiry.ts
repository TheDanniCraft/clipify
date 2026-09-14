import { deleteConsentFromStorage, getConsentFromStorage } from "c15t";
import { CONSENT_LIFETIME_MS } from "./lifetime";

type StoredConsent = { consentInfo?: { time?: number } };

export function clearExpiredStoredConsent(now = Date.now()) {
	const stored = getConsentFromStorage<StoredConsent>();
	if (!stored) return false;
	const consentTime = stored.consentInfo?.time;
	if (typeof consentTime === "number" && Number.isFinite(consentTime) && consentTime > 0 && consentTime <= now && now - consentTime < CONSENT_LIFETIME_MS) return false;
	deleteConsentFromStorage();
	return true;
}
