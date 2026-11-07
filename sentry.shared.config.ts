const isPreview = process.env.IS_PREVIEW === "true";
const isE2ETest = process.env.E2E_TEST_MODE === "true";

export const sentryEnvironment = isPreview ? "preview" : process.env.NODE_ENV === "production" ? "production" : "development";
export const sentryEnabled = sentryEnvironment === "production" && Boolean(process.env.SENTRY_DSN);
export const sentryBrowserEnabled = sentryEnabled || (isE2ETest && !isPreview);
export const sentryRelease = process.env.SENTRY_RELEASE || undefined;
// At Clipify's current traffic level we prefer complete traces over extrapolated
// performance data. Errors are never sampled by this setting.
export const sentryTraceSampleRate = sentryEnvironment === "production" ? 1 : 0;
export const sentryReplaySessionSampleRate = sentryEnvironment === "production" ? (isE2ETest ? 1 : 0.01) : 0;
// Node profiling has a substantially larger sponsored allowance than browser UI
// profiling, so keep their session sampling controls independent.
export const sentryNodeProfileSampleRate = sentryEnvironment === "production" ? 0.05 : 0;
export const sentryBrowserProfileSampleRate = sentryEnvironment === "production" ? 0.001 : 0;

// Keep useful operational context and parameterized SQL while preventing the SDK
// from automatically attaching high-risk values. Project-level Sentry scrubbers
// provide the second line of defence.
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
