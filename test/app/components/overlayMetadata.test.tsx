import { render, screen } from "@testing-library/react";
import { OverlayChannelMetadata, OverlayClipMetadata } from "@components/overlayMetadata";
jest.mock("@heroui/react", () => jest.requireActual("../../__mocks__/heroui-react.cjs"));
it("reuses contextual channel and clip groups with missing-credit recovery", () => {
	const view = render(
		<>
			<OverlayChannelMetadata name='Creator' avatar='https://example.com/avatar.png' category='Just Chatting' />
			<OverlayClipMetadata title='An excellent clip' clipper='Viewer' />
		</>,
	);
	expect(screen.getByText("Creator")).toBeInTheDocument();
	expect(screen.getByText("Playing Just Chatting")).toBeInTheDocument();
	expect(screen.getByText("clipped by Viewer")).toBeInTheDocument();
	view.rerender(
		<>
			<OverlayChannelMetadata name='Creator' mirrored />
			<OverlayClipMetadata title='' alignRight />
		</>,
	);
	expect(screen.getByText("Twitch channel")).toBeInTheDocument();
	expect(screen.getByText("Twitch clip")).toBeInTheDocument();
	expect(screen.getByText("Untitled clip")).toBeInTheDocument();
});
