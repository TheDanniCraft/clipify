import { render, screen, fireEvent } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import React from "react";
import AppPagination from "@components/appPagination";
jest.mock("@heroui/react", () => {
	const Part = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
	const Control = ({ children, isDisabled, onPress }: { children: React.ReactNode; isDisabled: boolean; onPress: () => void }) => (
		<button disabled={isDisabled} onClick={onPress}>
			{children}
		</button>
	);
	return { Pagination: Object.assign(Part, { Content: Part, Item: Part, Previous: Control, Next: Control, Link: Control, Ellipsis: () => <span>…</span>, PreviousIcon: () => null, NextIcon: () => null }) };
});
it("prevents pagination interaction in server HTML until client controls are ready", () => {
	const html = renderToString(<AppPagination page={2} total={3} onChange={() => {}} />);
	expect(html.match(/disabled=""/g) || []).toHaveLength(5);
});
it("allows compact numbered and adjacent navigation after hydration", () => {
	const change = jest.fn();
	render(<AppPagination page={4} total={10} onChange={change} />);
	fireEvent.click(screen.getByRole("button", { name: "Next" }));
	fireEvent.click(screen.getByRole("button", { name: "Previous" }));
	fireEvent.click(screen.getByRole("button", { name: "5" }));
	expect(change.mock.calls).toEqual([[5], [3], [5]]);
	expect(screen.getAllByText("…")).toHaveLength(2);
});
it("hides unnecessary pagination and disables the first and last boundaries", () => {
	const view = render(<AppPagination page={1} total={1} onChange={() => {}} />);
	expect(screen.queryByRole("button")).toBeNull();
	view.rerender(<AppPagination page={1} total={1} showSinglePage onChange={() => {}} />);
	expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
	expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
});

it("keeps a million-page inventory bounded and disables controls while loading", () => {
	render(<AppPagination page={500000} total={1000000} onChange={jest.fn()} isDisabled />);
	expect(screen.getAllByRole("button")).toHaveLength(7);
	expect(screen.getAllByText("…")).toHaveLength(2);
	for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
});
