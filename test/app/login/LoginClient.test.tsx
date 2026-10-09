import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { authClient } from "@/auth/client";
import LoginClient from "@/app/login/LoginClient";

jest.mock("@/auth/client", () => ({
	authClient: { signIn: { social: jest.fn() } },
}));

jest.mock("@components/heroui-client", () => ({
	Button: ({ children, variant, onPress, isDisabled, isPending: _isPending, size: _size, ...props }: React.ComponentProps<"button"> & { variant?: string; onPress?: () => void; isDisabled?: boolean; isPending?: boolean; size?: string }) => (
		<button {...props} data-variant={variant} disabled={isDisabled} onClick={onPress}>
			{children}
		</button>
	),
}));

describe("app/login/LoginClient", () => {
	it("keeps the Twitch login action on the dark tertiary treatment", () => {
		render(<LoginClient returnUrl='/dashboard' />);

		expect(screen.getByRole("button", { name: "Login with Twitch" })).toHaveAttribute("data-variant", "tertiary");
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
