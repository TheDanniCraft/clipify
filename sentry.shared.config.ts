const isPreview = process.env.IS_PREVIEW === "true";

export const sentryEnvironment = isPreview ? "preview" : process.env.NODE_ENV === "production" ? "production" : "development";
export const sentryEnabled = sentryEnvironment !== "development" && Boolean(process.env.SENTRY_DSN);
export const sentryRelease = process.env.SENTRY_RELEASE || undefined;
export const sentryTraceSampleRate = sentryEnvironment === "preview" ? 1 : sentryEnvironment === "production" ? 0.1 : 0;
export const sentryReplaySessionSampleRate = sentryEnvironment === "preview" ? 0.2 : sentryEnvironment === "production" ? 0.01 : 0;

// Keep operational context while preventing request values and user content from
// being attached to errors and performance spans.
export const sentryDataCollection = {
	userInfo: false,
	cookies: false,
	httpHeaders: {
		request: false,
		response: false,
	},
	httpBodies: [],
	urlQueryParams: false,
	graphQL: {
		document: false,
		variables: false,
	},
	genAI: {
		inputs: false,
		outputs: false,
	},
	databaseQueryData: false,
	stackFrameVariables: false,
};
