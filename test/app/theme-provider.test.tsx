import { render, screen } from "@testing-library/react";
import ThemeProvider from "../../src/app/theme-provider";

let currentPathname = "/";
const nextThemesProvider = jest.fn(({ children }: { children?: React.ReactNode }) => <div data-testid='next-themes-provider'>{children}</div>);

jest.mock("next/navigation", () => ({
	usePathname: () => currentPathname,
}));

jest.mock("next-themes", () => ({
	ThemeProvider: (props: { children?: React.ReactNode }) => nextThemesProvider(props),
}));

describe("ThemeProvider", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("wraps normal routes in next-themes", () => {
		currentPathname = "/dashboard";
		render(
			<ThemeProvider>
				<span>content</span>
			</ThemeProvider>,
		);

		expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
		expect(screen.getByText("content")).toBeInTheDocument();
		expect(nextThemesProvider).toHaveBeenCalledTimes(1);
	});

	it("skips next-themes for embedded routes", () => {
		currentPathname = "/gallery/gallery-1/frame";
		render(
			<ThemeProvider>
				<span>content</span>
			</ThemeProvider>,
		);

		expect(screen.queryByTestId("next-themes-provider")).toBeNull();
		expect(screen.getByText("content")).toBeInTheDocument();
		expect(nextThemesProvider).not.toHaveBeenCalled();
	});
});
