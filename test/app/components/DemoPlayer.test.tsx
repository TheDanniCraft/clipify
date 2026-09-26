import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import DemoPlayer, { nextDemoViewerCount } from "@/app/components/DemoPlayer";
import FakeTwitchChat from "@/app/components/DemoPlayer/FakeTwitchChat";
import StreamingSoftwareMock from "@/app/components/DemoPlayer/StreamingSoftwareMock";

jest.mock("@/app/components/DemoPlayer/StreamingWithChatMock", () => ({
	__esModule: true,
	default: ({ children, chatVariant, viewerCount, onChatVariantChange }: { children: React.ReactNode; chatVariant: string; viewerCount: number; onChatVariantChange: (variant: "clipify" | "brb") => void }) => (
		<div data-testid='stream-mock' data-chat-variant={chatVariant}>
			<span>{viewerCount} viewers</span>
			<button type='button' onClick={() => onChatVariantChange("clipify")}>
				With Clipify
			</button>
			<button type='button' onClick={() => onChatVariantChange("brb")}>
				Without Clipify
			</button>
			{children}
		</div>
	),
}));

describe("components/DemoPlayer", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("keeps the Clipify audience stable and models a declining BRB audience", () => {
		expect(nextDemoViewerCount(128, "clipify", 0)).toBe(128);
		expect(nextDemoViewerCount(128, "clipify", 1)).toBe(129);
		expect(nextDemoViewerCount(128, "brb", 0)).toBe(125);
		expect(nextDemoViewerCount(2, "brb", 1)).toBe(0);
	});

	it("switches between the interactive Clipify player and a static break screen", () => {
		jest.useFakeTimers();
		render(<DemoPlayer />);

		expect(screen.getByTitle("Interactive demo player")).toBeInTheDocument();
		expect(screen.getByTestId("stream-mock")).toHaveAttribute("data-chat-variant", "clipify");
		expect(screen.getByText("128 viewers")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Without Clipify" }));

		expect(screen.queryByTitle("Interactive demo player")).not.toBeInTheDocument();
		expect(screen.getByRole("img", { name: "A static be right back screen" })).toBeInTheDocument();
		expect(screen.getByTestId("stream-mock")).toHaveAttribute("data-chat-variant", "brb");

		act(() => jest.advanceTimersByTime(1800));
		expect(screen.getByText("125 viewers")).toBeInTheDocument();
	});

	it("uses the OBS scenes dock as the comparison control", () => {
		const onDemoModeChange = jest.fn();
		const { rerender } = render(
			<StreamingSoftwareMock isLive={false} demoMode='clipify' onDemoModeChange={onDemoModeChange}>
				<div>Preview</div>
			</StreamingSoftwareMock>,
		);

		expect(screen.getByText("Try it: switch scenes and watch the audience react.")).toBeInTheDocument();
		expect(screen.getByText("Try me")).toBeInTheDocument();
		expect(screen.getByText("Browser · Clipify Overlay")).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: /Without Clipify/ }));
		expect(onDemoModeChange).toHaveBeenCalledWith("brb");
		expect(screen.queryByText("Try me")).not.toBeInTheDocument();

		rerender(
			<StreamingSoftwareMock isLive={false} demoMode='brb' onDemoModeChange={onDemoModeChange}>
				<div>Preview</div>
			</StreamingSoftwareMock>,
		);
		expect(screen.getByText("Image · BRB Screen")).toBeInTheDocument();
	});

	it("shows the simulated audience inside the stream chat header", () => {
		jest.useFakeTimers();
		render(<FakeTwitchChat isLive variant='brb' viewerCount={125} initialCount={0} />);

		expect(screen.getByLabelText("125 simulated viewers")).toHaveTextContent("125 viewers");
	});
});
