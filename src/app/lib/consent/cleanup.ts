export function clearRevokedConsentStorage(preferences: Record<string, boolean | undefined>) {
	if (preferences.functionality !== false) return;

	// Chatwoot writes these after its SDK loads. Remove first-party state before c15t reloads.
	document.cookie = "cw_conversation=; Max-Age=0; Path=/; SameSite=Lax";
	for (const key of Object.keys(localStorage)) {
		if (key.startsWith("chatwoot_") || key.startsWith("cw_")) localStorage.removeItem(key);
	}
	for (const key of Object.keys(sessionStorage)) {
		if (key.startsWith("chatwoot_") || key.startsWith("cw_")) sessionStorage.removeItem(key);
	}
}
