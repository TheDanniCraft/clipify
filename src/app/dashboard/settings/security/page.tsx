"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Chip, Input, Label, TextField } from "@heroui/react";
import { IconAt, IconDeviceLaptop, IconKey, IconMailCheck, IconPlus, IconShieldLock, IconTrash } from "@tabler/icons-react";
import { validateAuth } from "@actions/auth";
import DashboardNavbar from "@components/dashboardNavbar";
import FullscreenLoadingState from "@components/fullscreenLoadingState";
import SettingsNavigation from "@components/settingsNavigation";
import type { AuthenticatedUser } from "@types";
import { authClient } from "@/auth/client";

type PasskeyRow = { id: string; name: string | null; createdAt: Date | string | null };
type Feedback = { status: "success" | "danger"; message: string } | null;

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
	const [feedback, setFeedback] = useState<Feedback>(null);
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
			.catch(() => active && setFeedback({ status: "danger", message: "Your passkeys could not be loaded." }))
			.finally(() => active && setIsLoadingPasskeys(false));
		return () => {
			active = false;
		};
	}, []);

	async function sendEmailCode() {
		const email = session.data?.user.email;
		if (!email) return;
		setPendingAction("email-code");
		setFeedback(null);
		const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
		setFeedback(result.error ? { status: "danger", message: "The verification code could not be sent." } : { status: "success", message: "A verification code was sent to your account email." });
		setPendingAction(null);
	}

	async function requestEmailChange() {
		if (!newEmail.trim()) return;
		setPendingAction("change-email");
		setFeedback(null);
		const result = await authClient.emailOtp.requestEmailChange({ newEmail: newEmail.trim() });
		setFeedback(result.error ? { status: "danger", message: "The address change could not be started." } : { status: "success", message: "Check the new address for its verification code." });
		if (!result.error) setNewEmail("");
		setPendingAction(null);
	}

	async function addPasskey() {
		setPendingAction("add-passkey");
		setFeedback(null);
		const result = await authClient.passkey.addPasskey({ name: "Clipify passkey" });
		setFeedback(result.error ? { status: "danger", message: "Passkey setup was cancelled or unavailable. Email code sign-in remains available." } : { status: "success", message: "Passkey added." });
		if (!result.error) await refreshPasskeys();
		setPendingAction(null);
	}

	async function removePasskey(id: string) {
		setPendingAction(`remove-${id}`);
		setFeedback(null);
		const result = await authClient.passkey.deletePasskey({ id });
		setFeedback(result.error ? { status: "danger", message: "The passkey could not be removed." } : { status: "success", message: "Passkey removed. Email code sign-in remains available." });
		if (!result.error) await refreshPasskeys();
		setPendingAction(null);
	}

	if (!user || session.isPending) return <FullscreenLoadingState message='Loading sign-in security' />;

	return (
		<DashboardNavbar user={user} title='Sign-in security' tagline='Control how you verify and recover your identity'>
			<div className='mt-6 flex flex-col gap-6 pb-10'>
				<SettingsNavigation active='security' />
				{feedback ? (
					<Alert status={feedback.status}>
						<Alert.Content>
							<Alert.Description>{feedback.message}</Alert.Description>
						</Alert.Content>
					</Alert>
				) : null}

				<Card variant='secondary'>
					<Card.Header className='gap-3'>
						<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
							<IconShieldLock aria-hidden='true' size={21} />
						</div>
						<div>
							<Card.Title>Passwordless by design</Card.Title>
							<Card.Description>Clipify does not store a password for this account. Email codes are your dependable recovery method; passkeys are an optional faster sign-in method, not a second factor.</Card.Description>
						</div>
					</Card.Header>
				</Card>

				<div className='grid gap-6 lg:grid-cols-2'>
					<Card>
						<Card.Header className='gap-3'>
							<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
								<IconMailCheck aria-hidden='true' size={20} />
							</div>
							<div>
								<Card.Title>Email verification</Card.Title>
								<Card.Description>Receive a short-lived code at your verified account address.</Card.Description>
							</div>
						</Card.Header>
						<Card.Content className='flex flex-col gap-4'>
							<div className='rounded-2xl bg-surface-secondary p-4'>
								<p className='text-xs font-medium uppercase tracking-wide text-muted'>Current account email</p>
								<div className='mt-2 flex items-center gap-2 font-medium'>
									<IconAt aria-hidden='true' size={18} />
									<span className='truncate'>{session.data?.user.email ?? "Unavailable"}</span>
									<Chip className='ml-auto' color='success' size='sm' variant='soft'>
										Verified
									</Chip>
								</div>
							</div>
							<Button variant='secondary' isPending={pendingAction === "email-code"} isDisabled={pendingAction !== null || !session.data?.user.email} onPress={() => void sendEmailCode()}>
								Send verification code
							</Button>
						</Card.Content>
					</Card>

					<Card>
						<Card.Header className='gap-3'>
							<div className='flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent'>
								<IconAt aria-hidden='true' size={20} />
							</div>
							<div>
								<Card.Title>Change account email</Card.Title>
								<Card.Description>The new address must be verified before it replaces the current one.</Card.Description>
							</div>
						</Card.Header>
						<Card.Content className='flex flex-col gap-4'>
							<TextField type='email' value={newEmail} onChange={setNewEmail} isRequired>
								<Label>New email address</Label>
								<Input placeholder='new@example.com' variant='secondary' />
							</TextField>
							<Button variant='primary' isPending={pendingAction === "change-email"} isDisabled={pendingAction !== null || !newEmail.trim()} onPress={() => void requestEmailChange()}>
								Verify new address
							</Button>
						</Card.Content>
					</Card>
				</div>

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
							<div className='col-span-full rounded-2xl bg-surface-secondary p-6 text-center text-sm text-muted'>{isLoadingPasskeys ? "Loading passkeys…" : "No passkeys registered yet."}</div>
						) : (
							passkeys.map((passkey) => (
								<div key={passkey.id} className='flex items-center gap-3 rounded-2xl bg-surface-secondary p-4'>
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
