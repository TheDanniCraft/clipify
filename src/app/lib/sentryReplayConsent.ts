import * as Sentry from "@sentry/nextjs";
import { sentryReplaySessionSampleRate } from "../../../sentry.shared.config";

export async function applySentryReplayConsent(hasMeasurementConsent: boolean) {
	const client = Sentry.getClient();
	if (!client) return;

	if (!hasMeasurementConsent) {
		// Do not flush a final segment after consent was withdrawn.
		await Sentry.getReplay()?.stop({ flush: false });
		return;
	}

	if (Sentry.getReplay()) return;

	// Integration setup samples only after consent. Its error buffer therefore
	// cannot record pre-consent interactions.
	const options = client.getOptions() as ReturnType<typeof client.getOptions> & { replaysSessionSampleRate?: number; replaysOnErrorSampleRate?: number };
	options.replaysSessionSampleRate = sentryReplaySessionSampleRate;
	options.replaysOnErrorSampleRate = 1;
	Sentry.addIntegration(
		Sentry.replayIntegration({
			maskAllText: true,
			maskAllInputs: true,
			blockAllMedia: true,
			block: ["iframe", ".sentry-block", "[data-sentry-block]"],
		}),
	);
}
