import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { useConsentScript } from "@c15t/nextjs";
import { useHeadlessConsentUI } from "@c15t/nextjs/headless";
import { Button } from "@heroui/react";
import { IconMessageCircle } from "@tabler/icons-react";
import { CONSENT_PREFERENCES_VISIBILITY_EVENT, OPEN_CONSENT_PREFERENCES_EVENT, type ConsentPreferencesVisibilityDetail, type OpenConsentPreferencesDetail } from "@lib/consent/events";
import { chatwootConsentScript } from "@lib/consent/chatwoot";

type ConsentScriptStatus = ReturnType<typeof useConsentScript>["status"];

export function shouldShowChatConsentFallback({ isEmbedded, preferencesVisible, scriptStatus }: { isEmbedded: boolean; preferencesVisible: boolean; scriptStatus: ConsentScriptStatus }) {
	return !isEmbedded && !preferencesVisible && scriptStatus === "blocked";
}

function isChatwootAvailable() {
	return Boolean(window.chatwootSDK || window.$chatwoot || document.querySelector("#chatwoot_live_chat_widget, iframe[src*='chat.cloud.thedannicraft.de']"));
}

const ChatWidget = () => {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);
	const { openDialog } = useHeadlessConsentUI();
	const [preferencesVisible, setPreferencesVisible] = useState(false);
	const [chatwootState, setChatwootState] = useState({ checked: false, available: false });
	const { status: scriptStatus } = useConsentScript({
		script: chatwootConsentScript,
		enabled: !isEmbedded,
		resolveReady: () => window.chatwootSDK ?? false,
		unmountBehavior: "keep",
	});

	useEffect(() => {
		function updateChatwootState() {
			setChatwootState({ checked: true, available: isChatwootAvailable() });
		}

		updateChatwootState();
		window.addEventListener("chatwoot:ready", updateChatwootState);
		return () => window.removeEventListener("chatwoot:ready", updateChatwootState);
	}, []);

	useEffect(() => {
		function updatePreferencesVisibility(event: Event) {
			setPreferencesVisible((event as CustomEvent<ConsentPreferencesVisibilityDetail>).detail.visible);
		}

		window.addEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, updatePreferencesVisibility);
		return () => window.removeEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, updatePreferencesVisibility);
	}, []);

	if (!chatwootState.checked || chatwootState.available || !shouldShowChatConsentFallback({ isEmbedded, preferencesVisible, scriptStatus })) return null;

	function openSupportConsent() {
		setPreferencesVisible(true);
		openDialog();
		window.dispatchEvent(new CustomEvent<OpenConsentPreferencesDetail>(OPEN_CONSENT_PREFERENCES_EVENT, { detail: { category: "functionality" } }));
	}

	return (
		<Button isIconOnly aria-label='Enable support chat' className='fixed bottom-5 left-5 z-[110] size-14 rounded-full shadow-xl' onPress={openSupportConsent}>
			<IconMessageCircle className='size-6' aria-hidden='true' />
		</Button>
	);
};

export default ChatWidget;
