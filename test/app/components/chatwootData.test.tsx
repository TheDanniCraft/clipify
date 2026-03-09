import React from "react";
import { render } from "@testing-library/react";
import ChatwootData from "@/app/components/chatwootData";

describe("components/ChatwootData", () => {
	const setCustomAttributes = jest.fn();
	const setConversationCustomAttributes = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		window.$chatwoot = {
			baseUrl: "https://chat.example.com",
			hasLoaded: true,
			hideMessageBubble: false,
			isOpen: false,
			position: "right",
			websiteToken: "token",
			locale: "en",
			useBrowserLanguage: false,
			type: "standard",
			availableMessage: "",
			darkMode: "auto",
			enableEmojiPicker: true,
			enableEndConversation: true,
			launcherTitle: "",
			popoutChatWindow: jest.fn(),
			removeLabel: jest.fn(),
			reset: jest.fn(),
			resetTriggered: false,
			setColorScheme: jest.fn(),
			setConversationCustomAttributes,
			setCustomAttributes,
			setLabel: jest.fn(),
			setLocale: jest.fn(),
			setUser: jest.fn(),
			showPopoutButton: false,
			showUnreadMessagesDialog: false,
			toggle: jest.fn(),
			toggleBubbleVisibility: jest.fn(),
			unavailableMessage: "",
			welcomeDescription: "",
			welcomeTitle: "",
			widgetStyle: "",
		};
	});

	it("applies user attributes once per signature", () => {
		const user = {
			id: "user-1",
			plan: "free",
			stripeCustomerId: "cus_1",
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
		};

		const { rerender } = render(<ChatwootData user={user as never} />);
		expect(setCustomAttributes).toHaveBeenCalledTimes(1);

		rerender(<ChatwootData user={user as never} />);
		expect(setCustomAttributes).toHaveBeenCalledTimes(1);

		const changedUser = { ...user, plan: "pro" };
		rerender(<ChatwootData user={changedUser as never} />);
		expect(setCustomAttributes).toHaveBeenCalledTimes(2);
	});

	it("sets overlay conversation attributes when message event arrives", () => {
		const overlayA = { id: "overlay-a", createdAt: new Date("2026-01-01T00:00:00.000Z") };
		const overlayB = { id: "overlay-b", createdAt: new Date("2026-01-02T00:00:00.000Z") };
		const { rerender } = render(<ChatwootData overlay={overlayA as never} />);

		window.dispatchEvent(new Event("chatwoot:on-message"));
		expect(setConversationCustomAttributes).toHaveBeenCalledTimes(1);
		expect(setConversationCustomAttributes).toHaveBeenCalledWith({
			overlay_id: "overlay-a",
			overlay_created_at: overlayA.createdAt,
		});

		window.dispatchEvent(new Event("chatwoot:on-message"));
		expect(setConversationCustomAttributes).toHaveBeenCalledTimes(1);

		rerender(<ChatwootData overlay={overlayB as never} />);
		window.dispatchEvent(new Event("chatwoot:on-message"));
		expect(setConversationCustomAttributes).toHaveBeenCalledTimes(2);
		expect(setConversationCustomAttributes).toHaveBeenLastCalledWith({
			overlay_id: "overlay-b",
			overlay_created_at: overlayB.createdAt,
		});
	});
});
