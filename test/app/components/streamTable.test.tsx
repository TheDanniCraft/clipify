import { render, screen, fireEvent } from "@testing-library/react";
import StreamTable from "@components/creator/streamTable";
import StreamThumbnail from "@components/creator/streamThumbnail";
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@components/localizedDate", () => ({ __esModule: true, default: () => null }));
jest.mock("@heroui/react", () => {
	const React = jest.requireActual("react");
	const Action = React.createContext(null);
	const wrap = ({ children }: any) => <div>{children}</div>;
	const Table = Object.assign(wrap, {
		ScrollContainer: wrap,
		Content: ({ children, onRowAction }: any) => <Action.Provider value={onRowAction}>{children}</Action.Provider>,
		Header: wrap,
		Column: wrap,
		Body: wrap,
		Row: ({ id, children }: any) => {
			const action = React.useContext(Action);
			return (
				<div>
					<button onClick={() => action(id)}>Open stream {id}</button>
					{children}
				</div>
			);
		},
		Cell: wrap,
	});
	return { Table, Link: ({ children, ...props }: any) => <a {...props}>{children}</a> };
});
it("wires row activation to the stream route while retaining title links and statistics", () => {
	render(
		<StreamTable
			streams={
				[
					{ id: "100", title: "Minecraft session", thumbnailUrl: null, clipCount: 12, clipViews: 100, createdAt: "2026-11-01T00:00:00Z", duration: "1h" },
					{ id: "200", title: "", thumbnailUrl: "https://static-cdn.jtvnw.net/clip.jpg", clipCount: null, clipViews: null, createdAt: "2026-11-01T00:00:00Z", duration: "1h" },
				] as never
			}
		/>,
	);
	fireEvent.click(screen.getByRole("button", { name: "Open stream 100" }));
	expect(push).toHaveBeenCalledWith("/dashboard/streams/100");
	expect(screen.getByRole("link", { name: "Minecraft session" })).toHaveAttribute("href", "/dashboard/streams/100");
	expect(screen.getByRole("link", { name: "Untitled stream" })).toBeVisible();
	expect(screen.getAllByText("Unavailable")).toHaveLength(2);
});
it("replaces failed thumbnails with the stable placeholder and permits a new image", () => {
	const view = render(<StreamThumbnail src='https://static-cdn.jtvnw.net/a.jpg' />);
	fireEvent.error(view.container.querySelector("img")!);
	expect(view.container.querySelector("img")).toBeNull();
	view.rerender(<StreamThumbnail src='https://static-cdn.jtvnw.net/b.jpg' className='w-20' />);
	expect(view.container.querySelector("img")).toHaveAttribute("src", "https://static-cdn.jtvnw.net/b.jpg");
	view.rerender(<StreamThumbnail src={null} />);
	expect(view.container.querySelector("img")).toBeNull();
});
