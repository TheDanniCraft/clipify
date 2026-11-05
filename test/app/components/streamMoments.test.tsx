import { render, screen, fireEvent } from "@testing-library/react";
import Moments from "@components/creator/streamMoments";
jest.mock("@components/creator/clipPreview", () => ({
	__esModule: true,
	default: ({ clip, onClose }: { clip: { id: string }; onClose: () => void }) => (
		<div role='dialog'>
			{clip.id}
			<button onClick={onClose}>Close preview</button>
		</div>
	),
}));
jest.mock("@components/localizedDate", () => ({ __esModule: true, default: () => null }));
it("omits an empty strip and previews the exact selected moment", () => {
	const view = render(<Moments creatorId='owner' clips={[]} />);
	expect(screen.queryByRole("button")).toBeNull();
	view.rerender(
		<Moments
			creatorId='owner'
			clips={
				[
					{ id: "A", title: "", createdAt: "2026-11-02T00:00:00Z", thumbnailUrl: null },
					{ id: "B", title: "Winner", createdAt: "2026-11-02T01:00:00Z", thumbnailUrl: "https://static-cdn.jtvnw.net/b.jpg" },
				] as never
			}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Winner" }));
	expect(screen.getByRole("dialog")).toHaveTextContent("B");
	fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
	expect(screen.queryByRole("dialog")).toBeNull();
	expect(screen.getByRole("button", { name: "Untitled clip" })).toBeVisible();
});
