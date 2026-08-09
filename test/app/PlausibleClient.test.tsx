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
	it("keeps the next-plausible provider enabled for regular and embedded pages", () => {
		render(
			<PlausibleClient>
				<span>child</span>
			</PlausibleClient>,
		);

		expect(screen.getByTestId("plausible-provider")).toHaveAttribute("data-enabled", "true");
		expect(screen.getByText("child")).toBeInTheDocument();
	});
});
