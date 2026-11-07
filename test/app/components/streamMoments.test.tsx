import { render, screen, fireEvent } from "@testing-library/react";
jest.mock(
	"@heroui-pro/react",
	() => {
		const React = jest.requireActual("react");
		const Open = React.createContext(false);
		const Timeline = Object.assign(({ children, ...props }: any) => <ol {...props}>{children}</ol>, { Item: ({ children }: any) => <li>{children}</li>, Marker: () => null, Content: ({ children }: any) => <div>{children}</div> });
		const HoverCard = Object.assign(({ children, open }: any) => <Open.Provider value={open}>{children}</Open.Provider>, {
			Trigger: ({ children }: any) => <span>{children}</span>,
			Content: ({ children, role, ...props }: any) =>
				React.useContext(Open) ? (
					<div role={role} aria-label={props["aria-label"]}>
						{children}
					</div>
				) : null,
		});
		return { Timeline, HoverCard };
	},
	{ virtual: true },
);
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
					{ id: "A", title: "", createdAt: "2026-11-02T00:00:00Z", thumbnailUrl: null, views: 0, duration: 10, vodOffsetSeconds: null },
					{ id: "B", title: "Winner", createdAt: "2026-11-02T01:00:00Z", thumbnailUrl: "https://static-cdn.jtvnw.net/b.jpg", views: 0, duration: 10, vodOffsetSeconds: null },
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

it("uses a vertical timeline and opens overlapping alternatives as a rich overview", async () => {
	render(
		<Moments
			creatorId='owner'
			clips={
				[
					{ id: "A", title: "Earlier", createdAt: "2026-11-02T00:00:00Z", thumbnailUrl: null, vodOffsetSeconds: 10, duration: 20, views: 2 },
					{ id: "B", title: "Popular", createdAt: "2026-11-02T00:00:02Z", thumbnailUrl: null, vodOffsetSeconds: 12, duration: 20, views: 30 },
				] as never
			}
		/>,
	);
	expect(screen.getByRole("list", { name: "Stream moments timeline" })).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "2 clips at 0:10" }));
	const overview = await screen.findByRole("dialog", { name: "Clips at 0:10" });
	expect(overview).toHaveTextContent("Earlier");
	fireEvent.click(screen.getByRole("button", { name: /Preview Popular/ }));
	expect(await screen.findByRole("dialog")).toHaveTextContent("B");
});

it("shows additional moments and preserves hour-long positions", () => {
	render(<Moments creatorId='owner' clips={Array.from({ length: 6 }, (_, i) => ({ id: `Clip${i}`, title: `Moment ${i}`, views: 10, duration: 10, thumbnailUrl: null, createdAt: "2026-11-02T00:00:00Z", vodOffsetSeconds: i * 3600 })) as never} />);
	expect(screen.getAllByRole("listitem")).toHaveLength(8);
	expect(screen.getByText("1:00:00 into stream")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: "Show more moments" }));
	expect(screen.getAllByRole("listitem")).toHaveLength(8);
	expect(screen.queryByRole("button", { name: "Show more moments" })).toBeNull();
});
it("closes the complete stream timeline with explicit start and end markers", () => {
	render(<Moments creatorId='owner' duration='2h10m' startedAt='2026-11-02T00:00:00Z' clips={[{ id: "A", title: "First moment", createdAt: "2026-11-02T00:01:00Z", thumbnailUrl: null, views: 5, duration: 10, vodOffsetSeconds: 60 }] as never} />);
	const items = screen.getAllByRole("listitem");
	expect(items[0]).toHaveTextContent("Stream start");
	expect(items.at(-1)).toHaveTextContent("Stream end");
	expect(items.at(-1)).toHaveTextContent("2h10m");
});
