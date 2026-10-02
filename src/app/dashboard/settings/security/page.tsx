"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Chip, Input, Label, TextField } from "@heroui/react";
import { IconAt, IconDeviceLaptop, IconKey, IconMailCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import type { AuthenticatedUser } from "@types";
import { notify as addToast } from "@lib/toast";
import { authClient } from "@/auth/client";
import { requestCurrentEmailChangeCode, requestNewEmailChangeCode } from "@/app/actions/account-security";

type PasskeyRow = { id: string; name: string | null; createdAt: Date | string | null };
type EmailChangeStep = "idle" | "verify-current" | "verify-new";

function formatDate(value: Date | string | null) {
	if (!value) return "Date unavailable";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function SecuritySettingsPage() {
	const router = useRouter();
	const session = authClient.useSession();
	const [user, setUser] = useState<AuthenticatedUser | null>(null);
	const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
	const [newEmail, setNewEmail] = useState("");
	const [currentEmailCode, setCurrentEmailCode] = useState("");
	const [newEmailCode, setNewEmailCode] = useState("");
	const [emailChangeStep, setEmailChangeStep] = useState<EmailChangeStep>("idle");
	const [pendingAction, setPendingAction] = useState<string | null>(null);
	const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(true);

	useEffect(() => {
		let active = true;
		void validateAuth().then((authenticatedUser) => {
			if (!active) return;
			if (!authenticatedUser) return router.push("/logout");
			setUser(authenticatedUser);
		});
		return () => {
			active = false;
		};
	}, [router]);

	async function refreshPasskeys() {
		const result = await authClient.passkey.listUserPasskeys();
		if (result.error) throw new Error("PASSKEYS_NOT_LOADED");
		setPasskeys((result.data ?? []) as PasskeyRow[]);
	}

	useEffect(() => {
		let active = true;
		void authClient.passkey
			.listUserPasskeys()
			.then((result) => {
				if (!active) return;
				if (result.error) throw new Error("PASSKEYS_NOT_LOADED");
				setPasskeys((result.data ?? []) as PasskeyRow[]);
			})
			.catch(() => active && addToast({ title: "Passkeys could not be loaded", color: "danger" }))
			.finally(() => active && setIsLoadingPasskeys(false));
		return () => {
			active = false;
		};
	}, []);

	async function startEmailChange() {
		const currentEmail = session.data?.user.email;
		if (!currentEmail || !newEmail.trim()) return;
		setPendingAction("request-current-code");
		try {
			await requestCurrentEmailChangeCode();
			setEmailChangeStep("verify-current");
			addToast({ title: "Check your current email", description: "Enter the verification code to authorize this email change.", color: "success" });
		} catch {
			addToast({ title: "Verification code could not be sent", description: "Check the transactional-email configuration and try again.", color: "danger" });
		} finally {
			setPendingAction(null);
		}
	}

	async function verifyCurrentEmail() {
		if (!newEmail.trim() || !currentEmailCode.trim()) return;
		setPendingAction("verify-current-code");
		try {
			await requestNewEmailChangeCode(newEmail, currentEmailCode);
			setEmailChangeStep("verify-new");
			addToast({ title: "Check your new email", description: "Enter the verification code sent to the new address.", color: "success" });
		} catch {
			addToast({ title: "Email change could not continue", description: "Check the current-email code or transactional-email configuration, then try again.", color: "danger" });
		} finally {
			setPendingAction(null);
		}
	}

	async function confirmNewEmail() {
		if (!newEmail.trim() || !newEmailCode.trim()) return;
		setPendingAction("confirm-new-email");
		const result = await authClient.emailOtp.changeEmail({ newEmail: newEmail.trim(), otp: newEmailCode.trim() });
		setPendingAction(null);
		if (result.error) {
			addToast({ title: "Email could not be changed", description: result.error.message, color: "danger" });
			return;
		}
		setNewEmail("");
		setCurrentEmailCode("");
		setNewEmailCode("");
		setEmailChangeStep("idle");
		await session.refetch();
		addToast({ title: "Account email changed", color: "success" });
	}

	async function addPasskey() {
		setPendingAction("add-passkey");
		const result = await authClient.passkey.addPasskey({ name: "Clipify passkey" });
		setPendingAction(null);
		if (result.error) {
			addToast({ title: "Passkey setup was cancelled", description: "Email code sign-in remains available.", color: "warning" });
			return;
		}
		await refreshPasskeys();
		addToast({ title: "Passkey added", color: "success" });
	}

	async function removePasskey(id: string) {
		setPendingAction(`remove-${id}`);
		const result = await authClient.passkey.deletePasskey({ id });
		setPendingAction(null);
		if (result.error) {
			addToast({ title: "Passkey could not be removed", color: "danger" });
			return;
		}
		await refreshPasskeys();
		addToast({ title: "Passkey removed", description: "Email code sign-in remains available.", color: "success" });
	}

	if (!user || session.isPending) return <FullscreenLoadingState message='Loading sign-in security' />;

	return (
		<DashboardNavbar user={user} title='Sign-in & security' tagline='Manage your account email and sign-in methods'>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconMailCheck aria-hidden='true' size={20} />
						</div>
						<div>
							<Card.Title>Account email</Card.Title>
							<Card.Description>Your email is used for passwordless sign-in, recovery, and security notifications.</Card.Description>
						</div>
					</Card.Header>
					<Card.Content className='flex flex-col gap-5'>
						<div className='flex flex-col gap-3 border-b border-default pb-5 sm:flex-row sm:items-center sm:justify-between'>
							<div className='min-w-0'>
								<p className='text-xs font-medium uppercase tracking-wide text-muted'>Current email</p>
								<div className='mt-1 flex items-center gap-2 font-medium'>
									<IconAt aria-hidden='true' size={18} />
									<span className='truncate'>{session.data?.user.email ?? "Unavailable"}</span>
								</div>
							</div>
							<Chip color={session.data?.user.emailVerified ? "success" : "warning"} size='sm' variant='soft'>
								{session.data?.user.emailVerified ? "Verified" : "Verification pending"}
							</Chip>
						</div>
						<div className='grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
							<TextField type='email' value={newEmail} onChange={setNewEmail} isRequired isDisabled={emailChangeStep !== "idle"}>
								<Label>New email address</Label>
								<Input placeholder='new@example.com' variant='secondary' />
							</TextField>
							<Button variant='primary' isPending={pendingAction === "request-current-code"} isDisabled={pendingAction !== null || !newEmail.trim() || emailChangeStep !== "idle"} onPress={() => void startEmailChange()}>
								Start email change
							</Button>
						</div>
						{emailChangeStep === "verify-current" ? (
							<div className='grid gap-4 border-t border-default pt-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
								<TextField value={currentEmailCode} onChange={setCurrentEmailCode} isRequired>
									<Label>Code from current email</Label>
									<Input inputMode='numeric' autoComplete='one-time-code' variant='secondary' />
								</TextField>
								<Button variant='primary' isPending={pendingAction === "verify-current-code"} isDisabled={pendingAction !== null || !currentEmailCode.trim()} onPress={() => void verifyCurrentEmail()}>
									Verify current email
								</Button>
							</div>
						) : null}
						{emailChangeStep === "verify-new" ? (
							<div className='grid gap-4 border-t border-default pt-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end'>
								<TextField value={newEmailCode} onChange={setNewEmailCode} isRequired>
									<Label>Code from new email</Label>
									<Input inputMode='numeric' autoComplete='one-time-code' variant='secondary' />
								</TextField>
								<Button variant='primary' isPending={pendingAction === "confirm-new-email"} isDisabled={pendingAction !== null || !newEmailCode.trim()} onPress={() => void confirmNewEmail()}>
									Confirm new email
								</Button>
							</div>
						) : null}
					</Card.Content>
				</Card>

				<Card>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconKey aria-hidden='true' size={20} />
						</div>
						<div>
							<Card.Title>Passkeys</Card.Title>
							<Card.Description>Use your device, password manager, fingerprint, or face unlock for a phishing-resistant sign-in.</Card.Description>
						</div>
						<Button className='ml-auto' variant='primary' isPending={pendingAction === "add-passkey"} isDisabled={pendingAction !== null} onPress={() => void addPasskey()}>
							<IconPlus aria-hidden='true' size={18} />
							Add passkey
						</Button>
					</Card.Header>
					<Card.Content className='grid gap-3 md:grid-cols-2'>
						{passkeys.length === 0 ? (
							<div className='col-span-full rounded-xl bg-surface-secondary p-6 text-center text-sm text-muted'>{isLoadingPasskeys ? "Loading passkeys…" : "No passkeys registered yet."}</div>
						) : (
							passkeys.map((passkey) => (
								<div key={passkey.id} className='flex items-center gap-3 rounded-xl bg-surface-secondary p-4'>
									<div className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface text-accent'>
										<IconDeviceLaptop aria-hidden='true' size={20} />
									</div>
									<div className='min-w-0 flex-1'>
										<p className='truncate font-medium'>{passkey.name || "Passkey"}</p>
										<p className='text-sm text-muted'>Added {formatDate(passkey.createdAt)}</p>
									</div>
									<Button isIconOnly aria-label={`Remove ${passkey.name || "passkey"}`} size='sm' variant='danger-soft' isPending={pendingAction === `remove-${passkey.id}`} isDisabled={pendingAction !== null} onPress={() => void removePasskey(passkey.id)}>
										<IconTrash aria-hidden='true' size={17} />
									</Button>
								</div>
							))
						)}
					</Card.Content>
				</Card>
			</div>
		</DashboardNavbar>
	);
}
