"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconCheck, IconMail, IconUsersGroup } from "@tabler/icons-react";
import { Button, Card, InputOTP, Label, REGEXP_ONLY_DIGITS } from "@heroui/react";
import { authClient } from "@/auth/client";
import { notify as addToast } from "@lib/toast";

type InvitationPreview = { id: string; email: string; organizationId: string; organizationName: string; isAgency: boolean };

function maskedEmail(email: string) {
	const [local, domain] = email.split("@");
	return `${local.slice(0, 2)}${"•".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export default function InvitationAcceptance({ invitation }: { invitation: InvitationPreview | null }) {
	const router = useRouter();
	const session = authClient.useSession();
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [pending, setPending] = useState<"send" | "verify" | "accept" | null>(null);

	if (!invitation) {
		return (
			<main className='flex min-h-screen items-center justify-center bg-background px-4'>
				<Card className='w-full max-w-md' variant='secondary'>
					<Card.Header>
						<Card.Title>Invitation unavailable</Card.Title>
						<Card.Description>This invitation is invalid, expired, revoked, or has already been used.</Card.Description>
					</Card.Header>
					<Card.Footer>
						<Button variant='secondary' onPress={() => router.push("/login")}>
							Go to sign in
						</Button>
					</Card.Footer>
				</Card>
			</main>
		);
	}
	const activeInvitation = invitation;

	const signedInEmail = session.data?.user.email?.toLowerCase();
	const emailMatches = signedInEmail === activeInvitation.email.toLowerCase();

	async function sendCode() {
		setPending("send");
		const result = await authClient.emailOtp.sendVerificationOtp({ email: activeInvitation.email, type: "sign-in" });
		setPending(null);
		if (result.error) return addToast({ title: "Code could not be sent", description: result.error.message, color: "danger" });
		setCodeSent(true);
		addToast({ title: "Verification code sent", description: `Check ${maskedEmail(activeInvitation.email)}.`, color: "success" });
	}

	async function verifyCode() {
		setPending("verify");
		const result = await authClient.signIn.emailOtp({ email: activeInvitation.email, otp: code.trim(), name: activeInvitation.email.split("@")[0] });
		setPending(null);
		if (result.error) return addToast({ title: "Code was not accepted", description: result.error.message, color: "danger" });
		await session.refetch();
	}

	async function accept() {
		setPending("accept");
		const accepted = await authClient.organization.acceptInvitation({ invitationId: activeInvitation.id });
		if (accepted.error) {
			setPending(null);
			return addToast({ title: "Invitation could not be accepted", description: accepted.error.message, color: "danger" });
		}
		const activation = await fetch("/api/agencies/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: activeInvitation.organizationId }) });
		if (!activation.ok) {
			addToast({ title: "Invitation accepted", description: "Your account will finish activating when the dashboard opens.", color: "warning" });
		} else {
			addToast({ title: "Invitation accepted", description: `You now have access to ${activeInvitation.organizationName}.`, color: "success" });
		}
		router.replace(activeInvitation.isAgency ? "/dashboard/agency" : "/dashboard");
		router.refresh();
	}

	async function handleUseAnotherAccount() {
		await authClient.signOut();
		await session.refetch();
	}

	return (
		<main className='flex min-h-screen items-center justify-center bg-background px-4 py-10'>
			<Card className='w-full max-w-md border border-border bg-card' variant='secondary'>
				<Card.Header className='gap-4 p-6 pb-3'>
					<div className='flex size-11 items-center justify-center rounded-xl bg-accent/10 text-accent'>
						<IconUsersGroup aria-hidden='true' size={22} />
					</div>
					<div>
						<Card.Title>Join {activeInvitation.organizationName}</Card.Title>
						<Card.Description>This invitation is bound to {maskedEmail(activeInvitation.email)}.</Card.Description>
					</div>
				</Card.Header>
				<Card.Content className='space-y-5 px-6'>
					{session.isPending ? <p className='text-sm text-muted'>Checking your sign-in…</p> : null}
					{!session.data ? (
						<>
							<div className='rounded-xl border border-divider bg-surface-secondary p-4'>
								<p className='text-sm font-medium'>Verify the invited account</p>
								<p className='mt-1 text-sm text-muted'>If you opened the emailed invitation, verification happens automatically. For a copied link, request a one-time code.</p>
							</div>
							{codeSent ? (
								<div className='flex flex-col gap-2'>
									<Label>Verification code</Label>
									<InputOTP maxLength={6} variant='secondary' value={code} onChange={setCode} pattern={REGEXP_ONLY_DIGITS} inputMode='numeric' autoComplete='one-time-code' autoFocus isDisabled={pending === "verify"}>
										<InputOTP.Group>
											{Array.from({ length: 6 }, (_, index) => (
												<InputOTP.Slot key={index} index={index} />
											))}
										</InputOTP.Group>
									</InputOTP>
									<p className='text-xs text-muted'>Enter the six-digit code sent to {maskedEmail(activeInvitation.email)}.</p>
								</div>
							) : null}
						</>
					) : !emailMatches ? (
						<p className='text-sm text-danger'>
							You are signed in as {session.data.user.email}. This invitation belongs to {maskedEmail(activeInvitation.email)}.
						</p>
					) : (
						<div className='flex items-start gap-3 rounded-xl border border-success/30 bg-success/10 p-4 text-sm'>
							<IconCheck aria-hidden='true' className='mt-0.5 shrink-0 text-success' size={18} />
							<div>
								<p className='font-medium'>Invitation verified</p>
								<p className='mt-1 text-muted'>
									Continue to join {activeInvitation.organizationName} as {session.data.user.email}.
								</p>
							</div>
						</div>
					)}
				</Card.Content>
				<Card.Footer className='flex-col-reverse gap-2 p-6 pt-5 sm:flex-row sm:justify-end'>
					{!session.data && !codeSent ? (
						<Button variant='primary' isPending={pending === "send"} onPress={() => void sendCode()}>
							<IconMail aria-hidden='true' size={18} />
							Send sign-in code
						</Button>
					) : null}
					{!session.data && codeSent ? (
						<>
							<Button variant='secondary' isPending={pending === "send"} onPress={() => void sendCode()}>
								Send again
							</Button>
							<Button variant='primary' isDisabled={code.trim().length !== 6} isPending={pending === "verify"} onPress={() => void verifyCode()}>
								Verify email
							</Button>
						</>
					) : null}
					{session.data && !emailMatches ? (
						<Button variant='secondary' onPress={() => void handleUseAnotherAccount()}>
							Use invited account
						</Button>
					) : null}
					{session.data && emailMatches ? (
						<Button variant='primary' isPending={pending === "accept"} onPress={() => void accept()}>
							Accept invitation
						</Button>
					) : null}
				</Card.Footer>
			</Card>
		</main>
	);
}
