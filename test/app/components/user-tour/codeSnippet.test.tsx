import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CodeSnippet from "@components/codeSnippet";
it("reports copy only after the clipboard promise succeeds", async () => {
	const copied = jest.fn();
	let resolve!: () => void;
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: {
			writeText: jest.fn(
				() =>
					new Promise<void>((done) => {
						resolve = done;
					}),
			),
		},
	});
	render(<CodeSnippet onCopied={copied}>private-url</CodeSnippet>);
	fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
	expect(copied).not.toHaveBeenCalled();
	resolve();
	await waitFor(() => expect(copied).toHaveBeenCalledTimes(1));
});
it("does not report a rejected clipboard write", async () => {
	const copied = jest.fn();
	Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: jest.fn().mockRejectedValue(new Error("denied")) } });
	render(<CodeSnippet onCopied={copied}>private-url</CodeSnippet>);
	fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));
	await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
	expect(copied).not.toHaveBeenCalled();
});
