import ToolsClient from "@components/tools/ToolsClient";
import { render, screen } from "@testing-library/react";

jest.mock("@actions/gallery", () => ({ getGalleryPreview: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@components/codeSnippet", () => ({
	__esModule: true,
	default: ({ children }: { children: React.ReactNode }) => <pre>{children}</pre>,
}));
jest.mock("@components/clipifyElementPreview", () => ({
	__esModule: true,
	default: () => <div>Player preview</div>,
}));
jest.mock("@components/gallery/GalleryInlinePreview", () => ({
	__esModule: true,
	default: () => <div>Gallery preview</div>,
}));
jest.mock("@heroui/react", () => {
	type Children = { children?: React.ReactNode };
	const Container = ({ children }: Children) => <div>{children}</div>;
	const Card = Object.assign(Container, { Header: Container, Content: Container, Footer: Container });
	const Link = Object.assign(({ children, ...props }: Children & React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>, { Icon: () => <span aria-hidden='true'>external</span> });
	const Tabs = Object.assign(Container, { ListContainer: Container, List: Container, Tab: Container, Indicator: Container });
	const Select = Object.assign(Container, { Trigger: Container, Value: Container, Indicator: Container, Popover: Container });
	const ListBox = Object.assign(Container, { Item: Object.assign(Container, { ItemIndicator: Container }) });
	const Switch = Object.assign(({ children }: Children) => <div>{children}</div>, { Content: Container, Control: Container, Thumb: Container });
	return {
		Button: ({ children }: Children) => <button>{children}</button>,
		Card,
		Label: Container,
		Link,
		ListBox,
		Select,
		Separator: () => <hr />,
		Switch,
		Tabs,
	};
});

describe("ToolsClient", () => {
	it("links the Clipify Elements installation action to the published Help Center article", () => {
		render(<ToolsClient overlays={[]} galleries={[]} initialTool='player' origin='https://clipify.us' />);

		const installationLink = screen.getByRole("link", { name: /Install Clipify Elements/i });
		expect(installationLink).toHaveAttribute("href", "https://help.clipify.us/hc/clipify/articles/install-clipify-elements");
		expect(installationLink).toHaveAttribute("target", "_blank");
		expect(screen.queryByText("Add the framework-neutral module once, then place as many Clipify elements as you need.")).not.toBeInTheDocument();
	});
});
