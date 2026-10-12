import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EditorSignIn from "@/app/login/editor/EditorSignIn";
import EditorLogin from "@/app/login/editor/page";
import { authClient } from "@/auth/client";
import { getAuthSession } from "@/auth/session";

const mockRouter = { replace: jest.fn(), refresh: jest.fn() };
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("@/auth/session", () => ({ getAuthSession: jest.fn() }));
jest.mock("@/auth/client", () => ({
	authClient: {
		emailOtp: { sendVerificationOtp: jest.fn() },
		signIn: { emailOtp: jest.fn() },
		signOut: jest.fn(),
		organization: { list: jest.fn(), setActive: jest.fn() },
	},
}));
jest.mock("@heroui/react", () => {
	const Container = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
	const Option = ({ id, textValue }: { id: string; textValue: string }) => <option value={id}>{textValue}</option>;
	function options(children: React.ReactNode): React.ReactNode[] {
		return React.Children.toArray(children).flatMap((child) => {
			if (!React.isValidElement<{ children?: React.ReactNode }>(child)) return [];
			return child.type === Option ? [child] : options(child.props.children);
		});
	}
	return {
		Avatar: Object.assign(Container, { Image: () => null, Fallback: Container }),
		ListBox: Object.assign(Container, { Item: Option, ItemIndicator: () => null }),
		Select: Object.assign(
			({ children, value, onChange, isDisabled }: React.PropsWithChildren<{ value: string | null; onChange: (value: string) => void; isDisabled?: boolean }>) => (
				<select aria-label='Workspace' value={value ?? ""} disabled={isDisabled} onChange={(event) => onChange(event.target.value)}>
					<option value=''>Select a workspace</option>
					{options(children)}
				</select>
			),
			{ Trigger: Container, Value: () => null, Indicator: () => null, Popover: Container },
		),
		Card: Object.assign(Container, { Header: Container, Title: Container, Description: Container, Content: Container, Footer: Container }),
		Button: ({ children, onPress, isDisabled, type }: React.PropsWithChildren<{ onPress?: () => void; isDisabled?: boolean; type?: "button" | "submit" }>) => (
			<button type={type ?? "button"} disabled={isDisabled} onClick={onPress}>
				{children}
			</button>
		),
		TextField: Container,
		Label: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
		Input: (props: React.ComponentProps<"input">) => <input aria-label='Email address' {...props} />,
		InputOTP: Object.assign(({ value, onChange, isDisabled }: { value: string; onChange: (value: string) => void; isDisabled?: boolean }) => <input aria-label='Sign-in code' value={value} disabled={isDisabled} onChange={(event) => onChange(event.target.value)} />, { Group: Container, Slot: Container }),
		Link: ({ href, children }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a>,
		REGEXP_ONLY_DIGITS: "^\\d+$",
	};
});

beforeEach(() => {
	jest.clearAllMocks();
	(getAuthSession as jest.Mock).mockResolvedValue(null);
	(authClient.emailOtp.sendVerificationOtp as jest.Mock).mockResolvedValue({ error: null });
	(authClient.signIn.emailOtp as jest.Mock).mockResolvedValue({ error: null, data: {} });
	(authClient.organization.list as jest.Mock).mockResolvedValue({ data: [{ id: "creator-workspace", name: "Demo Creator" }], error: null });
	(authClient.organization.setActive as jest.Mock).mockResolvedValue({ error: null });
});

async function requestCode() {
	fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "editor@example.com" } });
	fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
	await screen.findByLabelText("Sign-in code");
}

async function enterCode() {
	await act(async () => {
		fireEvent.change(screen.getByLabelText("Sign-in code"), { target: { value: "123456" } });
		fireEvent.click(screen.getByRole("button", { name: /^Sign in$/ }));
	});
}

test("native OTP login activates an existing workspace and preserves the complete MCP return path", async () => {
	const returnUrl = "/auth/mcp/consent?state=relay&ba_param=one&ba_param=two&sig=signed";
	render(<EditorSignIn signedInEmail={null} returnUrl={returnUrl} />);
	await requestCode();
	expect(authClient.emailOtp.sendVerificationOtp).toHaveBeenCalledWith({ email: "editor@example.com", type: "sign-in" });
	await enterCode();
	await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith(returnUrl));
	expect(authClient.signIn.emailOtp).toHaveBeenCalledWith({ email: "editor@example.com", otp: "123456" });
	expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: "creator-workspace" });
});

test("a rejected code never activates a workspace", async () => {
	(authClient.signIn.emailOtp as jest.Mock).mockResolvedValue({ error: { message: "INVALID_OTP" } });
	render(<EditorSignIn signedInEmail={null} returnUrl='/dashboard' />);
	await requestCode();
	await enterCode();
	expect(await screen.findByRole("alert")).toHaveTextContent("could not be verified");
	expect(authClient.organization.list).not.toHaveBeenCalled();
	expect(mockRouter.replace).not.toHaveBeenCalled();
});

test("accounts without memberships stay on the page without acquiring creator access", async () => {
	(authClient.organization.list as jest.Mock).mockResolvedValue({ data: [], error: null });
	render(<EditorSignIn signedInEmail={null} returnUrl='/dashboard' />);
	await requestCode();
	await enterCode();
	expect(await screen.findByRole("alert")).toHaveTextContent("does not have workspace access");
	expect(authClient.organization.setActive).not.toHaveBeenCalled();
	expect(mockRouter.replace).not.toHaveBeenCalled();
});

test("multiple memberships require choosing a workspace rather than silently selecting one", async () => {
	(authClient.organization.list as jest.Mock).mockResolvedValue({
		data: [
			{ id: "one", name: "First Creator" },
			{ id: "two", name: "Second Creator" },
		],
		error: null,
	});
	render(<EditorSignIn signedInEmail='editor@example.com' returnUrl='/dashboard' />);
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	const picker = await screen.findByRole("combobox", { name: "Workspace" });
	expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
	expect(authClient.organization.setActive).not.toHaveBeenCalled();
	await waitFor(() => expect(picker).toBeEnabled());
	fireEvent.change(picker, { target: { value: "two" } });
	expect(authClient.organization.setActive).not.toHaveBeenCalled();
	fireEvent.click(screen.getByRole("button", { name: "Continue" }));
	await waitFor(() => expect(authClient.organization.setActive).toHaveBeenCalledWith({ organizationId: "two" }));
	await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/dashboard"));
});

test("failed membership activation does not navigate", async () => {
	(authClient.organization.setActive as jest.Mock).mockResolvedValue({ error: { message: "ACCESS_DENIED" } });
	render(<EditorSignIn signedInEmail={null} returnUrl='/dashboard' />);
	await requestCode();
	await enterCode();
	expect(await screen.findByRole("alert")).toHaveTextContent("could not open this workspace");
	expect(mockRouter.replace).not.toHaveBeenCalled();
});

test("agency editors open the agency dashboard after native membership activation", async () => {
	(authClient.organization.list as jest.Mock).mockResolvedValue({ data: [{ id: "agency-workspace", name: "Demo Agency", metadata: '{"accountType":"agency"}' }], error: null });
	render(<EditorSignIn signedInEmail={null} returnUrl='/dashboard' />);
	await requestCode();
	await enterCode();
	await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/dashboard/agency"));
});

test("a failed code delivery keeps the email form usable", async () => {
	(authClient.emailOtp.sendVerificationOtp as jest.Mock).mockRejectedValue(new Error("Network unavailable"));
	render(<EditorSignIn signedInEmail={null} returnUrl='/dashboard' />);
	fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "editor@example.com" } });
	fireEvent.click(screen.getByRole("button", { name: "Send sign-in code" }));
	expect(await screen.findByRole("alert")).toBeVisible();
	expect(screen.getByRole("button", { name: "Send sign-in code" })).toBeEnabled();
	expect(authClient.signIn.emailOtp).not.toHaveBeenCalled();
});

test("the native OAuth redirect is not replaced with dashboard navigation", async () => {
	(authClient.signIn.emailOtp as jest.Mock).mockResolvedValue({ data: { redirect: true, url: "/api/auth/oauth2/authorize" }, error: null });
	render(<EditorSignIn signedInEmail={null} returnUrl='/dashboard' />);
	await requestCode();
	await enterCode();
	await waitFor(() => expect(authClient.signIn.emailOtp).toHaveBeenCalled());
	expect(authClient.organization.list).not.toHaveBeenCalled();
	expect(mockRouter.replace).not.toHaveBeenCalled();
});

test.each(["//external.example", "/\\external.example", "https://external.example"])("page rejects external return path %s", async (returnUrl) => {
	const page = await EditorLogin({ searchParams: Promise.resolve({ returnUrl }) });
	expect(page.props.returnUrl).toBe("/dashboard");
});

test("signed OAuth reauthentication still presents email login even with an existing session", async () => {
	(getAuthSession as jest.Mock).mockResolvedValue({ user: { email: "existing@example.com" } });
	const page = await EditorLogin({ searchParams: Promise.resolve({ client_id: "client", sig: "signed" }) });
	expect(page.props.signedInEmail).toBeNull();
});
