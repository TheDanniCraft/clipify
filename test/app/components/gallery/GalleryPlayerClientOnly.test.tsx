import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("@components/gallery/GalleryPlayer", () => ({ __esModule: true, default: () => <div>Player</div> }));

let playerLoader: (() => Promise<unknown>) | undefined;
const dynamic = jest.fn((loader, options) => {
	playerLoader = loader;
	return function DynamicGalleryPlayer() {
		return <div>{options.loading()}</div>;
	};
});

jest.mock("next/dynamic", () => ({ __esModule: true, default: (loader: () => Promise<unknown>, options: { loading: () => React.ReactNode }) => dynamic(loader, options) }));

describe("GalleryPlayerClientOnly", () => {
	it("loads the player client-side and provides a transparent loading surface", async () => {
		const Component = (await import("@components/gallery/GalleryPlayerClientOnly")).default;
		render(<Component {...({} as React.ComponentProps<typeof Component>)} />);
		expect(dynamic).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ ssr: false, loading: expect.any(Function) }));
		expect(await playerLoader?.()).toEqual(expect.objectContaining({ default: expect.any(Function) }));
		expect(screen.getByText("Loading player…")).toBeInTheDocument();
	});
});
