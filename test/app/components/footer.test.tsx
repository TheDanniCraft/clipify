/** @jest-environment jsdom */
import { renderToStaticMarkup } from "react-dom/server";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Footer from "@/app/components/footer";

const subscribe = jest.fn();
const status = jest.fn();
const community = jest.fn();
const plausible = jest.fn();
const theme = jest.fn();
let verification: { onSuccess: (token: string) => void; onExpire: () => void; onError: (error: string) => void };
jest.mock("nextjs-turnstile", () => ({
	Turnstile: (props: typeof verification & { size: string; appearance: string; theme: string }) => {
		verification = props;
		return (
			<div data-testid='newsletter-verification' data-size={props.size} data-appearance={props.appearance} data-theme={props.theme}>
				Verification
			</div>
		);
	},
}));
jest.mock("axios", () => ({ get: (...args: unknown[]) => status(...args) }));
jest.mock("@actions/newsletter", () => ({ subscribeToNewsletter: (...args: unknown[]) => subscribe(...args), getEmailProvider: async () => "example" }));
jest.mock("@actions/community", () => ({ getPublicCommunityFooterTeaserAction: () => community() }));
jest.mock("@actions/rateLimit", () => ({ isRatelimitError: async (result: unknown) => result === "rate-limit" }));
jest.mock("@lib/analytics", () => ({ trackEvent: (...args: unknown[]) => plausible(...args), trackProductEvent: jest.fn() }));
jest.mock("next-themes", () => ({ useTheme: () => ({ setTheme: theme, resolvedTheme: "dark" }) }));
jest.mock("@components/logo", () => ({ __esModule: true, default: () => <span>Clipify</span> }));
jest.mock("@components/LandingPage/communityTeaser", () => ({ __esModule: true, default: () => <span>Creator community</span> }));
jest.mock("next/image", () => ({ __esModule: true, default: ({ alt }: { alt: string }) => <span>{alt}</span> }));
jest.mock("motion/react", () => {
	const React = require("react");
	return {
		motion: {
			div: React.forwardRef(function MotionDiv({ children, animate: _a, transition: _t, initial: _i, ...props }: any, ref: any) {
				return (
					<div ref={ref} {...props}>
						{children}
					</div>
				);
			}),
		},
	};
});
jest.mock("@heroui/react", () => {
	const React = require("react");
	const Box = ({ children }: any) => <div>{children}</div>;
	const Input = ({ fullWidth: _f, variant: _v, ...props }: any) => <input {...props} />;
	const Button = ({ children, onPress, isDisabled, isIconOnly: _i, size: _s, variant: _v, ...props }: any) => (
		<button {...props} disabled={isDisabled} onClick={onPress}>
			{children}
		</button>
	);
	const ModalContext = React.createContext(() => {});
	return {
		Card: Object.assign(Box, { Content: Box }),
		Separator: () => <hr />,
		Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
		Input,
		Button,
		TextField: Box,
		Label: Box,
		FieldError: Box,
		Spinner: () => <span>Loading</span>,
		Link: ({ children, onPress, ...props }: any) => (
			<a {...props} onClick={onPress}>
				{children}
			</a>
		),
		InputGroup: Object.assign(Box, { Prefix: Box, Suffix: Box, Input: (props: any) => <input {...props} type='email' name='email' aria-label='Newsletter email address' /> }),
		Modal: {
			Backdrop: ({ isOpen, onOpenChange, children }: any) => (isOpen ? <ModalContext.Provider value={onOpenChange}>{children}</ModalContext.Provider> : null),
			Container: Box,
			Dialog: ({ children }: any) => <div role='dialog'>{children}</div>,
			Body: Box,
			Header: Box,
			Heading: Box,
			CloseTrigger: (props: any) => {
				const close = React.useContext(ModalContext);
				return (
					<button {...props} onClick={() => close(false)}>
						Close
					</button>
				);
			},
		},
	};
});
const previousMode = process.env.E2E_TEST_MODE;
beforeEach(() => {
	jest.clearAllMocks();
	process.env.E2E_TEST_MODE = "false";
	status.mockResolvedValue({ data: { status: "UP" } });
	community.mockResolvedValue({ streamers: [], totalCount: 0 });
	subscribe.mockResolvedValue({ success: true });
});
afterEach(() => {
	if (previousMode === undefined) delete process.env.E2E_TEST_MODE;
	else process.env.E2E_TEST_MODE = previousMode;
});
async function start(email = "streamer@example.invalid") {
	render(<Footer />);
	const input = screen.getByRole("textbox", { name: "Newsletter email address" });
	fireEvent.focus(input);
	fireEvent.change(input, { target: { value: email } });
	fireEvent.submit(input.closest("form")!);
	await screen.findByTestId("newsletter-verification");
	await act(async () => verification.onSuccess("fixture-verification"));
	return input;
}
it("loads compact verification only inside the modal and requires a valid unexpired token", async () => {
	render(<Footer />);
	await screen.findByText("All systems operational");
	expect(screen.queryByTestId("newsletter-verification")).not.toBeInTheDocument();
	const input = screen.getByRole("textbox", { name: "Newsletter email address" });
	fireEvent.change(input, { target: { value: "streamer@example.invalid" } });
	fireEvent.submit(input.closest("form")!);
	const widget = await screen.findByTestId("newsletter-verification");
	expect(widget.closest('[role="dialog"]')).not.toBeNull();
	expect(widget).toHaveAttribute("data-size", "compact");
	expect(widget).toHaveAttribute("data-appearance", "always");
	expect(widget).toHaveAttribute("data-theme", "dark");
	const submit = screen.getByRole("button", { name: /^Subscribe$/ });
	expect(submit).toBeDisabled();
	fireEvent.submit(screen.getByPlaceholderText("Streamer").closest("form")!);
	expect(subscribe).not.toHaveBeenCalled();
	expect(screen.getByText("Complete verification to subscribe.")).toBeVisible();
	await act(async () => verification.onSuccess("fixture-verification"));
	expect(submit).toBeEnabled();
	await act(async () => verification.onExpire());
	expect(submit).toBeDisabled();
});

it("preserves the email and optional-name workflow through success and confirmation dismissal", async () => {
	await start("real.streamer@example.invalid");
	const name = screen.getByPlaceholderText("Streamer");
	expect(name).toHaveFocus();
	fireEvent.change(name, { target: { value: "Alex" } });
	fireEvent.submit(name.closest("form")!);
	await screen.findByText("You're almost there!");
	expect(subscribe).toHaveBeenCalledWith("real.streamer@example.invalid", "fixture-verification", { firstName: "Alex" });
	await waitFor(() => expect(plausible).toHaveBeenCalledWith("Newsletter Subscription", { emailType: "example" }));
	fireEvent.click(screen.getByRole("button", { name: "Close newsletter confirmation" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("lets a creator omit a name and recover after a server failure", async () => {
	subscribe.mockResolvedValueOnce(new Error("unavailable"));
	await start();
	fireEvent.click(screen.getByRole("button", { name: /^Subscribe$/ }));
	await screen.findByText("Could not subscribe right now. Please try again.");
	expect(subscribe).toHaveBeenCalledWith("streamer@example.invalid", "fixture-verification", undefined);
	await act(async () => verification.onSuccess("fresh-verification"));
	fireEvent.click(screen.getByRole("button", { name: /^Subscribe$/ }));
	await screen.findByText("You're almost there!");
});
it("keeps pending details after rate limiting or a rejected request", async () => {
	subscribe.mockResolvedValueOnce("rate-limit").mockRejectedValueOnce(new Error("offline"));
	await start("mail@example.invalid");
	expect(screen.getByPlaceholderText("First name")).toBeVisible();
	fireEvent.click(screen.getByRole("button", { name: /^Subscribe$/ }));
	await screen.findByText("Too many attempts. Please wait a moment.");
	await act(async () => verification.onSuccess("fresh-verification"));
	fireEvent.click(screen.getByRole("button", { name: /^Subscribe$/ }));
	await screen.findByText("Could not subscribe right now. Please try again.");
});
it("allows backing out of details and does not submit after verification expires", async () => {
	const input = await start();
	fireEvent.click(screen.getByRole("button", { name: "Cancel newsletter signup" }));
	expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	fireEvent.change(input, { target: { value: "" } });
	fireEvent.submit(input.closest("form")!);
	expect(subscribe).not.toHaveBeenCalled();
	fireEvent.change(input, { target: { value: "other@example.invalid" } });
	fireEvent.submit(input.closest("form")!);
	await act(async () => verification.onExpire());
	fireEvent.submit(screen.getByPlaceholderText("Other").closest("form")!);
	await screen.findByText("Complete verification to subscribe.");
	expect(subscribe).not.toHaveBeenCalled();
});

it("keeps the footer action disabled in server HTML before hydration", () => {
	const container = document.createElement("div");
	container.innerHTML = renderToStaticMarkup(<Footer />);
	expect(container.querySelector('button[aria-label="Continue newsletter signup"]')).toBeDisabled();
	expect(subscribe).not.toHaveBeenCalled();
});
