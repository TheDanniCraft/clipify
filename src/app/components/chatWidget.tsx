import { useEffect } from "react";

const CHATWOOT_BASE_URL = "https://chat.cloud.thedannicraft.de";
const CHATWOOT_WEBSITE_TOKEN = "new6uhVJwGhe8PCG8jxRMeiC";

declare global {
	interface Window {
		chatwootSDK?: {
			run: (config: { websiteToken: string; baseUrl: string }) => void;
		};
		chatwootSettings?: {
			hideMessageBubble?: boolean;
			position?: "left" | "right";
			locale?: string;
			type?: "standard" | "expanded_bubble";
			launcherTitle?: string;
			darkMode?: "auto" | "light";
		};
	}
}

const ChatWidget = () => {
	useEffect(() => {
		window.chatwootSettings = {
			hideMessageBubble: false,
			position: "left",
			locale: "en",
			type: "expanded_bubble",
			launcherTitle: "Chat with us",
			darkMode: "auto",
		};

		if (document.getElementById("chatwoot-script")) return;

		const script = document.createElement("script");
		script.id = "chatwoot-script";
		script.src = `${CHATWOOT_BASE_URL}/packs/js/sdk.js`;
		script.defer = true;

		script.onload = () => {
			if (window.chatwootSDK) {
				window.chatwootSDK.run({
					websiteToken: CHATWOOT_WEBSITE_TOKEN,
					baseUrl: CHATWOOT_BASE_URL,
				});
			}
		};

		document.body.appendChild(script);

		return () => {
			script.remove();
			const chatwootWidget = document.getElementById("chatwoot-live-chat-widget");
			if (chatwootWidget) {
				chatwootWidget.remove();
			}
		};
	}, []);

	return null;
};

export default ChatWidget;
