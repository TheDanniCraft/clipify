"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { authClient } from "@/auth/client";

type PasskeyRow = { id: string; name: string | null; createdAt: Date | string | null };

export default function SecuritySettingsPage() {
	const session = authClient.useSession();
	const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
	const [newEmail, setNewEmail] = useState("");
	const [message, setMessage] = useState("");

	async function refreshPasskeys() {
		const result = await authClient.passkey.listUserPasskeys();
		setPasskeys((result.data ?? []) as PasskeyRow[]);
	}

	useEffect(() => {
		let active = true;
		void authClient.passkey.listUserPasskeys().then((result) => {
			if (active) setPasskeys((result.data ?? []) as PasskeyRow[]);
		});
		return () => {
			active = false;
		};
	}, []);

	async function sendEmailCode() {
		const email = session.data?.user.email;
		if (!email) return;
		const result = await authClient.emailOtp.sendVerificationOtp({ email, type: "email-verification" });
		setMessage(result.error ? "The email code could not be sent." : "A code was sent to your verified account email.");
	}

	async function requestEmailChange() {
		const result = await authClient.emailOtp.requestEmailChange({ newEmail });
		setMessage(result.error ? "The address change could not be started." : "Check the new address for its verification code.");
	}

	async function addPasskey() {
		const result = await authClient.passkey.addPasskey({ name: "Clipify passkey" });
		setMessage(result.error ? "Passkey setup was cancelled or unavailable. Email code sign-in remains available." : "Passkey added.");
		if (!result.error) await refreshPasskeys();
	}

	async function removePasskey(id: string) {
		const result = await authClient.passkey.deletePasskey({ id });
		setMessage(result.error ? "Passkey could not be removed." : "Passkey removed. Email code sign-in remains available.");
		if (!result.error) await refreshPasskeys();
	}

	return (
		<main className='mx-auto flex w-full max-w-4xl flex-col gap-6 p-6'>
			<header>
				<p className='text-sm text-muted'>Settings</p>
				<h1 className='text-2xl font-semibold'>Sign-in security</h1>
				<p className='text-sm text-muted'>Email codes are the recovery and team-member sign-in method. Passkeys are an optional passwordless alternative, not 2FA.</p>
			</header>
			{message && <p className='rounded-lg border border-default p-3 text-sm'>{message}</p>}
			<Card>
				<Card.Header>
					<Card.Title>Email code</Card.Title>
				</Card.Header>
				<Card.Content className='flex flex-col gap-4'>
					<p className='text-sm text-muted'>Current account email: {session.data?.user.email ?? "Unavailable"}</p>
					<div>
						<Button onPress={() => void sendEmailCode()}>Send verification code</Button>
					</div>
					<TextField type='email' value={newEmail} onChange={setNewEmail}>
						<Label>New verified email</Label>
						<Input placeholder='new@example.com' />
					</TextField>
					<div>
						<Button variant='secondary' onPress={() => void requestEmailChange()}>
							Verify a new address
						</Button>
					</div>
				</Card.Content>
			</Card>
			<Card>
				<Card.Header>
					<Card.Title>Passkeys</Card.Title>
				</Card.Header>
				<Card.Content className='flex flex-col gap-4'>
					<p className='text-sm text-muted'>Use a device passkey for a faster passwordless sign-in. You can always fall back to an email code.</p>
					<div>
						<Button variant='primary' onPress={() => void addPasskey()}>
							Add passkey
						</Button>
					</div>
					<ul className='divide-y divide-default'>
						{passkeys.map((passkey) => (
							<li key={passkey.id} className='flex items-center justify-between py-3'>
								<span>{passkey.name || "Passkey"}</span>
								<Button size='sm' variant='secondary' onPress={() => void removePasskey(passkey.id)}>
									Remove
								</Button>
							</li>
						))}
					</ul>
				</Card.Content>
			</Card>
		</main>
	);
}
