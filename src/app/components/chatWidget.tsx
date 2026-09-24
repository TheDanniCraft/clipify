import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { useConsentManager, useConsentScript } from "@c15t/nextjs";
import { useHeadlessConsentUI } from "@c15t/nextjs/headless";
import { Button } from "@heroui/react";
import { IconMessageCircle } from "@tabler/icons-react";
import { CONSENT_PREFERENCES_VISIBILITY_EVENT, OPEN_CONSENT_PREFERENCES_EVENT, type ConsentPreferencesVisibilityDetail, type OpenConsentPreferencesDetail } from "@lib/consent/events";
import { chatwootConsentScript } from "@lib/consent/chatwoot";

const ChatWidget = () => {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);
	const { has } = useConsentManager();
	const { openDialog } = useHeadlessConsentUI();
	const [preferencesVisible, setPreferencesVisible] = useState(false);
	const allowed = !isEmbedded && has("functionality");
	useConsentScript({
		script: chatwootConsentScript,
		enabled: !isEmbedded,
		resolveReady: () => window.chatwootSDK ?? false,
		unmountBehavior: "keep",
	});

	useEffect(() => {
		function updatePreferencesVisibility(event: Event) {
			setPreferencesVisible((event as CustomEvent<ConsentPreferencesVisibilityDetail>).detail.visible);
		}

		window.addEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, updatePreferencesVisibility);
		return () => window.removeEventListener(CONSENT_PREFERENCES_VISIBILITY_EVENT, updatePreferencesVisibility);
	}, []);

	if (isEmbedded || allowed || preferencesVisible) return null;

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
