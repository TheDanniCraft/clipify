import { render, screen } from "@testing-library/react";

jest.mock("next-plausible", () => ({
	__esModule: true,
	default: ({ children, enabled }: { children: React.ReactNode; enabled?: boolean }) => (
		<div data-testid='plausible-provider' data-enabled={String(enabled)}>
			{children}
		</div>
	),
}));

import PlausibleClient from "@/app/PlausibleClient";

describe("PlausibleClient", () => {
	const originalE2eMode = process.env.E2E_TEST_MODE;

	afterEach(() => {
		if (originalE2eMode === undefined) delete process.env.E2E_TEST_MODE;
		else process.env.E2E_TEST_MODE = originalE2eMode;
	});

	it("keeps the next-plausible provider enabled for regular and embedded pages", () => {
		render(
			<PlausibleClient>
				<span>child</span>
			</PlausibleClient>,
		);

		expect(screen.getByTestId("plausible-provider")).toHaveAttribute("data-enabled", "true");
		expect(screen.getByText("child")).toBeInTheDocument();
	});

	it("disables analytics only for the isolated Playwright application", () => {
		process.env.E2E_TEST_MODE = "true";

		render(
			<PlausibleClient>
				<span>child</span>
			</PlausibleClient>,
		);

		expect(screen.getByTestId("plausible-provider")).toHaveAttribute("data-enabled", "false");
	});
});
