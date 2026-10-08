jest.mock("@heroui/react", () => {
	const React = require("react");
	const Slot = ({ children }: any) => React.createElement("div", null, children);
	return { ...require("../../support/mcp/heroui-fixture").components, Tabs: Object.assign(Slot, { ListContainer: Slot, List: Slot, Tab: Slot, Indicator: () => null, Panel: Slot }) };
});
jest.mock(
	"@heroui-pro/react/code-block",
	() => {
		const React = require("react");
		const Slot = ({ children }: any) => React.createElement("div", null, children);
		return { CodeBlock: Object.assign(Slot, { Header: Slot, Code: ({ code, ...props }: any) => React.createElement("pre", props, code), CopyButton: ({ code, "aria-label": label }: any) => React.createElement("button", { "aria-label": label, "data-code": code }) }) };
	},
	{ virtual: true },
);
import { act, render, screen } from "@testing-library/react";
import { CallbackHandoff } from "@/app/auth/mcp/consent/CallbackHandoff";

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
	jest.clearAllTimers();
	jest.useRealTimers();
	jest.restoreAllMocks();
});
test.each(["not-a-url", "javascript:alert(1)", "http://remote.example/callback"])("invalid callback %s cannot start navigation", (callbackUrl) => {
	render(<CallbackHandoff clientName='Custom AI' callbackUrl={callbackUrl} authorized={true} />);
	expect(screen.getByRole("alert")).toHaveTextContent("Restart the connection");
	expect(jest.getTimerCount()).toBe(0);
});
test.each(["https://client.example/callback?code=fixture&state=fixture", "http://127.0.0.1:4242/callback", "http://localhost:4242/callback", "http://[::1]:4242/callback"])("safe callback %s exposes recoverable commands without starting timers", (callbackUrl) => {
	const { unmount, container } = render(<CallbackHandoff clientName='Custom AI' callbackUrl={callbackUrl} authorized={false} />);
	expect(screen.getByRole("heading", { name: "Authorization declined" })).toBeVisible();
	expect(screen.getByRole("button", { name: "Copy callback URL" })).toHaveAttribute("data-code", callbackUrl);
	expect(screen.getByRole("button", { name: "Copy curl command" }).getAttribute("data-code")).toContain(callbackUrl);
	expect(screen.getByRole("button", { name: "Copy wget command" }).getAttribute("data-code")).toContain(callbackUrl);
	expect(container.querySelectorAll("pre[data-sentry-mask]")).toHaveLength(3);
	unmount();
	expect(jest.getTimerCount()).toBe(0);
});
test("successful handoff stays on the page and offers a same-tab continuation", () => {
	window.history.replaceState(null, "", "/");
	const callbackUrl = "http://127.0.0.1:4242/callback?code=fixture&state=fixture";
	render(<CallbackHandoff clientName='Custom AI' callbackUrl={callbackUrl} authorized={true} />);
	expect(screen.getByRole("heading", { name: "Authorization successful" })).toBeVisible();
	act(() => jest.advanceTimersByTime(10000));
	expect(window.location.pathname).toBe("/");
	expect(jest.getTimerCount()).toBe(0);
	const link = screen.getByRole("link", { name: "Continue to Custom AI" });
	expect(link).toHaveAttribute("href", callbackUrl);
	expect(link).not.toHaveAttribute("target");
	expect(screen.getByText("Connecting from another device or remote environment?")).toBeVisible();
});
