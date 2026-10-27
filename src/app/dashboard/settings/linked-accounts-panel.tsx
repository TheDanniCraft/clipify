"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import { IconBrandGoogle, IconBrandTwitch, IconLink, IconMail } from "@tabler/icons-react";
import ConfirmModal from "@components/confirmModal";
import ReauthenticationModal from "@components/reauthenticationModal";
import { notify as addToast } from "@lib/toast";
import { disconnectLinkedAccount, listLinkedAccounts } from "@/app/actions/account-security";

type LinkedAccount = { id: string; providerId: string; accountId: string; isPrimary?: boolean };

const PENDING_DISCONNECT_KEY = "clipify.pending-linked-account-disconnect";

function providerName(providerId: string) {
	return providerId === "google" ? "Google" : providerId === "twitch" ? "Twitch" : providerId === "credential" ? "Email" : providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

export default function LinkedAccountsPanel() {
	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState(false);
	const [unlinking, setUnlinking] = useState<LinkedAccount | null>(null);
	const [pending, setPending] = useState(false);
	const requestPending = useRef(false);
	const resumeAttempted = useRef(false);
	const [reauthProvider, setReauthProvider] = useState<"twitch" | "google" | null>(null);

	const refresh = useCallback(async () => {
		const result = await listLinkedAccounts();
		if (result.error) throw new Error("ACCOUNTS_NOT_LOADED");
		setAccounts(((result.data ?? []) as LinkedAccount[]).filter((account) => account.providerId === "google" || account.providerId === "twitch"));
		setLoadError(false);
	}, []);

	useEffect(() => {
		let active = true;
		void listLinkedAccounts()
			.then((result) => {
				if (!active) return;
				if (result.error) throw new Error("ACCOUNTS_NOT_LOADED");
				setAccounts(((result.data ?? []) as LinkedAccount[]).filter((account) => account.providerId === "google" || account.providerId === "twitch"));
			})
			.catch(() => {
				if (!active) return;
				setLoadError(true);
				addToast({ title: "Linked accounts could not be loaded", color: "danger" });
			})
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
		};
	}, []);

	const disconnectAccount = useCallback(
		async (account: LinkedAccount) => {
			if (requestPending.current) return;
			requestPending.current = true;
			setPending(true);
			try {
				const result = await disconnectLinkedAccount(account.id);
				if (!result.success) {
					if (result.code === "REAUTHENTICATION_REQUIRED") {
						setUnlinking(account);
						setReauthProvider(result.reauthProvider ?? "twitch");
						window.sessionStorage.setItem(PENDING_DISCONNECT_KEY, account.id);
						return;
					}
					addToast({ title: "Account could not be disconnected", description: result.error, color: "danger" });
					return;
				}
				const disconnectedProvider = account.providerId;
				window.sessionStorage.removeItem(PENDING_DISCONNECT_KEY);
				setUnlinking(null);
				setReauthProvider(null);
				await refresh();
				addToast({ title: `${providerName(disconnectedProvider)} disconnected`, description: "Its Clipify access and Runner channel connection were removed.", color: "success" });
			} catch {
				addToast({ title: "Account could not be disconnected", description: "Please try again.", color: "danger" });
			} finally {
				requestPending.current = false;
				setPending(false);
			}
		},
		[refresh],
	);

	async function disconnect() {
		if (unlinking) await disconnectAccount(unlinking);
	}

	useEffect(() => {
		if (loading || resumeAttempted.current) return;
		resumeAttempted.current = true;
		const search = new URLSearchParams(window.location.search);
		const outcome = search.get("reauthentication");
		if (!outcome) return;
		search.delete("reauthentication");
		window.history.replaceState(null, "", `${window.location.pathname}${search.size ? `?${search.toString()}` : ""}${window.location.hash}`);
		const pendingAccountId = window.sessionStorage.getItem(PENDING_DISCONNECT_KEY);
		if (outcome === "failed") {
			window.sessionStorage.removeItem(PENDING_DISCONNECT_KEY);
			addToast({ title: "Sign-in could not be completed", description: "The account was not disconnected.", color: "danger" });
			return;
		}
		const account = accounts.find((candidate) => candidate.id === pendingAccountId);
		if (!account) {
			window.sessionStorage.removeItem(PENDING_DISCONNECT_KEY);
			return;
		}
		queueMicrotask(() => void disconnectAccount(account));
	}, [accounts, disconnectAccount, loading]);

	return (
		<>
			<Card className='w-full' role='region' aria-labelledby='linked-accounts-title'>
				<Card.Header>
					<Card.Title id='linked-accounts-title'>Linked accounts</Card.Title>
					<Card.Description>Manage the accounts you can use to sign in to Clipify.</Card.Description>
				</Card.Header>
				<Card.Content className='divide-y divide-default p-0'>
					{loading ? (
						<div className='flex items-center gap-2 p-5 text-sm text-muted'>
							<Spinner size='sm' /> Loading accounts…
						</div>
					) : loadError ? (
						<div className='flex flex-col items-start gap-3 p-5'>
							<p className='text-sm text-muted'>Linked accounts could not be loaded.</p>
							<Button
								size='sm'
								variant='secondary'
								onPress={() => {
									setLoading(true);
									void refresh()
										.catch(() => addToast({ title: "Linked accounts could not be loaded", color: "danger" }))
										.finally(() => setLoading(false));
								}}
							>
								Try again
							</Button>
						</div>
					) : accounts.length === 0 ? (
						<p className='p-5 text-sm text-muted'>No Twitch or YouTube accounts are linked.</p>
					) : (
						accounts.map((account) => {
							const Icon = account.providerId === "google" ? IconBrandGoogle : account.providerId === "twitch" ? IconBrandTwitch : account.providerId === "credential" ? IconMail : IconLink;
							return (
								<div key={account.id} className='flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between'>
									<div className='flex min-w-0 items-center gap-3'>
										<span className='flex size-10 shrink-0 items-center justify-center rounded-full bg-default'>
											<Icon size={21} aria-hidden='true' />
										</span>
										<div className='min-w-0'>
											<p className='font-semibold'>{providerName(account.providerId)}</p>
											<p className='text-sm text-muted'>{account.isPrimary ? "Required for Clipify sign-in and Twitch features" : "Available for sign-in"}</p>
										</div>
										<Chip color='success' variant='soft' size='sm'>
											Connected
										</Chip>
									</div>
									<Button className='w-full sm:w-auto' size='sm' variant={account.isPrimary ? "secondary" : "danger-soft"} isDisabled={account.isPrimary} onPress={() => setUnlinking(account)}>
										{account.isPrimary ? "Primary account" : "Disconnect"}
									</Button>
								</div>
							);
						})
					)}
				</Card.Content>
			</Card>
			<ConfirmModal
				isOpen={unlinking !== null && reauthProvider === null}
				isPending={pending}
				onOpenChange={(open) => {
					if (!open) {
						setUnlinking(null);
						setReauthProvider(null);
					}
				}}
				title={reauthProvider ? "Verify your identity" : `Disconnect ${providerName(unlinking?.providerId ?? "account")}?`}
				confirmLabel={reauthProvider ? `Sign in with ${providerName(reauthProvider)}` : "Disconnect"}
				description={reauthProvider ? "To complete this action, please sign in again." : "This removes the sign-in method, revokes its Clipify access, and disconnects Runner destinations using the same channel."}
				onConfirm={disconnect}
			/>
			<ReauthenticationModal
				isOpen={reauthProvider !== null}
				provider={reauthProvider ?? "twitch"}
				onClose={() => {
					setReauthProvider(null);
					setUnlinking(null);
					window.sessionStorage.removeItem(PENDING_DISCONNECT_KEY);
				}}
				callbackURL='/dashboard/settings?tab=connections&reauthentication=complete'
				errorCallbackURL='/dashboard/settings?tab=connections&reauthentication=failed'
			/>
		</>
	);
}
