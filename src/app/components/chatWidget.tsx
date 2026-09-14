import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { useConsentManager } from "@c15t/nextjs";

const CHATWOOT_BASE_URL = "https://chat.cloud.thedannicraft.de";
const CHATWOOT_WEBSITE_TOKEN = "new6uhVJwGhe8PCG8jxRMeiC";

const ChatWidget = () => {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);
	const { has, hasConsented } = useConsentManager();
	const allowed = !isEmbedded && hasConsented() && has("functionality");

	useEffect(() => {
		if (!allowed) return;
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
	}, [allowed]);

	return null;
};

export default ChatWidget;
