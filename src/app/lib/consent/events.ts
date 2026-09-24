export const OPEN_CONSENT_PREFERENCES_EVENT = "clipify:open-consent-preferences";
export const CONSENT_PREFERENCES_VISIBILITY_EVENT = "clipify:consent-preferences-visibility";

export type OpenConsentPreferencesDetail = {
	category?: "functionality" | "measurement";
};

export type ConsentPreferencesVisibilityDetail = {
	visible: boolean;
};
