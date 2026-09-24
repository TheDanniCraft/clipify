import { clearRevokedConsentStorage } from "./cleanup";

export function reloadAfterConsentSave(preferences: Record<string, boolean | undefined>, reload = () => window.location.reload()) {
	clearRevokedConsentStorage(preferences);
	reload();
}
