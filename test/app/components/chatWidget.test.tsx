import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ChatWidget from "@/app/components/chatWidget";
import { OPEN_CONSENT_PREFERENCES_EVENT } from "@/app/lib/consent/events";
import { chatwootConsentScript } from "@/app/lib/consent/chatwoot";

const mockUseScriptLoader = jest.fn();
let mockFunctionalityAllowed = false;
let mockBannerVisible = false;
let mockDialogVisible = false;
const mockOpenDialog = jest.fn();
let mockPathname = "/";
let mockIsEmbedded = false;

function mountChatwootWidget() {
	const bubble = document.createElement("div");
	bubble.className = "woot--bubble-holder";
	const widget = document.createElement("div");
	widget.className = "woot-widget-holder";
	document.body.append(bubble, widget);
}

jest.mock("next/navigation", () => ({
	usePathname: () => mockPathname,
}));

jest.mock("@/app/lib/embeddedRoutes", () => ({
	isEmbeddedRoute: () => mockIsEmbedded,
}));

jest.mock("c15t/next", () => ({
	useConsent: () => mockFunctionalityAllowed,
	useScriptLoader: (scripts: unknown) => mockUseScriptLoader(scripts),
}));

jest.mock("c15t/next/headless", () => ({
	useHeadlessConsentUI: () => ({ openDialog: mockOpenDialog, banner: { isVisible: mockBannerVisible }, dialog: { isVisible: mockDialogVisible } }),
}));

jest.mock("@heroui/react", () => ({
	Button: ({ onPress, children, "aria-label": ariaLabel }: { onPress?: () => void; children: React.ReactNode; "aria-label"?: string }) => (
		<button onClick={onPress} aria-label={ariaLabel}>
			{children}
		</button>
	),
}));

jest.mock("@tabler/icons-react", () => ({
	IconMessageCircle: () => <span aria-hidden='true'>chat</span>,
}));

describe("components/ChatWidget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPathname = "/";
		mockIsEmbedded = false;
		delete window.chatwootSDK;
		delete window.$chatwoot;
		document.querySelectorAll(".woot--bubble-holder, .woot-widget-holder").forEach((element) => element.remove());
		mockFunctionalityAllowed = false;
		mockBannerVisible = false;
		mockDialogVisible = false;
	});

	it("registers Chatwoot with c15t and offers consent while functionality is denied", () => {
		const openPreferences = jest.fn();
		window.addEventListener(OPEN_CONSENT_PREFERENCES_EVENT, openPreferences);

		render(<ChatWidget />);

		expect(mockUseScriptLoader).toHaveBeenCalledWith([chatwootConsentScript]);
		fireEvent.click(screen.getByRole("button", { name: "Enable support chat" }));
		expect(mockOpenDialog).toHaveBeenCalledTimes(1);
		expect(openPreferences).toHaveBeenCalledTimes(1);

		window.removeEventListener(OPEN_CONSENT_PREFERENCES_EVENT, openPreferences);
	});

	it("does not compete with Chatwoot while the consent script is loading", () => {
		mockFunctionalityAllowed = true;

		render(<ChatWidget />);

		expect(screen.queryByRole("button", { name: "Enable support chat" })).not.toBeInTheDocument();
	});

	it("does not render over an already available Chatwoot widget even if consent state is stale", () => {
		window.$chatwoot = {} as NonNullable<Window["$chatwoot"]>;

		render(<ChatWidget />);

		expect(screen.queryByRole("button", { name: "Enable support chat" })).not.toBeInTheDocument();
	});

	it("closes and hides Chatwoot when client navigation enters an embedded route", () => {
		mountChatwootWidget();
		const toggle = jest.fn();
		const toggleBubbleVisibility = jest.fn();
		window.$chatwoot = { toggle, toggleBubbleVisibility } as unknown as NonNullable<Window["$chatwoot"]>;
		mockFunctionalityAllowed = true;
		const { rerender } = render(<ChatWidget />);

		toggle.mockClear();
		toggleBubbleVisibility.mockClear();
		mockPathname = "/embed/overlay-1";
		mockIsEmbedded = true;
		rerender(<ChatWidget />);

		expect(toggle).toHaveBeenCalledWith("close");
		expect(toggleBubbleVisibility).toHaveBeenCalledWith("hide");
		expect(mockUseScriptLoader).toHaveBeenLastCalledWith([]);
	});

	it("hides Chatwoot if it becomes ready after an embedded route mounted", () => {
		mockPathname = "/overlay/overlay-1";
		mockIsEmbedded = true;
		mockFunctionalityAllowed = true;
		render(<ChatWidget />);
		const toggle = jest.fn();
		const toggleBubbleVisibility = jest.fn();
		window.$chatwoot = { toggle, toggleBubbleVisibility } as unknown as NonNullable<Window["$chatwoot"]>;
		mountChatwootWidget();

		fireEvent(window, new Event("chatwoot:ready"));

		expect(toggle).toHaveBeenCalledWith("close");
		expect(toggleBubbleVisibility).toHaveBeenCalledWith("hide");
	});

	it("restores the Chatwoot bubble after leaving an embedded route with consent", () => {
		mountChatwootWidget();
		const toggleBubbleVisibility = jest.fn();
		window.$chatwoot = { toggle: jest.fn(), toggleBubbleVisibility } as unknown as NonNullable<Window["$chatwoot"]>;
		mockFunctionalityAllowed = true;
		mockPathname = "/gallery/gallery-1/frame";
		mockIsEmbedded = true;
		const { rerender } = render(<ChatWidget />);

		toggleBubbleVisibility.mockClear();
		mockPathname = "/";
		mockIsEmbedded = false;
		rerender(<ChatWidget />);

		expect(toggleBubbleVisibility).toHaveBeenCalledWith("show");
	});

	it("waits for Chatwoot to mount its DOM before changing bubble visibility", () => {
		const toggleBubbleVisibility = jest.fn();
		window.$chatwoot = { toggle: jest.fn(), toggleBubbleVisibility } as unknown as NonNullable<Window["$chatwoot"]>;
		mockFunctionalityAllowed = true;

		render(<ChatWidget />);

		expect(toggleBubbleVisibility).not.toHaveBeenCalled();
		mountChatwootWidget();
		fireEvent(window, new Event("chatwoot:ready"));
		expect(toggleBubbleVisibility).toHaveBeenCalledWith("show");
	});

	it("keeps the support fallback out of privacy choices and restores it afterward", () => {
		mockFunctionalityAllowed = false;
		mockBannerVisible = true;
		mockDialogVisible = false;
		const { rerender } = render(<ChatWidget />);
		expect(screen.queryByRole("button", { name: "Enable support chat" })).not.toBeInTheDocument();
		mockBannerVisible = false;
		mockDialogVisible = true;
		rerender(<ChatWidget />);
		expect(screen.queryByRole("button", { name: "Enable support chat" })).not.toBeInTheDocument();
		mockDialogVisible = false;
		rerender(<ChatWidget />);
		expect(screen.getByRole("button", { name: "Enable support chat" })).toBeVisible();
	});
	it("hides an already mounted support widget while privacy choices are open", () => {
		mockBannerVisible = false;
		mockDialogVisible = false;
		mockFunctionalityAllowed = true;
		const toggle = jest.fn(),
			toggleBubbleVisibility = jest.fn();
		window.$chatwoot = { toggle, toggleBubbleVisibility } as unknown as NonNullable<Window["$chatwoot"]>;
		mountChatwootWidget();
		const { rerender } = render(<ChatWidget />);
		toggleBubbleVisibility.mockClear();
		mockBannerVisible = true;
		rerender(<ChatWidget />);
		expect(toggle).toHaveBeenCalledWith("close");
		expect(toggleBubbleVisibility).toHaveBeenCalledWith("hide");
		mockBannerVisible = false;
		rerender(<ChatWidget />);
		expect(toggleBubbleVisibility).toHaveBeenLastCalledWith("show");
	});
});
