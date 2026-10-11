"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, InputOTP, Label, Link, REGEXP_ONLY_DIGITS, TextField } from "@heroui/react";
import { IconMail } from "@tabler/icons-react";
import { authClient } from "@/auth/client";

type Workspace = { id: string; name: string; metadata?: unknown };

function workspaceDestination(workspace: Workspace, returnUrl: string) {
	if (returnUrl !== "/dashboard") return returnUrl;
	let metadata = workspace.metadata;
	if (typeof metadata === "string") {
		try {
			metadata = JSON.parse(metadata || "{}");
		} catch {
			metadata = null;
		}
	}
	return metadata && typeof metadata === "object" && "accountType" in metadata && metadata.accountType === "agency" ? "/dashboard/agency" : returnUrl;
}

export default function EditorSignIn({ returnUrl, signedInEmail }: { returnUrl: string; signedInEmail: string | null }) {
	const router = useRouter();
	const [email, setEmail] = useState(signedInEmail ?? "");
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [signedIn, setSignedIn] = useState(!!signedInEmail);
	const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function openWorkspace(workspace: Workspace) {
		const result = await authClient.organization.setActive({ organizationId: workspace.id });
		if (result.error) throw new Error("We could not open this workspace. Please try again.");
		router.replace(workspaceDestination(workspace, returnUrl));
		router.refresh();
	}

	async function loadWorkspaces() {
		const result = await authClient.organization.list();
		if (result.error) throw new Error("We could not load your workspaces. Please try again.");
		const available = result.data ?? [];
		setWorkspaces(available);
		if (available.length === 1) await openWorkspace(available[0]);
		if (!available.length) setError("Your account does not have workspace access yet. Ask the creator to invite you.");
	}

	async function continueSignedIn() {
		setPending(true);
		setError(null);
		try {
			await loadWorkspaces();
		} catch {
			setError("We could not open your workspace. Please try again.");
		} finally {
			setPending(false);
		}
	}

	async function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError(null);
		try {
			if (!codeSent) {
				const result = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" });
				if (result.error) throw new Error("We could not send a code. Please try again shortly.");
				setCodeSent(true);
			} else {
				const result = await authClient.signIn.emailOtp({ email: email.trim(), otp: code });
				if (result.error) throw new Error("That code could not be verified. Please check it or request a new code.");
				// The provider owns redirects when its signed OAuth query is present.
				if (result.data && "redirect" in result.data && result.data.redirect) return;
				setSignedIn(true);
				await loadWorkspaces();
			}
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : "Sign-in could not be completed. Please try again.");
		} finally {
			setPending(false);
		}
	}

	async function selectWorkspace(workspace: Workspace) {
		setPending(true);
		setError(null);
		try {
			await openWorkspace(workspace);
		} catch {
			setError("We could not open this workspace. Please try again.");
		} finally {
			setPending(false);
		}
	}

	async function changeAccount() {
		setPending(true);
		try {
			const result = await authClient.signOut();
			if (result.error) throw new Error("SIGN_OUT_FAILED");
			setSignedIn(false);
			setCodeSent(false);
			setCode("");
			setWorkspaces(null);
			setError(null);
		} catch {
			setError("We could not sign out. Please try again.");
		} finally {
			setPending(false);
		}
	}

	return (
		<main className='flex min-h-dvh items-center justify-center bg-background px-4 py-8'>
			<Card className='w-full max-w-md' variant='secondary'>
				<Card.Header>
					<IconMail aria-hidden='true' className='text-accent' size={28} />
					<Card.Title>{signedIn ? "Choose your workspace" : "Sign in as an editor"}</Card.Title>
					<Card.Description>{signedIn ? `Signed in as ${email}.` : "Use the email address invited to a Clipify workspace."}</Card.Description>
				</Card.Header>
				<Card.Content className='space-y-4'>
					{!signedIn ? (
						<form onSubmit={submit} className='space-y-4'>
							{!codeSent ? (
								<TextField isRequired isDisabled={pending}>
									<Label>Email address</Label>
									<Input type='email' autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} />
								</TextField>
							) : (
								<div className='space-y-2'>
									<Label>Sign-in code</Label>
									<InputOTP aria-label='Sign-in code' maxLength={6} value={code} onChange={setCode} pattern={REGEXP_ONLY_DIGITS} inputMode='numeric' autoComplete='one-time-code' isDisabled={pending}>
										<InputOTP.Group>
											{Array.from({ length: 6 }, (_, index) => (
												<InputOTP.Slot key={index} index={index} />
											))}
										</InputOTP.Group>
									</InputOTP>
									<p className='text-sm text-muted'>Enter the code sent to {email.trim()}.</p>
									<Button
										variant='tertiary'
										isDisabled={pending}
										onPress={() => {
											setCodeSent(false);
											setCode("");
											setError(null);
										}}
									>
										Use another email or request a new code
									</Button>
								</div>
							)}
							<Button type='submit' variant='primary' className='w-full' isPending={pending} isDisabled={pending || (codeSent && code.length !== 6)}>
								{codeSent ? "Sign in" : "Send sign-in code"}
							</Button>
						</form>
					) : (
						<>
							{pending ? <p className='text-sm text-muted'>Opening your workspace...</p> : null}
							{workspaces === null ? (
								<Button variant='primary' isPending={pending} isDisabled={pending} onPress={() => void continueSignedIn()}>
									Continue
								</Button>
							) : null}
							{workspaces?.map((workspace) => (
								<Button key={workspace.id} variant='secondary' className='w-full' isDisabled={pending} onPress={() => void selectWorkspace(workspace)}>
									{workspace.name}
								</Button>
							))}
							<Button variant='tertiary' isDisabled={pending} onPress={() => void changeAccount()}>
								Use another account
							</Button>
						</>
					)}
					{error ? (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					) : null}
				</Card.Content>
				<Card.Footer>
					<Link href='/login'>Creator? Sign in with Twitch</Link>
				</Card.Footer>
			</Card>
		</main>
	);
}
