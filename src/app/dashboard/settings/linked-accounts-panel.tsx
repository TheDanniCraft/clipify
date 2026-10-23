"use client";

import { useEffect, useState } from "react";
import { Button, Card, Chip, Spinner } from "@heroui/react";
import { IconBrandGoogle, IconBrandTwitch, IconLink, IconMail } from "@tabler/icons-react";
import ConfirmModal from "@components/confirmModal";
import { authClient } from "@/auth/client";
import { notify as addToast } from "@lib/toast";

type LinkedAccount = { id: string; providerId: string; accountId: string };

function providerName(providerId: string) {
	return providerId === "google" ? "Google" : providerId === "twitch" ? "Twitch" : providerId === "credential" ? "Email" : providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

export default function LinkedAccountsPanel() {
	const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
	const [loading, setLoading] = useState(true);
	const [unlinking, setUnlinking] = useState<LinkedAccount | null>(null);
	const [pending, setPending] = useState(false);

	async function refresh() {
		const result = await authClient.listAccounts();
		if (result.error) throw new Error("ACCOUNTS_NOT_LOADED");
		setAccounts((result.data ?? []) as LinkedAccount[]);
	}

	useEffect(() => {
		let active = true;
		void authClient
			.listAccounts()
			.then((result) => {
				if (!active) return;
				if (result.error) throw new Error("ACCOUNTS_NOT_LOADED");
				setAccounts((result.data ?? []) as LinkedAccount[]);
			})
			.catch(() => active && addToast({ title: "Linked accounts could not be loaded", color: "danger" }))
			.finally(() => active && setLoading(false));
		return () => {
			active = false;
		};
	}, []);

	async function disconnect() {
		if (!unlinking) return;
		setPending(true);
		const result = await authClient.unlinkAccount({ accountId: unlinking.id });
		setPending(false);
		if (result.error) {
			addToast({ title: "Account could not be disconnected", description: accounts.length <= 1 ? "Add another sign-in method before disconnecting your only linked account." : result.error.message, color: "danger" });
			return;
		}
		setUnlinking(null);
		await refresh();
		addToast({ title: `${providerName(unlinking.providerId)} disconnected`, color: "success" });
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
			<ConfirmModal isOpen={unlinking !== null} isPending={pending} onOpenChange={(open) => !open && setUnlinking(null)} title={`Disconnect ${providerName(unlinking?.providerId ?? "account")}?`} confirmLabel='Disconnect' description='You will no longer be able to sign in with this account. Connected streaming channels are managed separately in Runner destinations.' onConfirm={disconnect} />
		</>
	);
}
