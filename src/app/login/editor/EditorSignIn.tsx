"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Input, InputOTP, Label, Link, ListBox, REGEXP_ONLY_DIGITS, Select, TextField } from "@heroui/react";
import { IconArrowRight, IconMail } from "@tabler/icons-react";
import { authClient } from "@/auth/client";

type Workspace = { id: string; name: string; logo?: string | null; metadata?: unknown };

function WorkspaceLabel({ workspace }: { workspace: Workspace }) {
	return (
		<div className='flex min-w-0 items-center gap-2'>
			<Avatar size='sm' className='shrink-0'>
				<Avatar.Image src={workspace.logo ?? undefined} alt='' />
				<Avatar.Fallback>{workspace.name.slice(0, 2).toUpperCase()}</Avatar.Fallback>
			</Avatar>
			<span className='truncate'>{workspace.name}</span>
		</div>
	);
}

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
	const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selectedWorkspace = workspaces?.find((workspace) => workspace.id === selectedWorkspaceId);

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
		setSelectedWorkspaceId(available.length === 1 ? available[0].id : null);
		if (available.length === 1) await openWorkspace(available[0]);
		if (!available.length) setError("Your account does not have workspace access yet. Ask the creator to invite you.");
	}

	async function continueSignedIn() {
		setPending(true);
		setError(null);
		try {
			if (workspaces === null) await loadWorkspaces();
			else {
				const selected = workspaces.find((workspace) => workspace.id === selectedWorkspaceId);
				if (selected) await openWorkspace(selected);
			}
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

	async function changeAccount() {
		setPending(true);
		try {
			const result = await authClient.signOut();
			if (result.error) throw new Error("SIGN_OUT_FAILED");
			setSignedIn(false);
			setCodeSent(false);
			setCode("");
			setWorkspaces(null);
			setSelectedWorkspaceId(null);
			setError(null);
		} catch {
			setError("We could not sign out. Please try again.");
		} finally {
			setPending(false);
		}
	}

	return (
		<main className='flex min-h-dvh items-center justify-center bg-background px-4 py-8'>
			<Card className='w-full max-w-md gap-6 p-6 sm:p-8' variant='secondary'>
				<Card.Header className='items-center gap-2 text-center'>
					<IconMail aria-hidden='true' className='text-accent' size={28} />
					<Card.Title className='text-xl font-semibold'>{signedIn ? (workspaces && workspaces.length > 1 ? "Choose your workspace" : "Continue to Clipify") : "Sign in as an editor"}</Card.Title>
					<Card.Description className='max-w-full break-words'>{signedIn ? `Signed in as ${email}.` : "Use the email address invited to a Clipify workspace."}</Card.Description>
				</Card.Header>
				<Card.Content className='gap-4'>
					{!signedIn ? (
						<form onSubmit={submit} className='space-y-4'>
							{!codeSent ? (
								<TextField isRequired isDisabled={pending}>
									<Label>Email address</Label>
									<Input type='email' autoComplete='email' value={email} onChange={(event) => setEmail(event.target.value)} />
								</TextField>
							) : (
								<div className='flex flex-col items-center gap-2 text-center'>
									<Label>Sign-in code</Label>
									<InputOTP className='justify-center' aria-label='Sign-in code' maxLength={6} value={code} onChange={setCode} pattern={REGEXP_ONLY_DIGITS} inputMode='numeric' autoComplete='one-time-code' isDisabled={pending}>
										<InputOTP.Group>
											{Array.from({ length: 6 }, (_, index) => (
												<InputOTP.Slot key={index} index={index} />
											))}
										</InputOTP.Group>
									</InputOTP>
									<p className='text-sm text-muted'>Enter the code sent to {email.trim()}.</p>
									<Button
										variant='tertiary'
										className='w-full'
										isDisabled={pending}
										onPress={() => {
											setCodeSent(false);
											setCode("");
											setError(null);
										}}
									>
										Use another email or resend
									</Button>
								</div>
							)}
							<Button type='submit' variant='primary' className='w-full' isPending={pending} isDisabled={pending || (codeSent && code.length !== 6)}>
								{codeSent ? "Sign in" : "Send sign-in code"}
							</Button>
						</form>
					) : (
						<div className='flex w-full flex-col gap-3'>
							{workspaces && workspaces.length > 0 ? (
								<Select fullWidth variant='secondary' placeholder='Select a workspace' value={selectedWorkspaceId} onChange={(value) => setSelectedWorkspaceId(typeof value === "string" ? value : null)} isDisabled={pending}>
									<Label>Workspace</Label>
									<Select.Trigger>
										<Select.Value>{selectedWorkspace ? <WorkspaceLabel workspace={selectedWorkspace} /> : undefined}</Select.Value>
										<Select.Indicator />
									</Select.Trigger>
									<Select.Popover>
										<ListBox>
											{workspaces.map((workspace) => (
												<ListBox.Item key={workspace.id} id={workspace.id} textValue={workspace.name}>
													<WorkspaceLabel workspace={workspace} />
													<ListBox.ItemIndicator />
												</ListBox.Item>
											))}
										</ListBox>
									</Select.Popover>
								</Select>
							) : null}
							{workspaces === null || workspaces.length > 0 ? (
								<Button variant='primary' className='w-full' isPending={pending} isDisabled={pending || (workspaces !== null && !selectedWorkspace)} onPress={() => void continueSignedIn()}>
									Continue
								</Button>
							) : null}
							<Button variant='tertiary' className='w-full' isDisabled={pending} onPress={() => void changeAccount()}>
								Use another account
							</Button>
						</div>
					)}
					{error ? (
						<p role='alert' className='text-sm text-danger'>
							{error}
						</p>
					) : null}
				</Card.Content>
				<Card.Footer className='justify-center'>
					<Link href='/login' className='gap-1 text-sm text-muted'>
						Creator? Sign in with Twitch
						<IconArrowRight aria-hidden='true' size={14} />
					</Link>
				</Card.Footer>
			</Card>
		</main>
	);
}
