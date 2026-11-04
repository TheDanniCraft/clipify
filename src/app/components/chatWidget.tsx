import DashboardUtilityPortal from "@components/dashboardUtilityPortal";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { useConsent, useScriptLoader } from "c15t/next";
import { useHeadlessConsentUI } from "c15t/next/headless";
import { Button } from "@heroui/react";
import { IconMessageCircle } from "@tabler/icons-react";
import { CONSENT_PREFERENCES_VISIBILITY_EVENT, OPEN_CONSENT_PREFERENCES_EVENT, type ConsentPreferencesVisibilityDetail, type OpenConsentPreferencesDetail } from "@lib/consent/events";
import { chatwootConsentScript } from "@lib/consent/chatwoot";

type ConsentScriptStatus = "blocked" | "loading" | "ready";

export function shouldShowChatConsentFallback({ isEmbedded, preferencesVisible, scriptStatus }: { isEmbedded: boolean; preferencesVisible: boolean; scriptStatus: ConsentScriptStatus }) {
	return !isEmbedded && !preferencesVisible && scriptStatus === "blocked";
}

function isChatwootAvailable() {
	return Boolean(window.chatwootSDK || window.$chatwoot || document.querySelector("#chatwoot_live_chat_widget, iframe[src*='chat.cloud.thedannicraft.de']"));
}

function isChatwootWidgetMounted() {
	return Boolean(document.querySelector(".woot--bubble-holder") && document.querySelector(".woot-widget-holder"));
}

const ChatWidget = () => {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);
	const inDashboard = pathname.startsWith("/dashboard") && !isEmbedded;
	const { banner, dialog, openDialog } = useHeadlessConsentUI();
	const functionalityAllowed = useConsent("functionality");
	const [preferencesVisible, setPreferencesVisible] = useState(false);
	const [previewBottom, setPreviewBottom] = useState(20);
	const consentVisible = banner.isVisible || dialog.isVisible || preferencesVisible;
	const [chatwootState, setChatwootState] = useState({ checked: false, available: false });
	useScriptLoader(isEmbedded ? [] : [chatwootConsentScript]);
	const scriptStatus: ConsentScriptStatus = !functionalityAllowed ? "blocked" : chatwootState.available ? "ready" : "loading";

	useEffect(() => {
		if (!banner.isVisible) return;
		let element: HTMLElement | null = null;
		const positionPreview = () => {
			if (element) setPreviewBottom(window.innerHeight - element.getBoundingClientRect().top + 12);
		};
		const observer = new ResizeObserver(positionPreview);
		const findBanner = () => {
			const next = document.getElementById("consent-banner-title")?.closest("aside") ?? null;
			if (next === element) return;
			observer.disconnect();
			element = next;
			if (element) observer.observe(element);
			positionPreview();
		};
		findBanner();
		// Consent portals mount later and move when the mobile drawer opens.
		const mutations = new MutationObserver(findBanner);
		mutations.observe(document.body, { childList: true, subtree: true });
		window.addEventListener("resize", positionPreview);
		return () => {
			observer.disconnect();
			mutations.disconnect();
			window.removeEventListener("resize", positionPreview);
		};
	}, [banner.isVisible]);

	useEffect(() => {
		function syncChatwootVisibility() {
			const chatwoot = window.$chatwoot;
			if (!chatwoot || !isChatwootWidgetMounted()) return;

			if (isEmbedded || consentVisible || scriptStatus !== "ready") {
				chatwoot.toggle?.("close");
				chatwoot.toggleBubbleVisibility?.("hide");
				return;
			}

			chatwoot.toggleBubbleVisibility?.(inDashboard ? "hide" : "show");
		}

		syncChatwootVisibility();
		window.addEventListener("chatwoot:ready", syncChatwootVisibility);
		return () => window.removeEventListener("chatwoot:ready", syncChatwootVisibility);
	}, [isEmbedded, inDashboard, scriptStatus, consentVisible]);

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

	if (!chatwootState.checked || (!inDashboard && chatwootState.available) || (!inDashboard && !shouldShowChatConsentFallback({ isEmbedded, preferencesVisible: dialog.isVisible || preferencesVisible, scriptStatus }))) return null;
	if (inDashboard && (consentVisible || isEmbedded)) return null;

	function openSupportConsent() {
		if (inDashboard && chatwootState.available && functionalityAllowed) {
			window.$chatwoot?.toggle?.("open");
			return;
		}
		setPreferencesVisible(true);
		openDialog();
		window.dispatchEvent(new CustomEvent<OpenConsentPreferencesDetail>(OPEN_CONSENT_PREFERENCES_EVENT, { detail: { category: "functionality" } }));
	}

	return (
		<DashboardUtilityPortal slot='chat'>
			<Button isIconOnly={!inDashboard} variant={inDashboard ? "ghost" : "primary"} fullWidth={inDashboard} aria-label='Enable support chat' className={inDashboard ? "justify-start text-muted" : "fixed left-5 z-[110] size-14 rounded-full shadow-xl"} style={inDashboard ? undefined : { bottom: banner.isVisible ? previewBottom : 20 }} onPress={openSupportConsent}>
				<IconMessageCircle className='size-6' aria-hidden='true' />
				{inDashboard ? "Support chat" : null}
			</Button>
		</DashboardUtilityPortal>
	);
};

export default ChatWidget;
