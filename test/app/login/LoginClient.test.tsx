import React from "react";
import { render, screen } from "@testing-library/react";
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
