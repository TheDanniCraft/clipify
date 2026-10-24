"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import { IconBrandGoogle, IconBrandTwitch, IconLink, IconMail } from "@tabler/icons-react";
import ConfirmModal from "@components/confirmModal";
import { authClient } from "@/auth/client";
import { notify as addToast } from "@lib/toast";
import { disconnectLinkedAccount } from "@/app/actions/account-security";

type LinkedAccount = { id: string; providerId: string; accountId: string };

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
	const [reauthProvider, setReauthProvider] = useState<"twitch" | "google" | null>(null);

	async function refresh() {
		const result = await authClient.listAccounts();
		if (result.error) throw new Error("ACCOUNTS_NOT_LOADED");
		setAccounts(((result.data ?? []) as LinkedAccount[]).filter((account) => account.providerId === "google" || account.providerId === "twitch"));
		setLoadError(false);
	}

	useEffect(() => {
		let active = true;
		void authClient
			.listAccounts()
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

	async function disconnect() {
		if (!unlinking || requestPending.current) return;
		requestPending.current = true;
		setPending(true);
		try {
			const result = await disconnectLinkedAccount(unlinking.id);
			if (!result.success) {
				if (result.code === "REAUTHENTICATION_REQUIRED" && result.reauthProvider) setReauthProvider(result.reauthProvider);
				addToast({ title: result.code === "REAUTHENTICATION_REQUIRED" ? "Sign in again to continue" : "Account could not be disconnected", description: result.error, color: result.code === "REAUTHENTICATION_REQUIRED" ? "warning" : "danger" });
				return;
			}
			const disconnectedProvider = unlinking.providerId;
			setUnlinking(null);
			await refresh();
			addToast({ title: `${providerName(disconnectedProvider)} disconnected`, description: "Its Clipify access and Runner channel connection were removed.", color: "success" });
		} catch {
			addToast({ title: "Account could not be disconnected", description: "Please try again.", color: "danger" });
		} finally {
			requestPending.current = false;
			setPending(false);
		}
	}

	async function reauthenticate() {
		if (!reauthProvider || requestPending.current) return;
		requestPending.current = true;
		setPending(true);
		const result = await authClient.signIn.social({ provider: reauthProvider, callbackURL: "/dashboard/settings?tab=connections", errorCallbackURL: "/dashboard/settings?tab=connections&reauthentication=failed" });
		if (result.error) {
			requestPending.current = false;
			setPending(false);
			addToast({ title: "Sign-in could not start", description: "Please try again.", color: "danger" });
		}
	}

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
											<p className='text-sm text-muted'>Available for sign-in</p>
										</div>
										<Chip color='success' variant='soft' size='sm'>
											Connected
										</Chip>
									</div>
									<Button className='w-full sm:w-auto' size='sm' variant='danger-soft' onPress={() => setUnlinking(account)}>
										Disconnect
									</Button>
								</div>
							);
						})
					)}
				</Card.Content>
			</Card>
			<ConfirmModal
				isOpen={unlinking !== null}
				isPending={pending}
				onOpenChange={(open) => {
					if (!open) {
						setUnlinking(null);
						setReauthProvider(null);
					}
				}}
				title={reauthProvider ? "Sign in again to continue" : `Disconnect ${providerName(unlinking?.providerId ?? "account")}?`}
				confirmLabel={reauthProvider ? `Continue with ${providerName(reauthProvider)}` : "Disconnect"}
				description={reauthProvider ? "Clipify needs a recent sign-in before removing an account." : "This removes the sign-in method, revokes its Clipify access, and disconnects Runner destinations using the same channel."}
				onConfirm={reauthProvider ? reauthenticate : disconnect}
			/>
		</>
	);
}
