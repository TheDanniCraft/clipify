import * as Sentry from "@sentry/nextjs";
import { sentryReplaySessionSampleRate } from "../../../sentry.shared.config";

export type AdoptConsent = {
	optInTags?: string[];
	optOutTags?: string[];
};

type AdoptTag = {
	id: string;
	name: string;
};

type AdoptWebsiteData = {
	tags?: AdoptTag[];
};

const ADOPT_WEBSITE_DATA_URL = "https://disclaimer-api.goadopt.io/api/tag/disclaimer-info/792b9b29-57f9-4d92-b5f1-313f94ddfacc";
const SENTRY_REPLAY_TAG_NAME = "Sentry Session Replay";

let replayTagIdPromise: Promise<string | null> | null = null;
let replayMode: "off" | "buffer" | "session" = "off";

async function getReplayTagId() {
	if (!replayTagIdPromise) {
		replayTagIdPromise = fetch(ADOPT_WEBSITE_DATA_URL)
			.then(async (response) => {
				if (!response.ok) return null;
				const websiteData = (await response.json()) as AdoptWebsiteData;
				return websiteData.tags?.find((tag) => tag.name.trim().toLowerCase() === SENTRY_REPLAY_TAG_NAME.toLowerCase())?.id ?? null;
			})
			.catch(() => null);
	}

	return replayTagIdPromise;
}

export async function applySentryReplayConsent(consent: AdoptConsent) {
	const replay = Sentry.getReplay();
	if (!replay) return;

	const replayTagId = await getReplayTagId();
	const hasConsent = Boolean(replayTagId && consent.optInTags?.includes(replayTagId));

	if (!hasConsent) {
		if (replayMode !== "off") {
			await replay.stop();
			replayMode = "off";
		}
		return;
	}

	if (replayMode !== "off") return;

	if (Math.random() < sentryReplaySessionSampleRate) {
		replay.start();
		replayMode = "session";
		return;
	}

	replay.startBuffering();
	replayMode = "buffer";
}
