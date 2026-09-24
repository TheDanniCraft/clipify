import type { Script } from "c15t";

export const CHATWOOT_BASE_URL = "https://chat.cloud.thedannicraft.de";
export const CHATWOOT_WEBSITE_TOKEN = "new6uhVJwGhe8PCG8jxRMeiC";

export const chatwootConsentScript: Script = {
	id: "chatwoot-support",
	src: `${CHATWOOT_BASE_URL}/packs/js/sdk.js`,
	category: "functionality",
	target: "body",
	defer: true,
	onBeforeLoad: () => {
		window.chatwootSettings = {
			hideMessageBubble: false,
			position: "left",
			locale: "en",
			type: "expanded_bubble",
			launcherTitle: "Chat with us",
			darkMode: "auto",
		};
	},
	onLoad: () => {
		window.chatwootSDK?.run({
			websiteToken: CHATWOOT_WEBSITE_TOKEN,
			baseUrl: CHATWOOT_BASE_URL,
		});
	},
};
