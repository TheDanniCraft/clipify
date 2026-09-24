import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { useConsentManager } from "@c15t/nextjs";
import { Button } from "@heroui/react";
import { IconMessageCircle } from "@tabler/icons-react";
import { CONSENT_PREFERENCES_VISIBILITY_EVENT, OPEN_CONSENT_PREFERENCES_EVENT, type ConsentPreferencesVisibilityDetail, type OpenConsentPreferencesDetail } from "@lib/consent/events";

const CHATWOOT_BASE_URL = "https://chat.cloud.thedannicraft.de";
const CHATWOOT_WEBSITE_TOKEN = "new6uhVJwGhe8PCG8jxRMeiC";

const ChatWidget = () => {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);
	const { has, hasConsented } = useConsentManager();
	const [preferencesVisible, setPreferencesVisible] = useState(false);
	const allowed = !isEmbedded && hasConsented() && has("functionality");

	useEffect(() => {
		function updatePreferencesVisibility(event: Event) {
			setPreferencesVisible((event as CustomEvent<ConsentPreferencesVisibilityDetail>).detail.visible);
		}

		window.addEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, updatePreferencesVisibility);
		return () => window.removeEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, updatePreferencesVisibility);
	}, []);

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

	if (isEmbedded || allowed || preferencesVisible) return null;

	function openSupportConsent() {
		setPreferencesVisible(true);
		window.dispatchEvent(new CustomEvent<OpenConsentPreferencesDetail>(OPEN_CONSENT_PREFERENCES_EVENT, { detail: { category: "functionality" } }));
	}

	return (
		<Button isIconOnly aria-label='Enable support chat' className='fixed bottom-5 left-5 z-[110] size-14 rounded-full shadow-xl' onPress={openSupportConsent}>
			<IconMessageCircle className='size-6' aria-hidden='true' />
		</Button>
	);
};

export default ChatWidget;
