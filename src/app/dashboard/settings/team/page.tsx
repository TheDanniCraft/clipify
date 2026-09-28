"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Label, TextField } from "@heroui/react";
import { authClient } from "@/auth/client";

type MemberRow = { id: string; role: string; user: { name: string; email: string } };
type InvitationRow = { id: string; email: string; role: string | null; status: string; expiresAt: Date | string };

export default function TeamSettingsPage() {
	const organizations = authClient.useListOrganizations();
	const organization = organizations.data?.[0];
	const [members, setMembers] = useState<MemberRow[]>([]);
	const [invitations, setInvitations] = useState<InvitationRow[]>([]);
	const [email, setEmail] = useState("");
	const [role, setRole] = useState("operations");
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("");
	const [invitationUrl, setInvitationUrl] = useState("");

	const refresh = useMemo(
		() => async () => {
			if (!organization) return;
			const [memberResult, invitationResult] = await Promise.all([authClient.organization.listMembers({ query: { organizationId: organization.id, limit: 100 } }), authClient.organization.listInvitations({ query: { organizationId: organization.id } })]);
			setMembers((memberResult.data?.members ?? []) as MemberRow[]);
			setInvitations((invitationResult.data ?? []) as InvitationRow[]);
		},
		[organization],
	);

	useEffect(() => {
		if (!organization) return;
		let active = true;
		void Promise.all([authClient.organization.listMembers({ query: { organizationId: organization.id, limit: 100 } }), authClient.organization.listInvitations({ query: { organizationId: organization.id } })]).then(([memberResult, invitationResult]) => {
			if (!active) return;
			setMembers((memberResult.data?.members ?? []) as MemberRow[]);
			setInvitations((invitationResult.data ?? []) as InvitationRow[]);
		});
		return () => {
			active = false;
		};
	}, [organization]);

	async function invite(delivery: "copy" | "copy-and-email") {
		if (!organization || !email.trim()) return;
		setPending(true);
		setMessage("");
		try {
			const response = await fetch("/api/team/invitations", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ organizationId: organization.id, organizationName: organization.name, email, role, delivery }),
			});
			const result = (await response.json()) as { invitationUrl?: string; error?: string };
			if (!response.ok || !result.invitationUrl) throw new Error(result.error ?? "INVITATION_NOT_CREATED");
			setInvitationUrl(result.invitationUrl);
			setMessage(delivery === "copy-and-email" ? "Invitation created and emailed." : "Invitation created. Copy the link below.");
			setEmail("");
			await refresh();
		} catch {
			setMessage("The invitation could not be created. Check your permission and try again.");
		} finally {
			setPending(false);
		}
	}

	if (organizations.isPending) return <main className='p-6'>Loading team settings…</main>;
	if (!organization) return <main className='p-6'>No account is available for this identity.</main>;

	return (
		<main className='mx-auto flex w-full max-w-5xl flex-col gap-6 p-6'>
			<header>
				<p className='text-sm text-muted'>Settings</p>
				<h1 className='text-2xl font-semibold'>Team members</h1>
				<p className='text-sm text-muted'>Invite people without requiring a Twitch account and give them only the access they need.</p>
			</header>
			<Card>
				<Card.Header>
					<Card.Title>Invite a team member</Card.Title>
				</Card.Header>
				<Card.Content className='flex flex-col gap-4'>
					<TextField type='email' value={email} onChange={setEmail} isRequired>
						<Label>Verified account email</Label>
						<Input placeholder='person@example.com' />
					</TextField>
					<label className='flex flex-col gap-1 text-sm'>
						Role
						<select className='rounded-lg border border-default bg-surface px-3 py-2' value={role} onChange={(event) => setRole(event.target.value)}>
							<option value='operations'>Operations</option>
							<option value='content-manager'>Content manager</option>
							<option value='analyst'>Analyst</option>
							<option value='billing-manager'>Billing manager</option>
						</select>
					</label>
					<div className='flex flex-wrap gap-2'>
						<Button variant='secondary' isPending={pending} onPress={() => void invite("copy")}>
							Create copyable link
						</Button>
						<Button variant='primary' isPending={pending} onPress={() => void invite("copy-and-email")}>
							Create and email
						</Button>
					</div>
					{message && <p className='text-sm'>{message}</p>}
					{invitationUrl && (
						<div className='flex gap-2'>
							<Input readOnly value={invitationUrl} aria-label='Invitation link' />
							<Button onPress={() => void navigator.clipboard.writeText(invitationUrl)}>Copy</Button>
						</div>
					)}
				</Card.Content>
			</Card>
			<Card>
				<Card.Header>
					<Card.Title>Current members</Card.Title>
				</Card.Header>
				<Card.Content>
					<ul className='divide-y divide-default'>
						{members.map((member) => (
							<li key={member.id} className='flex justify-between py-3'>
								<span>
									{member.user.name}
									<span className='block text-sm text-muted'>{member.user.email}</span>
								</span>
								<span className='text-sm'>{member.role}</span>
							</li>
						))}
					</ul>
				</Card.Content>
			</Card>
			<Card>
				<Card.Header>
					<Card.Title>Pending invitations</Card.Title>
				</Card.Header>
				<Card.Content>
					<ul className='divide-y divide-default'>
						{invitations.map((invitation) => (
							<li key={invitation.id} className='flex justify-between py-3'>
								<span>
									{invitation.email}
									<span className='block text-sm text-muted'>{invitation.role}</span>
								</span>
								<span className='text-sm'>{invitation.status}</span>
							</li>
						))}
					</ul>
				</Card.Content>
			</Card>
		</main>
	);
}
