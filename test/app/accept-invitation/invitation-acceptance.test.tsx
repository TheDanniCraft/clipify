import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import InvitationAcceptance from "@/app/accept-invitation/invitation-acceptance";

const routerReplace = jest.fn();
const routerRefresh = jest.fn();
const sendVerificationOtp = jest.fn();
const acceptInvitation = jest.fn();
const refetchSession = jest.fn();
const addToast = jest.fn();
let sessionData: { user: { email: string } } | null = null;

jest.mock("next/navigation", () => ({
	useRouter: () => ({ push: jest.fn(), replace: routerReplace, refresh: routerRefresh }),
}));

jest.mock("@/auth/client", () => ({
	authClient: {
		useSession: () => ({ data: sessionData, isPending: false, refetch: refetchSession }),
		emailOtp: { sendVerificationOtp: (...args: unknown[]) => sendVerificationOtp(...args) },
		signIn: { emailOtp: jest.fn() },
		signOut: jest.fn(),
		organization: { acceptInvitation: (...args: unknown[]) => acceptInvitation(...args) },
	},
}));

jest.mock("@lib/toast", () => ({ notify: (...args: unknown[]) => addToast(...args) }));

jest.mock("@heroui/react", () => {
	const React = jest.requireActual<typeof import("react")>("react");
	const Wrapper = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
	const InputOTP = Object.assign(({ value, onChange, isDisabled }: { value: string; onChange: (value: string) => void; isDisabled?: boolean }) => <input aria-label='Verification code' value={value} disabled={isDisabled} onChange={(event) => onChange(event.target.value)} />, { Group: Wrapper, Slot: () => null });
	return {
		Button: ({ children, onPress, isDisabled }: { children: React.ReactNode; onPress?: () => void; isDisabled?: boolean }) => (
			<button onClick={onPress} disabled={isDisabled}>
				{children}
			</button>
		),
		Card: Object.assign(Wrapper, { Header: Wrapper, Title: Wrapper, Description: Wrapper, Content: Wrapper, Footer: Wrapper }),
		InputOTP,
		Label: Wrapper,
		REGEXP_ONLY_DIGITS: "^\\d+$",
	};
});

const invitation = {
	id: "invitation-1",
	email: "member@example.test",
	organizationId: "organization-1",
	organizationName: "Creator Team",
	isAgency: false,
};

describe("InvitationAcceptance", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		sessionData = null;
		sendVerificationOtp.mockResolvedValue({ error: null });
		acceptInvitation.mockResolvedValue({ error: null });
		global.fetch = jest.fn().mockResolvedValue({ ok: true });
	});

	it("keeps a segmented OTP fallback for manually copied invitation links", async () => {
		render(<InvitationAcceptance invitation={invitation} />);

		expect(screen.getByText(/If you opened the emailed invitation, verification happens automatically/i)).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Send sign-in code/i }));

		await waitFor(() => expect(sendVerificationOtp).toHaveBeenCalledWith({ email: invitation.email, type: "sign-in" }));
		expect(screen.getByText(/Enter the six-digit code sent to/i)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Verify email/i })).toBeDisabled();
	});

	it("shows the verified invitation state after the emailed link signs the recipient in", async () => {
		sessionData = { user: { email: invitation.email } };
		render(<InvitationAcceptance invitation={invitation} />);

		expect(screen.getByText("Invitation verified")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Send sign-in code/i })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: /Accept invitation/i }));

		await waitFor(() => expect(acceptInvitation).toHaveBeenCalledWith({ invitationId: invitation.id }));
		expect(routerReplace).toHaveBeenCalledWith("/dashboard");
		expect(routerRefresh).toHaveBeenCalled();
	});
});
