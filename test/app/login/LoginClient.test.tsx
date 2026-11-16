import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { authClient } from "@/auth/client";
import LoginClient from "@/app/login/LoginClient";

const plausible = jest.fn();
jest.mock("@lib/analytics", () => ({ trackEvent: (...args: unknown[]) => plausible(...args), trackProductEvent: jest.fn() }));

jest.mock("@/auth/client", () => ({
	authClient: { signIn: { social: jest.fn() } },
}));

jest.mock("@components/heroui-client", () => ({
	Button: ({ children, variant, onPress, isDisabled, isPending: _isPending, size: _size, fullWidth: _fullWidth, ...props }: React.ComponentProps<"button"> & { variant?: string; onPress?: () => void; isDisabled?: boolean; isPending?: boolean; size?: string; fullWidth?: boolean }) => (
		<button {...props} data-variant={variant} disabled={isDisabled} onClick={onPress}>
			{children}
		</button>
	),
}));

describe("app/login/LoginClient", () => {
	it("makes Twitch connection the primary action", () => {
		render(<LoginClient returnUrl='/dashboard' />);

		expect(screen.getByRole("button", { name: "Login with Twitch" })).toHaveAttribute("data-variant", "primary");
	});
});

describe("Twitch authorization return links", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(authClient.signIn.social as jest.Mock).mockResolvedValue({ error: null });
	});
	it("retains every signed MCP parameter across Twitch failure and retry", async () => {
		const returnUrl = "/auth/mcp/consent?client_id=client&state=abc&sig=signed&scope=creator%3Aread+overlay%3Awrite&ba_param=one&ba_param=two";
		const firstAttempt = render(<LoginClient returnUrl={returnUrl} />);
		fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
		await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalled());
		const options = (authClient.signIn.social as jest.Mock).mock.calls[0][0];
		expect(options.callbackURL).toBe(returnUrl);
		const errorUrl = new URL(options.errorCallbackURL, "https://clipify.example");
		expect(errorUrl.pathname).toBe("/login");
		expect(errorUrl.searchParams.get("returnUrl")).toBe(returnUrl);
		// Better Auth adds its failure reason to this URL; it must not replace the nested request.
		errorUrl.searchParams.set("error", "access_denied");
		const retryDestination = errorUrl.searchParams.get("returnUrl")!;
		expect(retryDestination).toBe(returnUrl);
		firstAttempt.unmount();
		render(<LoginClient returnUrl={retryDestination} />);
		fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
		await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalledTimes(2));
		expect((authClient.signIn.social as jest.Mock).mock.calls[1][0]).toEqual(options);
	});
	it("retains the ordinary login defaults without a return destination", async () => {
		render(<LoginClient returnUrl='' />);
		fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
		await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalledWith(expect.objectContaining({ callbackURL: "/dashboard", errorCallbackURL: "/login" })));
	});
});

describe("native MCP sign-in", () => {
	it("keeps the signed retry query in this tab instead of duplicating it in Twitch state", async () => {
		jest.clearAllMocks();
		(authClient.signIn.social as jest.Mock).mockResolvedValue({ error: null });
		const query = "client_id=client&state=relay&sig=signed&ba_param=client_id&ba_param=state&ba_param=ba_param";
		window.history.replaceState({}, "", `/login?${query}`);
		try {
			render(<LoginClient returnUrl='' oauthAuthorization />);
			fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
			await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalled());
			const options = (authClient.signIn.social as jest.Mock).mock.calls[0][0];
			expect(options.callbackURL).toBe("/dashboard");
			expect(options.errorCallbackURL).toMatch(/^\/login\?oauthRetry=[0-9a-f-]{36}$/);
			expect(options.errorCallbackURL).not.toContain("sig=");
			expect(options.errorCallbackURL.length).toBeLessThan(80);
		} finally {
			window.history.replaceState({}, "", "/");
		}
	});
});

it("records deliberate authentication intent without signed return URLs or identifiers", async () => {
	jest.clearAllMocks();
	(authClient.signIn.social as jest.Mock).mockResolvedValue({ error: null });
	render(<LoginClient returnUrl='/checkout/continue' />);
	expect(plausible).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
	await waitFor(() => expect(plausible).toHaveBeenCalledWith("auth_started", { provider: "twitch", source: "checkout" }));
	expect(plausible).toHaveBeenCalledTimes(1);
});

it.each(["returned", "thrown"])("allows retry after a %s authentication-start error", async (mode) => {
	jest.clearAllMocks();
	const social = authClient.signIn.social as jest.Mock;
	if (mode === "thrown") social.mockRejectedValueOnce(new Error("network"));
	else social.mockResolvedValueOnce({ error: { message: "denied" } });
	social.mockResolvedValueOnce({ error: null });
	render(<LoginClient returnUrl='' />);
	fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
	await screen.findByRole("alert");
	expect(screen.getByRole("button", { name: "Login with Twitch" })).toBeEnabled();
	fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
	await waitFor(() => expect(social).toHaveBeenCalledTimes(2));
	expect(plausible).toHaveBeenCalledTimes(3);
	expect(plausible).toHaveBeenCalledWith("auth_failed", { provider: "twitch", reason: mode === "thrown" ? "network" : "start_rejected" });
});

it("restores the signed authorization query before a cancelled Twitch login is retried", async () => {
	jest.clearAllMocks();
	(authClient.signIn.social as jest.Mock).mockResolvedValue({ error: null });
	const { saveOAuthLoginRetry } = await import("@/auth/oauth-login-retry");
	const query = "client_id=client&sig=signed&ba_param=client_id&ba_param=ba_param";
	const retry = saveOAuthLoginRetry(sessionStorage, `/login?${query}`);
	window.history.replaceState({}, "", retry + "&error=access_denied");
	try {
		render(<LoginClient returnUrl='' oauthAuthorization />);
		fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
		await waitFor(() => expect(authClient.signIn.social).toHaveBeenCalled());
		expect(window.location.search).toContain("sig=signed");
		expect(window.location.search).toContain("error=access_denied");
		expect(window.location.search).not.toContain("oauthRetry");
		expect((authClient.signIn.social as jest.Mock).mock.calls[0][0].errorCallbackURL.length).toBeLessThan(80);
	} finally {
		window.history.replaceState({}, "", "/");
	}
});

it("keeps a missing tab continuation from silently authorizing a different destination", async () => {
	window.history.replaceState({}, "", "/login?oauthRetry=12345678-1234-1234-1234-123456789012");
	sessionStorage.clear();
	try {
		render(<LoginClient returnUrl='' oauthAuthorization />);
		fireEvent.click(screen.getByRole("button", { name: "Login with Twitch" }));
		expect(await screen.findByRole("alert")).toHaveTextContent("Return to the app");
		expect(screen.getByRole("button", { name: "Login with Twitch" })).toBeDisabled();
	} finally {
		window.history.replaceState({}, "", "/");
	}
});
