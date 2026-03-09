import { render, screen } from "@testing-library/react";

const usePathname = jest.fn();

jest.mock("next/navigation", () => ({
	usePathname: (...args: unknown[]) => usePathname(...args),
}));

jest.mock("next-plausible", () => ({
	__esModule: true,
	default: ({ children }: { children: unknown }) => <div data-testid='plausible-provider'>{children as never}</div>,
}));

import PlausibleClient from "@/app/PlausibleClient";

const originalSelf = window.self;
const originalReferrer = document.referrer;

function setEmbeddedState(embedded: boolean) {
	if (embedded) {
		Object.defineProperty(window, "self", { configurable: true, value: {} });
		return;
	}
	Object.defineProperty(window, "self", { configurable: true, value: window });
}

function setReferrer(referrer: string) {
	Object.defineProperty(document, "referrer", {
		configurable: true,
		value: referrer,
	});
}

describe("PlausibleClient", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		usePathname.mockReturnValue("/");
		setEmbeddedState(false);
		setReferrer("");
	});

	afterAll(() => {
		Object.defineProperty(window, "self", { configurable: true, value: originalSelf });
		Object.defineProperty(document, "referrer", { configurable: true, value: originalReferrer });
	});

	it("wraps children with Plausible provider on regular routes", () => {
		render(
			<PlausibleClient>
				<span>child</span>
			</PlausibleClient>,
		);

		expect(screen.getByTestId("plausible-provider")).toBeInTheDocument();
		expect(screen.getByText("child")).toBeInTheDocument();
	});

	it("disables provider for same-host embedded /embed routes", () => {
		usePathname.mockReturnValue("/embed/overlay-1");
		setEmbeddedState(true);
		setReferrer("https://localhost/dashboard");

		render(
			<PlausibleClient>
				<span>child</span>
			</PlausibleClient>,
		);

		expect(screen.queryByTestId("plausible-provider")).not.toBeInTheDocument();
		expect(screen.getByText("child")).toBeInTheDocument();
	});

	it("keeps provider enabled for external embeds", () => {
		usePathname.mockReturnValue("/embed/overlay-1");
		setEmbeddedState(true);
		setReferrer("https://example.com/page");

		render(
			<PlausibleClient>
				<span>child</span>
			</PlausibleClient>,
		);

		expect(screen.getByTestId("plausible-provider")).toBeInTheDocument();
	});
});
