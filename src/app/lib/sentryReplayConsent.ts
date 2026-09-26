import * as Sentry from "@sentry/nextjs";
import { sentryProfileSampleRate, sentryReplaySessionSampleRate } from "../../../sentry.shared.config";

type BrowserConsentOptions = ReturnType<NonNullable<ReturnType<typeof Sentry.getClient>>["getOptions"]> & {
	profileLifecycle?: "manual" | "trace";
	profileSessionSampleRate?: number;
	replaysSessionSampleRate?: number;
	replaysOnErrorSampleRate?: number;
};

export async function applySentryReplayConsent(hasMeasurementConsent: boolean) {
	const client = Sentry.getClient();
	if (!client) return;
	const options = client.getOptions() as BrowserConsentOptions;

	if (!hasMeasurementConsent) {
		options.replaysSessionSampleRate = 0;
		options.replaysOnErrorSampleRate = 0;
		options.profileSessionSampleRate = 0;
		// Do not flush a final segment after consent was withdrawn.
		await Sentry.getReplay()?.stop({ flush: false });
		Sentry.uiProfiler.stopProfiler();
		return;
	}

	options.replaysSessionSampleRate = sentryReplaySessionSampleRate;
	options.replaysOnErrorSampleRate = 1;
	const replay = Sentry.getReplay();
	if (replay) {
		await replay.start();
	} else {
		// Integration setup samples only after consent. Its error buffer therefore
		// cannot record pre-consent interactions.
		Sentry.addIntegration(
			Sentry.replayIntegration({
				maskAllText: true,
				maskAllInputs: true,
				blockAllMedia: true,
				block: ["iframe", ".sentry-block", "[data-sentry-block]"],
			}),
		);
	}

	options.profileSessionSampleRate = sentryProfileSampleRate;
	options.profileLifecycle = "manual";
	if (!client.getIntegrationByName("BrowserProfiling")) {
		Sentry.addIntegration(Sentry.browserProfilingIntegration());
	}
	Sentry.uiProfiler.startProfiler();
}
