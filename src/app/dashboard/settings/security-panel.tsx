"use client";

import { useEffect, useState } from "react";
import { Button, Card, Chip, Input, Label, Modal, TextField, Tooltip } from "@heroui/react";
import { IconAt, IconDeviceLaptop, IconInfoCircle, IconKey, IconMailCheck, IconPlus, IconTrash } from "@tabler/icons-react";
import ControlledModal from "@components/controlledModal";
import { notify as addToast } from "@lib/toast";
import { authClient } from "@/auth/client";
import { requestCurrentEmailChangeCode, requestNewEmailChangeCode } from "@/app/actions/account-security";

type PasskeyRow = { id: string; name: string | null; createdAt: Date | string | null };
type EmailChangeStep = "idle" | "verify-current" | "verify-new";
const PENDING_EMAIL_STORAGE_KEY = "clipify:pending-email-change";

function formatDate(value: Date | string | null) {
	if (!value) return "Date unavailable";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export default function SecuritySettingsPanel() {
	const session = authClient.useSession();
	const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
	const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(true);
	const [emailModalOpen, setEmailModalOpen] = useState(false);
	const [passkeyModalOpen, setPasskeyModalOpen] = useState(false);
	const [newEmail, setNewEmail] = useState("");
	const [currentEmailCode, setCurrentEmailCode] = useState("");
	const [newEmailCode, setNewEmailCode] = useState("");
	const [emailChangeStep, setEmailChangeStep] = useState<EmailChangeStep>("idle");
	const [pendingAction, setPendingAction] = useState<string | null>(null);

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

	useEffect(() => {
		const currentEmail = session.data?.user.email;
		if (!currentEmail) return;
		let cancelled = false;
		try {
			const stored = JSON.parse(sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY) ?? "null") as { currentEmail?: string; newEmail?: string; expiresAt?: number } | null;
			if (!stored?.newEmail || stored.currentEmail !== currentEmail || !stored.expiresAt || stored.expiresAt <= Date.now()) {
				sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
				return;
			}
			queueMicrotask(() => {
				if (cancelled) return;
				setNewEmail(stored.newEmail!);
				setEmailChangeStep("verify-new");
			});
		} catch {
			sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
		}
		return () => {
			cancelled = true;
		};
	}, [session.data?.user.email]);

	async function startEmailChange() {
		if (!session.data?.user.email || !newEmail.trim()) return;
		setPendingAction("request-current-code");
		try {
			await requestCurrentEmailChangeCode();
			setEmailChangeStep("verify-current");
			addToast({ title: "Check your current email", description: "Enter the verification code to authorize this email change.", color: "success" });
		} catch {
			addToast({ title: "Verification code could not be sent", description: "Please try again in a moment.", color: "danger" });
		} finally {
			setPendingAction(null);
		}
	}

	async function verifyCurrentEmail() {
		if (!newEmail.trim() || !currentEmailCode.trim()) return;
		setPendingAction("verify-current-code");
		try {
			await requestNewEmailChangeCode(newEmail, currentEmailCode);
			sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, JSON.stringify({ currentEmail: session.data?.user.email, newEmail: newEmail.trim(), expiresAt: Date.now() + 10 * 60 * 1000 }));
			setEmailChangeStep("verify-new");
			addToast({ title: "New email pending", description: `We sent a verification code to ${newEmail.trim()}.`, color: "success" });
		} catch {
			addToast({ title: "Email change could not continue", description: "Check the code from your current email and try again.", color: "danger" });
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
		sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
		setCurrentEmailCode("");
		setNewEmailCode("");
		setEmailChangeStep("idle");
		setEmailModalOpen(false);
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

	const currentEmail = session.data?.user.email ?? "Unavailable";
	const emailChangePending = emailChangeStep === "verify-new";

	return (
		<>
			<Card variant='secondary' className='w-full' id='security'>
				<Card.Header>
					<div>
						<Card.Title>Sign-in &amp; security</Card.Title>
						<Card.Description>Manage the email and passkeys used to access your account.</Card.Description>
					</div>
				</Card.Header>
				<Card.Content className='divide-y divide-default p-0'>
					<div className='flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between'>
						<div className='min-w-0'>
							<p className='text-sm font-semibold'>Your email</p>
							<div className='mt-1 flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted'>
								<span className='truncate'>{currentEmail}</span>
								{emailChangePending ? (
									<>
										<Chip color='warning' size='sm' variant='soft'>
											Pending: {newEmail.trim()}
										</Chip>
										<Tooltip>
											<Button isIconOnly size='sm' variant='ghost' aria-label='About the pending email change'>
												<IconInfoCircle aria-hidden='true' size={16} />
											</Button>
											<Tooltip.Content className='max-w-72'>Your current email, {currentEmail}, remains active until you confirm the new address.</Tooltip.Content>
										</Tooltip>
									</>
								) : (
									<Chip color={session.data?.user.emailVerified ? "success" : "warning"} size='sm' variant='soft'>
										{session.data?.user.emailVerified ? "Verified" : "Verification pending"}
									</Chip>
								)}
							</div>
						</div>
						<Button variant='secondary' onPress={() => setEmailModalOpen(true)}>
							Change email
						</Button>
					</div>
					<div className='flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between'>
						<div>
							<p className='text-sm font-semibold'>Passkeys</p>
							<p className='text-sm text-muted'>{isLoadingPasskeys ? "Loading passkeys…" : passkeys.length === 0 ? "No passkeys registered" : `${passkeys.length} ${passkeys.length === 1 ? "passkey" : "passkeys"} registered`}</p>
						</div>
						<Button variant='secondary' onPress={() => setPasskeyModalOpen(true)}>
							Manage passkeys
						</Button>
					</div>
				</Card.Content>
			</Card>

			<ControlledModal variant='blur' isOpen={emailModalOpen} onClose={() => setEmailModalOpen(false)}>
				<Modal.Header>
					<Modal.Icon className='bg-accent-soft text-accent-soft-foreground'>
						<IconMailCheck aria-hidden='true' />
					</Modal.Icon>
					<Modal.Heading>Change your email</Modal.Heading>
				</Modal.Header>
				<Modal.Body className='space-y-5'>
					<div className='rounded-xl bg-surface-secondary p-4'>
						<p className='text-xs font-medium uppercase tracking-wide text-muted'>Current email</p>
						<div className='mt-1 flex items-center gap-2 font-medium'>
							<IconAt aria-hidden='true' size={18} />
							<span className='truncate'>{currentEmail}</span>
						</div>
					</div>
					{emailChangeStep === "idle" ? (
						<TextField type='email' value={newEmail} onChange={setNewEmail} isRequired variant='secondary'>
							<Label>New email address</Label>
							<Input placeholder='new@example.com' />
						</TextField>
					) : null}
					{emailChangeStep === "verify-current" ? (
						<TextField value={currentEmailCode} onChange={setCurrentEmailCode} isRequired variant='secondary'>
							<Label>Code from your current email</Label>
							<Input inputMode='numeric' autoComplete='one-time-code' />
						</TextField>
					) : null}
					{emailChangePending ? (
						<div className='space-y-4'>
							<div className='rounded-xl bg-surface-secondary p-4'>
								<div className='flex items-center gap-2'>
									<p className='font-medium'>{newEmail.trim()}</p>
									<Chip color='warning' size='sm' variant='soft'>
										Pending
									</Chip>
									<Tooltip>
										<Button isIconOnly size='sm' variant='ghost' aria-label='About pending email verification'>
											<IconInfoCircle aria-hidden='true' size={16} />
										</Button>
										<Tooltip.Content className='max-w-72'>Your current email, {currentEmail}, remains active until you confirm this address.</Tooltip.Content>
									</Tooltip>
								</div>
								<p className='mt-1 text-sm text-muted'>Enter the code we sent to the new address.</p>
							</div>
							<TextField value={newEmailCode} onChange={setNewEmailCode} isRequired variant='secondary'>
								<Label>Code from your new email</Label>
								<Input inputMode='numeric' autoComplete='one-time-code' />
							</TextField>
						</div>
					) : null}
				</Modal.Body>
				<Modal.Footer>
					<Button variant='tertiary' onPress={() => setEmailModalOpen(false)} isDisabled={pendingAction !== null}>
						Close
					</Button>
					{emailChangeStep === "idle" ? (
						<Button variant='primary' isPending={pendingAction === "request-current-code"} isDisabled={pendingAction !== null || !newEmail.trim()} onPress={() => void startEmailChange()}>
							Continue
						</Button>
					) : emailChangeStep === "verify-current" ? (
						<Button variant='primary' isPending={pendingAction === "verify-current-code"} isDisabled={pendingAction !== null || !currentEmailCode.trim()} onPress={() => void verifyCurrentEmail()}>
							Verify current email
						</Button>
					) : (
						<Button variant='primary' isPending={pendingAction === "confirm-new-email"} isDisabled={pendingAction !== null || !newEmailCode.trim()} onPress={() => void confirmNewEmail()}>
							Confirm new email
						</Button>
					)}
				</Modal.Footer>
			</ControlledModal>

			<ControlledModal variant='blur' isOpen={passkeyModalOpen} onClose={() => setPasskeyModalOpen(false)}>
				<Modal.Header>
					<Modal.Icon className='bg-accent-soft text-accent-soft-foreground'>
						<IconKey aria-hidden='true' />
					</Modal.Icon>
					<Modal.Heading>Manage passkeys</Modal.Heading>
				</Modal.Header>
				<Modal.Body>
					<div className='space-y-3'>
						{passkeys.length === 0 ? (
							<div className='rounded-xl bg-surface-secondary p-6 text-center text-sm text-muted'>{isLoadingPasskeys ? "Loading passkeys…" : "No passkeys registered yet."}</div>
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
					</div>
				</Modal.Body>
				<Modal.Footer>
					<Button variant='tertiary' onPress={() => setPasskeyModalOpen(false)} isDisabled={pendingAction !== null}>
						Close
					</Button>
					<Button variant='primary' isPending={pendingAction === "add-passkey"} isDisabled={pendingAction !== null} onPress={() => void addPasskey()}>
						<IconPlus aria-hidden='true' size={18} /> Add passkey
					</Button>
				</Modal.Footer>
			</ControlledModal>
		</>
	);
}
