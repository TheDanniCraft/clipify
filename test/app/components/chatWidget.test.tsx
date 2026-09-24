import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import ChatWidget from "@/app/components/chatWidget";
import { OPEN_CONSENT_PREFERENCES_EVENT } from "@/app/lib/consent/events";
import { chatwootConsentScript } from "@/app/lib/consent/chatwoot";

const mockUseConsentScript = jest.fn();
const mockOpenDialog = jest.fn();

jest.mock("next/navigation", () => ({
	usePathname: () => "/",
}));

jest.mock("@/app/lib/embeddedRoutes", () => ({
	isEmbeddedRoute: () => false,
}));

jest.mock("@c15t/nextjs", () => ({
	useConsentScript: (options: unknown) => mockUseConsentScript(options),
}));

jest.mock("@c15t/nextjs/headless", () => ({
	useHeadlessConsentUI: () => ({ openDialog: mockOpenDialog }),
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
		delete window.chatwootSDK;
		delete window.$chatwoot;
		mockUseConsentScript.mockReturnValue({ status: "blocked" });
	});

	it("registers Chatwoot with c15t and offers consent while functionality is denied", () => {
		const openPreferences = jest.fn();
		window.addEventListener(OPEN_CONSENT_PREFERENCES_EVENT, openPreferences);

		render(<ChatWidget />);

		expect(mockUseConsentScript).toHaveBeenCalledWith(expect.objectContaining({ script: chatwootConsentScript, enabled: true }));
		fireEvent.click(screen.getByRole("button", { name: "Enable support chat" }));
		expect(mockOpenDialog).toHaveBeenCalledTimes(1);
		expect(openPreferences).toHaveBeenCalledTimes(1);

		window.removeEventListener(OPEN_CONSENT_PREFERENCES_EVENT, openPreferences);
	});

	it.each(["idle", "loading", "ready", "error"])("does not compete with Chatwoot while the consent script is %s", (status) => {
		mockUseConsentScript.mockReturnValue({ status });

		render(<ChatWidget />);

		expect(screen.queryByRole("button", { name: "Enable support chat" })).not.toBeInTheDocument();
	});

	it("does not render over an already available Chatwoot widget even if consent state is stale", () => {
		window.$chatwoot = {} as NonNullable<Window["$chatwoot"]>;

		render(<ChatWidget />);

		expect(screen.queryByRole("button", { name: "Enable support chat" })).not.toBeInTheDocument();
	});
});
