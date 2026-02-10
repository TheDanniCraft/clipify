"use client";

import { useCallback, useEffect, useRef } from "react";
import { AuthenticatedUser, Overlay } from "@types";

export default function ChatwootData({ user, overlay }: { user?: AuthenticatedUser; overlay?: Overlay }) {
	const lastSignatureRef = useRef<string | null>(null);
	const hasSetOverlayRef = useRef(false);

	const applyChatwootData = useCallback(() => {
		const signature = JSON.stringify({
			user_id: user?.id ?? null,
			plan: user?.plan ?? null,
			stripe_customer_id: user?.stripeCustomerId ?? null,
			account_created_at: user?.createdAt ?? null,
		});

		if (lastSignatureRef.current === signature) {
			return;
		}

		lastSignatureRef.current = signature;

		if (user) {
			window.$chatwoot?.setCustomAttributes({
				user_id: user.id,
				plan: user.plan,
				stripe_customer_id: user.stripeCustomerId,
				account_created_at: user.createdAt,
			});
		}
	}, [user]);

	useEffect(() => {
		const onReady = () => applyChatwootData();

		window.addEventListener("chatwoot:ready", onReady);

		// If Chatwoot is already booted, apply immediately on route/data changes.
		if (window.$chatwoot) {
			applyChatwootData();
		}

		return () => {
			window.removeEventListener("chatwoot:ready", onReady);
		};
	}, [applyChatwootData]);

	useEffect(() => {
		if (!overlay) {
			return;
		}

		const setConversationAttributes = () => {
			if (hasSetOverlayRef.current) return;
			hasSetOverlayRef.current = true;
			window.$chatwoot?.setConversationCustomAttributes({
				overlay_id: overlay.id,
				overlay_created_at: overlay.createdAt,
			});
			window.removeEventListener("chatwoot:on-message", setConversationAttributes);
		};

		// Ensure the conversation exists before setting attributes.
		window.addEventListener("chatwoot:on-message", setConversationAttributes);

		return () => {
			window.removeEventListener("chatwoot:on-message", setConversationAttributes);
		};
	}, [overlay]);

	return null;
}
